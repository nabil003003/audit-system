# -*- coding: utf-8 -*-
"""RAG analysis orchestration: retrieval (MMR), Ollama, parsing, task lifecycle."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import threading
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Optional

import requests
from pydantic import BaseModel, Field

import background
import config
import vector_store

try:
    import google.generativeai as genai
except ImportError:
    genai = None

logger = logging.getLogger(__name__)

_TEXT_CACHE: dict[str, str] = {}
_TASK_STATES: dict[str, dict[str, Any]] = {}
_PENDING_RESULTS: dict[str, dict[str, Any]] = {}
AUDIT_LAST_TASK: dict[str, str] = {}
_RESULT_LOCK = threading.Lock()


def bind_audit_task(audit_id: str, task_id: str) -> None:
    AUDIT_LAST_TASK[str(audit_id)] = task_id


def latest_task_for_audit(audit_id: str) -> str | None:
    return AUDIT_LAST_TASK.get(str(audit_id))


class AnalyzeRequest(BaseModel):
    audit_id: str
    audit_title: str
    audit_description: Optional[str] = None
    document_texts: list[dict[str, Any]] = Field(default_factory=list)
    document_urls: list[dict[str, Any]] = Field(default_factory=list)
    model: Optional[str] = None


def _cache_key_for_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def download_and_extract_text(filename: str, url: str) -> str:
    """Download a document and return extracted plain text."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RAG-Audit/1.0"})
        with urllib.request.urlopen(req, timeout=int(config.PDF_DOWNLOAD_TIMEOUT)) as response:
            data = response.read()
    except Exception as exc:
        logger.error("Download failed for %s: %s", filename, exc)
        return f"[download error: {exc}]"

    cache_key = _cache_key_for_bytes(data)
    if cache_key in _TEXT_CACHE:
        logger.info("Text cache hit for document hash %s", cache_key[:12])
        return _TEXT_CACHE[cache_key]

    fname_lower = filename.lower()
    text_out = ""
    try:
        if fname_lower.endswith(".pdf"):
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            text_out = "".join((p.extract_text() or "") for p in reader.pages)
            if not text_out.strip():
                text_out = f"[empty or unreadable PDF: {filename}]"
        elif fname_lower.endswith(".docx"):
            from docx import Document as DocxDoc

            doc = DocxDoc(io.BytesIO(data))
            text_out = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        elif fname_lower.endswith((".txt", ".csv")):
            text_out = data.decode("utf-8", errors="replace")
        else:
            text_out = f"[unsupported format: {filename}]"
    except Exception as exc:
        logger.error("Extraction failed for %s: %s", filename, exc)
        text_out = f"[extraction error: {exc}]"

    if not text_out.startswith("["):
        _TEXT_CACHE[cache_key] = text_out
    return text_out


def download_all_documents(url_items: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """Parallel download; returns list of (filename, text)."""
    results: list[tuple[str, str]] = []
    failed: list[str] = []

    def _one(item: dict[str, Any]) -> tuple[str, str]:
        fname = item.get("filename", "document")
        url = item.get("download_url", "")
        return fname, download_and_extract_text(fname, url)

    items = [u for u in url_items if u.get("download_url")]
    if not items:
        return results
    max_workers = max(1, int(config.MAX_PDF_WORKERS))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_one, item): item for item in items}
        for i, future in enumerate(as_completed(futures)):
            item = futures[future]
            url = item.get("download_url", "")
            try:
                fname, text = future.result(timeout=int(config.PDF_DOWNLOAD_TIMEOUT))
                results.append((fname, text))
                logger.info("%s/%s downloaded: %s", i + 1, len(futures), fname)
            except Exception as exc:
                failed.append(url)
                logger.error("Download failed for %s: %s", url, exc)
    if failed:
        logger.warning("%s PDF(s) failed: %s", len(failed), failed)
    return results


def check_ollama_available(model_key: str) -> bool:
    if config.LLM_PROVIDER == "gemini":
        return True # Handled differently
    try:
        r = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=3)
        if r.status_code != 200:
            return False
        models = [m["name"].split(":")[0] for m in r.json().get("models", [])]
        return model_key in models
    except Exception:
        return False


def parse_violations(rag_text: str) -> tuple[list[dict[str, Any]], str]:
    analyse_globale = ""
    violations: list[dict[str, Any]] = []
    
    blocks = rag_text.split("=== VIOLATION ===")
    
    # The first block contains the text before the first violation (the global analysis)
    if len(blocks) > 0:
        analyse_globale = blocks[0].replace("ANALYSE GLOBALE:", "").strip()

    if "✅ CONFORME" in rag_text and len(blocks) <= 1:
        return [], analyse_globale

    for block in blocks[1:]:
        lines = block.strip().split("\n")
        violation: dict[str, Any] = {
            "titre": "",
            "texte_original": "",
            "citation": "",
            "source": "",
            "severite": "MEDIUM",
        }
        current_field = None
        for line in lines:
            stripped = line.strip()
            if not stripped:
                continue
            if "TEXTE ORIGINAL" in stripped or stripped.startswith("📌"):
                val = stripped.split(":", 1)[-1].strip().strip('"')
                violation["texte_original"] = val
                violation["titre"] = val[:120] + ("…" if len(val) > 120 else "")
                current_field = "texte"
            elif "CITATION" in stripped or stripped.startswith("📖"):
                val = stripped.split(":", 1)[-1].strip().strip('"').strip("'")
                violation["citation"] = val
                current_field = "citation"
            elif "SOURCE" in stripped or stripped.startswith("📁"):
                val = stripped.split(":", 1)[-1].strip().strip('"')
                violation["source"] = val
                current_field = "source"
            elif current_field == "texte" and not violation["texte_original"]:
                violation["texte_original"] = stripped
                violation["titre"] = stripped[:120]
        if not violation["texte_original"] and not violation["citation"]:
            for line in lines:
                line = line.strip()
                if line and not line.startswith("==="):
                    violation["texte_original"] = line[:200]
                    violation["titre"] = line[:120]
                    break
        texte_combined = (violation["texte_original"] + " " + violation["citation"]).lower()
        if any(kw in texte_combined for kw in ["fraude", "pénal", "criminel", "nullité", "prison", "escroquerie"]):
            violation["severite"] = "CRITICAL"
        elif any(
            kw in texte_combined
            for kw in ["licenciement", "sanction", "amende", "infraction", "illégal", "interdit", "non déclaré", "non payé"]
        ):
            violation["severite"] = "HIGH"
        elif any(
            kw in texte_combined for kw in ["délai", "procédure", "formalité", "obligation", "minimum", "salaire", "capital"]
        ):
            violation["severite"] = "MEDIUM"
        else:
            violation["severite"] = "MEDIUM"
        if violation["texte_original"] or violation["citation"]:
            violations.append(violation)
    return violations, analyse_globale


def compute_risk_score(violations: list[dict[str, Any]]) -> int:
    if not violations:
        return 0
    score = 0
    for v in violations:
        s = v.get("severite", "MEDIUM")
        score += {"CRITICAL": 30, "HIGH": 20, "MEDIUM": 10, "LOW": 5}.get(s, 10)
    return min(score, 100)


def score_to_level(score: int) -> str:
    if score >= 70:
        return "CRITICAL"
    if score >= 40:
        return "HIGH"
    if score >= 20:
        return "MEDIUM"
    return "LOW"


def build_summary(violations: list, score: int, level: str) -> str:
    n = len(violations)
    if n == 0:
        return "No violation detected in the supplied documents relative to indexed Moroccan law excerpts."
    return (
        f"RAG legal review flagged {n} point(s). Risk score: {score}/100 ({level}). "
        "Findings are compared to locally indexed Moroccan legal sources."
    )


def build_recommendations(violations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    recs: list[dict[str, Any]] = []
    for v in violations:
        sev = v.get("severite", "MEDIUM")
        recs.append(
            {
                "action": f"Review compliance: {v.get('titre', '')}",
                "priorite": "IMMEDIATE" if sev == "CRITICAL" else "COURT_TERME" if sev == "HIGH" else "LONG_TERME",
                "responsable": "Auditor",
                "reference": v.get("source", ""),
            }
        )
    return recs


def build_conclusion(violations: list, score: int) -> str:
    if score < 20:
        return "Overall legal risk appears low based on retrieved Moroccan sources."
    if score < 50:
        return "Several watchpoints were identified; targeted review is recommended."
    return "Material non-conformities were detected; prompt auditor follow-up is required."


AUDIT_PROMPT_TEMPLATE = """You are an expert Moroccan legal auditor.
Compare the CLIENT DOCUMENT with the LEGAL BASE excerpts.

LEGAL BASE:
{context}

CLIENT DOCUMENT:
{question}

TASK: Perform a comprehensive and detailed legal audit.
1. Provide a detailed global ANALYSIS of the document, explaining its legal validity, context, strengths, and weaknesses under Moroccan Law. Do a full review.
2. After your detailed analysis, explicitly list any genuine non-conformities using the strict format below. If there are ZERO non-conformities, you MUST write "✅ CONFORME" and you MUST NOT output any "=== VIOLATION ===" block.

RESPONSE FORMAT:
ANALYSE GLOBALE:
[Your detailed comprehensive legal analysis here in French...]

=== VIOLATION ===
📌 TEXTE ORIGINAL : [client excerpt]
📖 CITATION EXACTE : "[Moroccan law excerpt]"
📁 SOURCE : [file name]

(Repeat the === VIOLATION === block ONLY for genuine non-conformities. Do not invent violations.)"""


def _set_task(task_id: str, **kwargs: Any) -> None:
    base = _TASK_STATES.setdefault(task_id, {"task_id": task_id})
    base.update(kwargs)


def get_task_status(task_id: str) -> dict[str, Any] | None:
    return _TASK_STATES.get(task_id)


def peek_result(task_id: str) -> dict[str, Any] | None:
    return _PENDING_RESULTS.get(task_id)


def take_result(task_id: str) -> dict[str, Any] | None:
    with _RESULT_LOCK:
        return _PENDING_RESULTS.pop(task_id, None)


def volatile_cache_size() -> int:
    return len(_PENDING_RESULTS)


def build_ollama_stream_prompt(request: AnalyzeRequest) -> tuple[str | None, str]:
    """
    Build the same prompt used for blocking analysis (retrieval + template).
    Returns (error_code, prompt). error_code is None on success.
    """
    if not (request.document_texts or request.document_urls):
        return "no_documents", ""
    model_key = request.model or config.OLLAMA_MODEL
    if not check_ollama_available(model_key):
        return "ollama_unavailable", ""

    texte_a_auditer = f"Audit mission: {request.audit_title}\n"
    if request.audit_description:
        texte_a_auditer += f"Description: {request.audit_description}\n"
    texte_a_auditer += "\n=== PROVIDED DOCUMENTS ===\n"

    for doc in request.document_texts:
        fname = doc.get("filename", "document")
        content = str(doc.get("content", "")).strip()
        if content and not content.startswith("[Contenu non disponible") and not content.startswith("[Erreur"):
            texte_a_auditer += f"\n--- {fname} ---\n"
            texte_a_auditer += content[:3000]
            if len(content) > 3000:
                texte_a_auditer += "\n[...]"

    pairs = download_all_documents(list(request.document_urls))
    for fname, content in pairs:
        if content and not content.startswith("["):
            texte_a_auditer += f"\n--- {fname} ---\n"
            texte_a_auditer += content[:3000]
            if len(content) > 3000:
                texte_a_auditer += "\n[...]"

    if len(texte_a_auditer) > 8000:
        texte_a_auditer = texte_a_auditer[:8000] + "\n[...]"

    vs = vector_store.get_vectorstore()
    if vs is None:
        return "no_index", ""

    retriever = vector_store.get_mmr_retriever(vs)
    legal_docs = retriever.invoke(texte_a_auditer)
    context_legal = ""
    for doc in legal_docs:
        nom = doc.metadata.get("nom_fichier", "unknown")
        cat = doc.metadata.get("categorie", "")
        context_legal += f"\n[SOURCE: {nom} | {cat}]\n{doc.page_content}\n"

    prompt = AUDIT_PROMPT_TEMPLATE.format(context=context_legal, question=texte_a_auditer)
    return None, prompt


def run_rag_analysis(task_id: str, request: AnalyzeRequest) -> None:
    _set_task(task_id, status="running", phase="queued", audit_id=request.audit_id, error=None)
    try:
        _set_task(task_id, phase="index_ready")
        has_docs = bool(request.document_texts) or bool(request.document_urls)
        if not has_docs:
            result = {
                "audit_id": request.audit_id,
                "model_used": "N/A",
                "analysed_at": datetime.now().isoformat(),
                "risk_score": 0,
                "risk_level": "LOW",
                "violations": [],
                "sources": [],
                "no_documents": True,
                "summary": "No document was uploaded for this audit. RAG analysis requires at least one contract or legal file.",
                "recommandations": [
                    {
                        "action": "Upload documents then run the analysis again.",
                        "priorite": "IMMEDIATE",
                        "responsable": "Auditor",
                        "reference": "",
                    }
                ],
                "conclusion": "Analysis skipped: upload documents first.",
            }
            _PENDING_RESULTS[task_id] = result
            _set_task(task_id, status="done", phase="done", report_pending=False)
            background.schedule_word_report(task_id, request.model_dump(), result)
            return

        model_key = request.model or config.OLLAMA_MODEL
        if not check_ollama_available(model_key):
            result = {
                "audit_id": request.audit_id,
                "model_used": "N/A",
                "analysed_at": datetime.now().isoformat(),
                "risk_score": 0,
                "risk_level": "LOW",
                "violations": [],
                "sources": [],
                "ollama_required": True,
                "summary": f"LLM model '{model_key}' is not available. Start Ollama and pull the model.",
                "recommandations": [
                    {
                        "action": "Install Ollama from https://ollama.ai",
                        "priorite": "IMMEDIATE",
                        "responsable": "Administrator",
                        "reference": "https://ollama.ai",
                    },
                    {
                        "action": f"Run: ollama pull {model_key}",
                        "priorite": "IMMEDIATE",
                        "responsable": "Administrator",
                        "reference": "",
                    },
                ],
                "conclusion": f"Blocked: Ollama with model '{model_key}' is required.",
            }
            _PENDING_RESULTS[task_id] = result
            _set_task(task_id, status="done", phase="done", report_pending=False)
            background.schedule_word_report(task_id, request.model_dump(), result)
            return

        _set_task(task_id, phase="downloading")
        texte_a_auditer = f"Audit mission: {request.audit_title}\n"
        if request.audit_description:
            texte_a_auditer += f"Description: {request.audit_description}\n"
        texte_a_auditer += "\n=== PROVIDED DOCUMENTS ===\n"

        for doc in request.document_texts:
            fname = doc.get("filename", "document")
            content = str(doc.get("content", "")).strip()
            if content and not content.startswith("[Contenu non disponible") and not content.startswith("[Erreur"):
                texte_a_auditer += f"\n--- {fname} ---\n"
                texte_a_auditer += content[:3000]
                if len(content) > 3000:
                    texte_a_auditer += "\n[...]"

        pairs = download_all_documents(list(request.document_urls))
        for fname, content in pairs:
            if content and not content.startswith("["):
                texte_a_auditer += f"\n--- {fname} ---\n"
                texte_a_auditer += content[:3000]
                if len(content) > 3000:
                    texte_a_auditer += "\n[...]"

        if len(texte_a_auditer) > 8000:
            texte_a_auditer = texte_a_auditer[:8000] + "\n[...]"

        _set_task(task_id, phase="retrieving")
        vs = vector_store.get_vectorstore()
        if vs is None:
            raise RuntimeError("Vector index is not available.")

        retriever = vector_store.get_mmr_retriever(vs)
        legal_docs = retriever.invoke(texte_a_auditer)

        context_legal = ""
        sources_used: list[dict[str, Any]] = []
        seen: set[str] = set()
        for doc in legal_docs:
            nom = doc.metadata.get("nom_fichier", "unknown")
            cat = doc.metadata.get("categorie", "")
            page = doc.metadata.get("page", "?")
            key = f"{nom}_p{page}"
            context_legal += f"\n[SOURCE: {nom} | {cat}]\n{doc.page_content}\n"
            if key not in seen:
                seen.add(key)
                sources_used.append(
                    {
                        "fichier": nom,
                        "categorie": cat,
                        "page": str(page),
                        "extrait": doc.page_content[:200].replace("\n", " "),
                    }
                )

        prompt = AUDIT_PROMPT_TEMPLATE.format(context=context_legal, question=texte_a_auditer)

        _set_task(task_id, phase="llm")
        try:
            if config.LLM_PROVIDER == "gemini" and genai and config.GEMINI_API_KEY:
                logger.info("Using Gemini provider for analysis")
                genai.configure(api_key=config.GEMINI_API_KEY)
                model = genai.GenerativeModel(config.GEMINI_MODEL)
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=config.TEMPERATURE,
                        max_output_tokens=config.OLLAMA_NUM_PREDICT,
                    )
                )
                rag_answer = response.text
            else:
                resp = requests.post(
                    f"{config.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": model_key,
                        "prompt": prompt,
                        "stream": False,
                        "options": {
                            "temperature": float(config.OLLAMA_TEMPERATURE),
                            "top_p": float(config.OLLAMA_TOP_P),
                            "num_predict": int(config.OLLAMA_NUM_PREDICT),
                        },
                    },
                    timeout=600,
                )
                resp.raise_for_status()
                rag_answer = resp.json().get("response", "")
        except requests.exceptions.Timeout:
            logger.error("LLM request timed out")
            rag_answer = "=== VIOLATION ===\n📌 TEXTE ORIGINAL : Analysis timeout\n📖 CITATION EXACTE : \"n/a\"\n📁 SOURCE : system"
        except Exception as exc:
            logger.error("LLM request failed: %s", exc)
            rag_answer = f"=== VIOLATION ===\n📌 TEXTE ORIGINAL : Technical error\n📖 CITATION EXACTE : \"{exc}\"\n📁 SOURCE : system"

        _set_task(task_id, phase="parsing")
        violations, analyse_globale = parse_violations(rag_answer)
        score = compute_risk_score(violations)
        level = score_to_level(score)
        model_used = f"RAG + Ollama ({model_key})"

        result = {
            "audit_id": request.audit_id,
            "model_used": model_used,
            "analysed_at": datetime.now().isoformat(),
            "risk_score": score,
            "risk_level": level,
            "analyse_globale": analyse_globale,
            "violations": violations,
            "sources": sources_used,
            "summary": build_summary(violations, score, level),
            "recommandations": build_recommendations(violations),
            "conclusion": build_conclusion(violations, score),
        }

        _PENDING_RESULTS[task_id] = result
        _set_task(task_id, status="done", phase="report", report_pending=True)
        logger.info("LLM analysis stored for task %s; scheduling Word report", task_id)
        background.schedule_word_report(task_id, request.model_dump(), result)
    except Exception as exc:
        logger.exception("Analysis failed: %s", exc)
        _set_task(task_id, status="error", phase="error", error=str(exc))

def save_streaming_result(task_id: str, audit_id: str, rag_answer: str, model_key: str) -> None:
    _set_task(task_id, status="running", phase="parsing", audit_id=audit_id, error=None)
    try:
        violations, analyse_globale = parse_violations(rag_answer)
        score = compute_risk_score(violations)
        level = score_to_level(score)
        model_used = f"RAG + Ollama ({model_key}) (Stream)"

        result = {
            "audit_id": audit_id,
            "model_used": model_used,
            "analysed_at": datetime.now().isoformat(),
            "risk_score": score,
            "risk_level": level,
            "analyse_globale": analyse_globale,
            "violations": violations,
            "sources": [],
            "summary": build_summary(violations, score, level),
            "recommandations": build_recommendations(violations),
            "conclusion": build_conclusion(violations, score),
        }

        _PENDING_RESULTS[task_id] = result
        _set_task(task_id, status="done", phase="report", report_pending=True)
        
        # Schedule word report
        # We need a dummy request dump for the report metadata
        req_dump = {"audit_id": audit_id, "audit_title": "Audit Document", "model": model_key}
        background.schedule_word_report(task_id, req_dump, result)
    except Exception as exc:
        logger.exception("Failed to save streaming result: %s", exc)
        _set_task(task_id, status="error", phase="error", error=str(exc))
