# -*- coding: utf-8 -*-
"""Backward compatibility entrypoint — prefer: uvicorn main:app --host 0.0.0.0 --port 8000"""

from main import app

__all__ = ["app"]
