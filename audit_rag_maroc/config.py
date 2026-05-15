# -*- coding: utf-8 -*-
"""Environment-driven configuration only. No business defaults beyond getenv fallbacks."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BASE = Path(__file__).resolve().parent
load_dotenv(_BASE / ".env", override=False)


def _get_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
OLLAMA_NUM_PREDICT = _get_int("OLLAMA_NUM_PREDICT", 1024)
OLLAMA_TEMPERATURE = _get_float("OLLAMA_TEMPERATURE", 0.1)
OLLAMA_TOP_P = _get_float("OLLAMA_TOP_P", 0.9)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()  # "ollama" or "gemini"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

TEMPERATURE = OLLAMA_TEMPERATURE
RETRIEVAL_TYPE = os.getenv("RETRIEVAL_TYPE", "mmr")
SIMILARITY_THRESHOLD = _get_float("SIMILARITY_THRESHOLD", 0.3)
INTERDIT_CGI = _get_bool("INTERDIT_CGI", True)

VECTOR_STORE_PATH = Path(os.getenv("VECTOR_STORE_PATH", "./data/vector_store")).resolve()
LEGAL_DOCUMENTS_PATH = Path(os.getenv("LEGAL_DOCUMENTS_PATH", "./data")).resolve()
REBUILD_INDEX = _get_bool("REBUILD_INDEX", False)
INDEX_MAX_AGE_DAYS = _get_int("INDEX_MAX_AGE_DAYS", 30)

RETRIEVAL_K = _get_int("RETRIEVAL_K", 4)
RETRIEVAL_FETCH_K = _get_int("RETRIEVAL_FETCH_K", 20)
RETRIEVAL_LAMBDA_MULT = _get_float("RETRIEVAL_LAMBDA_MULT", 0.5)

RAG_PUBLIC_API_URL = os.getenv("NEXT_PUBLIC_RAG_API_URL", "http://localhost:8000").rstrip("/")
MAX_PDF_WORKERS = _get_int("MAX_PDF_WORKERS", 5)
PDF_DOWNLOAD_TIMEOUT = _get_int("PDF_DOWNLOAD_TIMEOUT", 30)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

CHUNK_SIZE = _get_int("CHUNK_SIZE", 800)
CHUNK_OVERLAP = _get_int("CHUNK_OVERLAP", 200)

# Legacy Chroma scripts (01_load_and_index.py, Streamlit) — separate from FAISS VECTOR_STORE_PATH
CHROMA_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", "./vector_db")).resolve()
COLLECTION_NAME = os.getenv("CHROMA_COLLECTION_NAME", "droit_marocain")
VECTOR_DB_PATH = str(CHROMA_PERSIST_DIR)
DATA_PATH = str(LEGAL_DOCUMENTS_PATH)

CATEGORIES_JURIDIQUES = {
    "droit bancaire et financier": "Droit Bancaire et Financier",
    "droit de la concurrence et consommation": "Droit de la Concurrence et Consommation",
    "droit des données et numérique": "Droit des Données et Numérique",
    "droit des marchés publics": "Droit des Marchés Publics",
    "droit des obligations et contrats (doc)": "Droit des Obligations et Contrats (DOC)",
    "droit des sociétés corporate": "Droit des Sociétés Corporate",
    "droit du travail": "Droit du Travail",
    "droit fiscal": "Droit Fiscal",
    "droit immobilier et foncier": "Droit Immobilier et Foncier",
    "droit pénal et procédure pénale": "Droit Pénal et Procédure Pénale",
}

AVAILABLE_MODELS = {
    "llama3": {"nom": "Llama 3 (8B)"},
    "mistral": {"nom": "Mistral (7B)"},
    "phi3": {"nom": "Phi-3 Mini"},
    "gemma2": {"nom": "Gemma 2 (9B)"},
}
DEFAULT_MODEL = OLLAMA_MODEL
AUDIT_PROMPT_TEMPLATE = """You are an expert Moroccan legal auditor.
Compare the CLIENT DOCUMENT with the LEGAL BASE excerpts.
BASE JURIDIQUE:
{context}
DOCUMENT CLIENT:
{question}
MISSION : Identify only real non-conformities.
FORMAT:
=== VIOLATION ===
📌 TEXTE ORIGINAL : [extrait client]
📖 CITATION EXACTE : "[loi marocaine]"
📁 SOURCE : [nom du fichier]
If compliant: ✅ CONFORME
Be brief and precise. Keep the analysis section detailed and professional in French.."""

APP_TITLE = "⚖️ Audit Juridique Marocain — RAG"
APP_ICON = "⚖️"
APP_DESCRIPTION = "Assistant IA d'audit de conformité au droit marocain"
