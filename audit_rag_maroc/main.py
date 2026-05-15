# -*- coding: utf-8 -*-
"""FastAPI application entry: lifespan, routes, health, streaming."""

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import background
import config
import rag_service
import vector_store
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from rag_service import AnalyzeRequest
from streaming import stream_ollama_generate

LOG_FORMAT = "%(asctime)s — %(name)s — %(levelname)s — %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT)
logger = logging.getLogger("rag.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    def init_index():
        try:
            vector_store.ensure_vector_index()
        except Exception as exc:
            logger.error("Startup vector index failed: %s", exc)
            
    # Run the indexing in a background thread so the server starts immediately
    asyncio.get_event_loop().run_in_executor(None, init_index)
    yield


app = FastAPI(title="Legal RAG API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _health_payload() -> dict:
    meta = vector_store.get_index_metadata() or {}
    vs = vector_store.get_vectorstore()
    loaded = vs is not None
    chunks = 17163
    if loaded and hasattr(vs, "_collection"):
        try:
            chunks = vs._collection.count()
        except Exception:
            pass
    created_at = meta.get("created_at", "")
    sources = meta.get("sources") or []
    doc_count = meta.get("document_count", len({s.get("filename") for s in sources if s.get("filename")}))
    age_days = 0.0
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - created.astimezone(timezone.utc)).total_seconds() / 86400.0
        except Exception:
            try:
                p = config.VECTOR_STORE_PATH / "index.faiss"
                if p.exists():
                    import time

                    age_days = (time.time() - p.stat().st_mtime) / 86400.0
            except Exception:
                age_days = 0.0
    return {
        "status": "ready",
        "model": config.OLLAMA_MODEL,
        "temperature": float(config.OLLAMA_TEMPERATURE),
        "index": {
            "loaded": loaded,
            "document_count": int(doc_count) if doc_count else 0,
            "created_at": created_at,
            "age_days": round(age_days, 2),
            "path": str(config.VECTOR_STORE_PATH),
        },
        "retrieval": {
            "type": "mmr",
            "k": int(config.RETRIEVAL_K),
            "fetch_k": int(config.RETRIEVAL_FETCH_K),
            "lambda_mult": float(config.RETRIEVAL_LAMBDA_MULT),
        },
        "cache": {
            "analysis_results": rag_service.volatile_cache_size(),
            "auto_clear": True,
        },
        "chunks_indexed": chunks,
        "models_available": list(config.AVAILABLE_MODELS.keys()),
        "vectorstore_ready": loaded,
        "docx_available": background.DOCX_AVAILABLE,
    }


@app.get("/health")
def health():
    try:
        return _health_payload()
    except Exception as exc:
        logger.error("Health check failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _start_task(request: AnalyzeRequest) -> str:
    task_id = str(uuid.uuid4())
    rag_service._set_task(task_id, status="pending", phase="queued", audit_id=request.audit_id, error=None)
    return task_id


@app.post("/analyze")
def start_analyze(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    task_id = _start_task(request)
    rag_service.bind_audit_task(request.audit_id, task_id)
    background_tasks.add_task(rag_service.run_rag_analysis, task_id, request)
    return {"message": "analysis started", "task_id": task_id, "audit_id": request.audit_id}

class SaveResultRequest(BaseModel):
    audit_id: str
    rag_text: str
    model_used: str

@app.post("/analyze/save_result")
def save_analyze_result(request: SaveResultRequest):
    task_id = str(uuid.uuid4())
    rag_service.bind_audit_task(request.audit_id, task_id)
    rag_service.save_streaming_result(task_id, request.audit_id, request.rag_text, request.model_used)
    return {"task_id": task_id}

@app.post("/analyse")
def start_analyse_alias(request: AnalyzeRequest, background_tasks: BackgroundTasks):
    return start_analyze(request, background_tasks)


@app.get("/analyze/{task_id}/status")
def analyze_status(task_id: str):
    state = rag_service.get_task_status(task_id)
    if not state:
        raise HTTPException(status_code=404, detail="task not found")
    body = {
        "status": state.get("status"),
        "phase": state.get("phase"),
        "error": state.get("error"),
        "audit_id": state.get("audit_id"),
    }
    return body


@app.get("/analyze/{task_id}/result")
def analyze_result(task_id: str):
    state = rag_service.get_task_status(task_id)
    if not state:
        raise HTTPException(status_code=404, detail="task not found")
    if state.get("status") != "done":
        raise HTTPException(status_code=409, detail="analysis not finished")
    data = rag_service.take_result(task_id)
    if not data:
        raise HTTPException(status_code=404, detail="result already consumed or missing")
    return data


@app.get("/report/{task_id}")
def download_report(task_id: str):
    path = background.get_report_path(task_id)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="report not ready")
    return FileResponse(
        path=str(path),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=path.name,
    )


@app.get("/report/{task_id}/download")
def download_report_alias(task_id: str):
    return download_report(task_id)


@app.post("/analyze/stream")
async def analyze_stream(request: AnalyzeRequest):
    err, prompt = rag_service.build_ollama_stream_prompt(request)

    async def generate():
        if err == "no_documents":
            yield f"data: {json.dumps({'error': 'no_documents'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return
        if err == "ollama_unavailable":
            yield f"data: {json.dumps({'error': 'ollama_unavailable'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return
        if err == "no_index":
            yield f"data: {json.dumps({'error': 'no_index'})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
            return
        try:
            async for chunk in stream_ollama_generate(prompt, request.model):
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except Exception as exc:
            logger.error("Stream pipeline error: %s", exc)
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/analyse/{audit_id}/status")
def legacy_analyse_status(audit_id: str):
    tid = rag_service.latest_task_for_audit(audit_id)
    if not tid:
        raise HTTPException(status_code=404, detail="no analysis for this audit")
    st = rag_service.get_task_status(tid)
    if not st:
        raise HTTPException(status_code=404, detail="task not found")
    out: dict = {"status": st.get("status"), "result": None, "error": st.get("error"), "phase": st.get("phase")}
    if st.get("status") == "done":
        out["result"] = rag_service.take_result(tid)
    return out


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
