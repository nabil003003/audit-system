# -*- coding: utf-8 -*-
"""Ollama HTTP streaming helpers (NDJSON /api/generate stream)."""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

import httpx

import config

logger = logging.getLogger(__name__)


async def stream_ollama_generate(prompt: str, model: str | None = None) -> AsyncIterator[str]:
    """Yield decoded text fragments from Ollama streaming generate API."""
    model_name = model or config.OLLAMA_MODEL
    url = f"{config.OLLAMA_BASE_URL}/api/generate"
    payload: dict[str, Any] = {
        "model": model_name,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": float(config.OLLAMA_TEMPERATURE),
            "top_p": float(config.OLLAMA_TOP_P),
            "num_predict": int(config.OLLAMA_NUM_PREDICT),
        },
    }
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            async with client.stream("POST", url, json=payload) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    chunk = data.get("response")
                    if chunk:
                        yield chunk
                    if data.get("done"):
                        break
    except Exception as exc:
        logger.error("Ollama stream failed: %s", exc)
        yield f"\n[stream error: {exc}]\n"
