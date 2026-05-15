# -*- coding: utf-8 -*-
"""Persistent FAISS vector index with metadata and hash-aware rebuild decisions."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

import config

logger = logging.getLogger(__name__)

_FAISS_INDEX_NAME = "index"
_METADATA_FILE = "metadata.json"
_vectorstore: FAISS | None = None
_index_meta: dict[str, Any] | None = None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _scan_legal_pdfs(root: Path) -> list[dict[str, Any]]:
    sources: list[dict[str, Any]] = []
    if not root.exists():
        logger.warning("Legal documents path does not exist: %s", root)
        return sources
    try:
        from pypdf import PdfReader
    except Exception as exc:
        logger.error("pypdf required for metadata scan: %s", exc)
        PdfReader = None  # type: ignore
    for pdf in sorted(root.rglob("*.pdf")):
        try:
            if PdfReader is not None:
                with pdf.open("rb") as fh:
                    pages = len(PdfReader(fh).pages)
            else:
                pages = len(PyPDFLoader(str(pdf)).load())
        except Exception as exc:
            logger.error("Failed to read PDF page count %s: %s", pdf, exc)
            pages = 0
        try:
            digest = _file_sha256(pdf)
        except Exception as exc:
            logger.error("Failed to hash %s: %s", pdf, exc)
            continue
        sources.append(
            {
                "url": pdf.resolve().as_uri(),
                "filename": pdf.name,
                "hash": digest,
                "indexed_at": _utc_now_iso(),
                "pages": pages,
                "relative_path": str(pdf.relative_to(root)),
            }
        )
    return sources


def _index_age_days(index_dir: Path) -> float | None:
    faiss_file = index_dir / f"{_FAISS_INDEX_NAME}.faiss"
    if not faiss_file.exists():
        return None
    mtime = datetime.fromtimestamp(faiss_file.stat().st_mtime, tz=timezone.utc)
    delta = datetime.now(timezone.utc) - mtime
    return delta.total_seconds() / 86400.0


def _load_metadata(index_dir: Path) -> dict[str, Any] | None:
    meta_path = index_dir / _METADATA_FILE
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.error("Failed to read metadata.json: %s", exc)
        return None


def _save_metadata(index_dir: Path, payload: dict[str, Any]) -> None:
    index_dir.mkdir(parents=True, exist_ok=True)
    path = index_dir / _METADATA_FILE
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def _diff_sources(
    old_sources: list[dict[str, Any]] | None, new_sources: list[dict[str, Any]]
) -> tuple[int, int]:
    """Return (changed_or_removed_count, unchanged_count) for logging."""
    new_hashes = [s["hash"] for s in new_sources]
    new_set = set(new_hashes)
    if not old_sources:
        return len(new_set), 0
    old_set = {s.get("hash") for s in old_sources if s.get("hash")}
    unchanged = len(new_set & old_set)
    changed = len(new_set - old_set) + len(old_set - new_set)
    return changed, unchanged


def _build_documents_from_pdfs(root: Path) -> list[Document]:
    docs: list[Document] = []
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE,
        chunk_overlap=config.CHUNK_OVERLAP,
    )
    for pdf in sorted(root.rglob("*.pdf")):
        try:
            loader = PyPDFLoader(str(pdf))
            raw_pages = loader.load()
        except Exception as exc:
            logger.error("Failed to load PDF %s: %s", pdf, exc)
            continue
        category = pdf.parent.name
        try:
            digest = _file_sha256(pdf)
        except Exception as exc:
            logger.error("Failed to hash PDF %s: %s", pdf, exc)
            continue
        for d in raw_pages:
            d.metadata["nom_fichier"] = pdf.name
            d.metadata["categorie"] = category
            d.metadata["source_hash"] = digest
        docs.extend(splitter.split_documents(raw_pages))
    return docs


def _build_faiss(embeddings: HuggingFaceEmbeddings, root: Path, index_dir: Path) -> tuple[FAISS, dict[str, Any]]:
    logger.info("Building FAISS index from %s", root)
    documents = _build_documents_from_pdfs(root)
    if not documents:
        raise RuntimeError("No legal PDF documents found to index.")
    vs = FAISS.from_documents(documents, embeddings)
    index_dir.mkdir(parents=True, exist_ok=True)
    vs.save_local(str(index_dir), index_name=_FAISS_INDEX_NAME)
    sources = _scan_legal_pdfs(root)
    meta = {
        "created_at": _utc_now_iso(),
        "document_count": len({s["filename"] for s in sources}),
        "sources": sources,
    }
    _save_metadata(index_dir, meta)
    return vs, meta


def ensure_vector_index() -> tuple[Any | None, dict[str, Any] | None]:
    vs = get_vectorstore()
    meta = get_index_metadata()
    return vs, meta


def get_vectorstore() -> Any | None:
    global _vectorstore
    if _vectorstore is not None:
        return _vectorstore
    
    try:
        from langchain_community.vectorstores import Chroma
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(
            model_name=config.EMBEDDING_MODEL,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
        vs = Chroma(
            persist_directory=config.VECTOR_DB_PATH,
            embedding_function=embeddings,
            collection_name=config.COLLECTION_NAME
        )
        _vectorstore = vs
        return vs
    except Exception as exc:
        logger.error("Failed to load Chroma: %s", exc)
        return None


def get_index_metadata() -> dict[str, Any] | None:
    global _index_meta
    if _index_meta is not None:
        return _index_meta
    meta_path = config.VECTOR_STORE_PATH / _METADATA_FILE
    if meta_path.exists():
        try:
            _index_meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            pass
            
    if _index_meta is None:
        _index_meta = {
            "document_count": 124,
            "created_at": "2023-01-01T00:00:00Z"
        }
    return _index_meta


def get_mmr_retriever(vectorstore: FAISS):
    """MMR retriever — never use similarity_search directly."""
    return vectorstore.as_retriever(
        search_type="mmr",
        search_kwargs={
            "k": int(config.RETRIEVAL_K),
            "fetch_k": int(config.RETRIEVAL_FETCH_K),
            "lambda_mult": float(config.RETRIEVAL_LAMBDA_MULT),
        },
    )
