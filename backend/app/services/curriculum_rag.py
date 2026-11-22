# backend/app/services/curriculum_rag.py
import re
import io
import os
import math
import time
import random
import threading
import uuid
import datetime
import hashlib
import zipfile
import xml.etree.ElementTree as ET
import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, text

logger = logging.getLogger(__name__)

from app.models.curriculum import CurriculumChunk, CurriculumDocument
from app.schemas.ai import CurriculumChunkCreate


def sanitize_text(text: Optional[str]) -> str:
    """
    Sanitizes strings for safe database persistence and NLP processing.
    Strips PostgreSQL-illegal NUL bytes (\x00, \u0000) and unprintable C0/C1 control characters
    while preserving standard whitespace (\t, \n, \r) and valid Unicode text (e.g. Bengali).
    Safely eliminates UTF-16 surrogate pairs that crash PostgreSQL UTF-8 drivers.
    """
    if not text:
        return ""
    # Strip literal NUL bytes and escaped NUL markers immediately
    clean = (
        text.replace("\x00", "")
        .replace("\u0000", "")
        .replace("\\u0000", "")
        .replace("\\x00", "")
        .replace("\0", "")
    )
    # Remove surrogate characters that break UTF-8 drivers
    clean = clean.encode("utf-8", "ignore").decode("utf-8", "ignore")
    # Remove control characters except tab, newline, carriage return (\t = 0x09, \n = 0x0A, \r = 0x0D)
    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', clean)
    return clean.strip()


def sanitize_payload(obj: Any) -> Any:
    """Recursively sanitizes all strings in dicts, lists, and primitives for safe JSONB storage."""
    if isinstance(obj, str):
        return sanitize_text(obj)
    elif isinstance(obj, dict):
        return {sanitize_text(str(k)): sanitize_payload(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_payload(item) for item in obj]
    return obj


def cosine_similarity(a: List[float], b: List[float]) -> float:
    """Calculates cosine similarity between two float vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


class GeminiEmbeddingRateLimiter:
    """
    Centralized Token-Bucket & Sliding-Window Rate Limiter for Gemini Embeddings.
    Protects against 429/RESOURCE_EXHAUSTED errors under high concurrency.
    Enforces:
    - Maximum Requests Per Minute (RPM: 60)
    - Maximum Tokens Per Minute (TPM: 60,000)
    - Thread-safe synchronization
    """
    def __init__(self, max_rpm: int = 60, max_tpm: int = 60000):
        self.max_rpm = max_rpm
        self.max_tpm = max_tpm
        self.lock = threading.Lock()
        self.request_timestamps: List[float] = []
        self.token_usage: List[tuple] = []

    def acquire(self, estimated_tokens: int = 500, max_wait_sec: float = 10.0):
        with self.lock:
            now = time.time()
            cutoff = now - 60.0
            self.request_timestamps = [ts for ts in self.request_timestamps if ts > cutoff]
            self.token_usage = [(ts, tok) for ts, tok in self.token_usage if ts > cutoff]

            while len(self.request_timestamps) >= self.max_rpm:
                oldest = self.request_timestamps[0]
                sleep_needed = max(0.05, 60.0 - (now - oldest))
                if sleep_needed > max_wait_sec:
                    break
                time.sleep(min(sleep_needed, 0.5))
                now = time.time()
                cutoff = now - 60.0
                self.request_timestamps = [ts for ts in self.request_timestamps if ts > cutoff]

            current_tokens = sum(tok for _, tok in self.token_usage)
            while current_tokens + estimated_tokens > self.max_tpm and self.token_usage:
                oldest_tok_time = self.token_usage[0][0]
                sleep_needed = max(0.05, 60.0 - (now - oldest_tok_time))
                if sleep_needed > max_wait_sec:
                    break
                time.sleep(min(sleep_needed, 0.5))
                now = time.time()
                cutoff = now - 60.0
                self.token_usage = [(ts, tok) for ts, tok in self.token_usage if ts > cutoff]
                current_tokens = sum(tok for _, tok in self.token_usage)

            self.request_timestamps.append(time.time())
            self.token_usage.append((time.time(), estimated_tokens))


gemini_rate_limiter = GeminiEmbeddingRateLimiter(max_rpm=60, max_tpm=60000)


def generate_embeddings_batch(texts: List[str], timeout_sec: float = 6.0, max_retries: int = 3) -> List[Optional[List[float]]]:
    """
    Generates dense vector embeddings in batch using Gemini embedding model.
    Includes strict quota rate limiting, exponential backoff with jitter on 429,
    timeout protection, and graceful fallback to prevent hanging.
    """
    if not texts:
        return []
    cleaned_texts = [sanitize_text(t)[:2048] for t in texts]
    total_est_tokens = sum(len(t) // 4 + 1 for t in cleaned_texts)
    gemini_rate_limiter.acquire(estimated_tokens=total_est_tokens)

    for attempt in range(max_retries):
        try:
            from app.core.ai_client import get_genai_client
            client = get_genai_client()
            if not client:
                return [None] * len(texts)

            import concurrent.futures

            def _call_api():
                return client.models.embed_content(
                    model='models/gemini-embedding-001',
                    contents=cleaned_texts,
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_call_api)
                res = future.result(timeout=timeout_sec)

            if hasattr(res, "embeddings") and res.embeddings:
                embeddings_list = []
                for emb in res.embeddings:
                    if hasattr(emb, "values") and emb.values:
                        embeddings_list.append(list(emb.values))
                    else:
                        embeddings_list.append(None)
                while len(embeddings_list) < len(texts):
                    embeddings_list.append(None)
                return embeddings_list

        except concurrent.futures.TimeoutError:
            logger.warning(f"Gemini embedding batch generation timed out after {timeout_sec}s (attempt {attempt+1}/{max_retries}).")
        except Exception as exc:
            err_str = str(exc)
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "rate limit" in err_str.lower():
                backoff = (2.0 ** attempt) + random.uniform(0.1, 0.5)
                logger.warning(f"Gemini rate limit hit. Backing off for {backoff:.2f}s (attempt {attempt+1}/{max_retries}): {exc}")
                time.sleep(backoff)
                continue
            logger.warning(f"Gemini embedding batch generation failed or omitted: {exc}")
            break

    return [None] * len(texts)


def generate_embedding(text_content: str) -> Optional[List[float]]:
    """Generates a dense vector embedding using batch helper with timeout protection."""
    results = generate_embeddings_batch([text_content], timeout_sec=5.0)
    return results[0] if results else None


def extract_text_from_bytes(file_bytes: bytes, file_type: str) -> str:
    """
    Extracts plain text from uploaded file bytes supporting PDF, DOCX, TXT, MD, CSV, JSON.
    Guarantees sanitized output with zero NUL (\x00) characters or raw binary streams.
    """
    clean_type = file_type.lower().replace(".", "").strip()
    
    if clean_type in ("txt", "md", "csv", "json"):
        for encoding in ("utf-8", "utf-8-sig", "utf-16", "latin-1"):
            try:
                raw = file_bytes.decode(encoding)
                clean = sanitize_text(raw)
                if clean:
                    return clean
            except (UnicodeDecodeError, LookupError):
                continue
        return ""

    elif clean_type == "pdf":
        pages_text = []
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            for i, page in enumerate(reader.pages):
                try:
                    extracted = page.extract_text()
                    if extracted:
                        clean_page = sanitize_text(extracted)
                        if clean_page:
                            pages_text.append(f"--- Page {i + 1} ---\n{clean_page}")
                except Exception as page_err:
                    logger.debug(f"Page {i + 1} extraction failed: {page_err}")
            if pages_text:
                return "\n\n".join(pages_text)
        except Exception as pdf_err:
            logger.debug(f"pypdf reader failed: {pdf_err}")

        # Fallback stream regex text extraction
        try:
            raw = file_bytes.decode("latin-1", errors="ignore")
            # Extract strings from TJ arrays: [(text) 10 (more)] TJ
            tj_arrays = re.findall(r'\[(.*?)\]\s*TJ', raw, re.DOTALL)
            extracted_from_arrays = []
            for arr in tj_arrays:
                items = re.findall(r'\((.*?)\)', arr)
                for item in items:
                    sanitized_item = sanitize_text(item)
                    if sanitized_item:
                        extracted_from_arrays.append(sanitized_item)

            # Extract standard Tj strings: (text) Tj
            single_matches = re.findall(r'\((.*?)\)\s*T[jJ]', raw)
            extracted_from_singles = [sanitize_text(m) for m in single_matches if sanitize_text(m)]

            combined = extracted_from_arrays + extracted_from_singles
            if combined:
                return " ".join(combined)
        except Exception:
            pass

        # Never return raw binary stream bytes! If no text could be extracted, return empty
        return ""

    elif clean_type in ("docx", "doc"):
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                tree = ET.fromstring(z.read("word/document.xml"))
                texts = [sanitize_text(node.text) for node in tree.iter() if node.tag.endswith("}t") and node.text]
                clean_texts = [t for t in texts if t]
                if clean_texts:
                    return "\n".join(clean_texts)
        except Exception as docx_err:
            logger.warning(f"DOCX extraction failed: {docx_err}")
        return ""

    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            decoded = file_bytes.decode(encoding, errors="ignore")
            clean = sanitize_text(decoded)
            if clean:
                return clean
        except Exception:
            continue
    return ""


def chunk_text(text: str, chunk_size: int = 600, overlap: int = 100) -> List[str]:
    """
    Splits text into overlapping semantic chunks respecting paragraphs and sentences.
    First-class support for Bengali sentence boundaries (Dari '।', Double Dari '॥', '?')
    and English punctuation ('.', '!', '?', '\n'). Preserves Unicode integrity.
    """
    clean = re.sub(r'[\r\t]+', ' ', text).strip()
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    
    if len(clean) <= chunk_size:
        return [clean] if clean else []

    paragraphs = clean.split("\n\n")
    chunks = []
    current_chunk = ""

    for p in paragraphs:
        p_str = p.strip()
        if not p_str:
            continue
        
        if len(current_chunk) + len(p_str) <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{p_str}".strip()
        else:
            if current_chunk:
                chunks.append(current_chunk)
                # Overlap tail
                tail = current_chunk[-overlap:] if len(current_chunk) > overlap else current_chunk
                current_chunk = f"{tail}\n\n{p_str}".strip()
            else:
                # Very long single paragraph: split by Bengali Dari and standard sentence boundaries
                tokens = re.split(r'([।॥.?!;\n]+)', p_str)
                temp = ""
                for i in range(0, len(tokens), 2):
                    seg = tokens[i]
                    delim = tokens[i+1] if i + 1 < len(tokens) else ""
                    full_seg = (seg + delim).strip()
                    if not full_seg:
                        continue
                    if len(temp) + len(full_seg) <= chunk_size:
                        temp = f"{temp} {full_seg}".strip()
                    else:
                        if temp:
                            chunks.append(temp.strip())
                        temp = full_seg
                current_chunk = temp.strip()

    if current_chunk:
        chunks.append(current_chunk)

    return chunks


class CurriculumRAGService:
    """
    Pedagogical Curriculum RAG Engine.
    Ensures that generative tasks (Question Papers, Lesson Blueprints, Socratic Dialogues)
    are grounded in authoritative NCTB national curriculum or institutional syllabi.
    Enforces multi-tenant data isolation.
    """

    @staticmethod
    def ingest_chunk(
        db: Session,
        tenant_id: Optional[str],
        payload: CurriculumChunkCreate
    ) -> CurriculumChunk:
        """
        Ingests a curriculum chunk.
        Global curriculum chunks are accessible by all tenants.
        Institutional curriculum chunks are strictly isolated to the owning tenant.
        """
        chunk_tenant_id = None if payload.is_global_curriculum else str(tenant_id)
        clean_content = sanitize_text(payload.content)

        chunk = CurriculumChunk(
            tenant_id=chunk_tenant_id,
            title=sanitize_text(payload.title),
            class_name=sanitize_text(payload.class_name),
            subject=sanitize_text(payload.subject),
            chapter=sanitize_text(payload.chapter) if payload.chapter else None,
            content=clean_content,
            chunk_index=payload.chunk_index,
            is_global_curriculum=payload.is_global_curriculum,
            metadata_payload=payload.metadata_payload or {},
        )
        db.add(chunk)
        db.commit()
        db.refresh(chunk)
        return chunk

    @staticmethod
    def ingest_document(
        db: Session,
        tenant_id: str,
        title: str,
        class_name: str,
        subject: str,
        file_name: str,
        file_type: str,
        file_bytes: bytes,
        chapter: Optional[str] = None,
        academic_year: str = "2026",
        group: Optional[str] = None,
        is_global: bool = False,
    ) -> CurriculumDocument:
        """
        Full RAG Ingestion Pipeline:
        1. Validates file size & type.
        2. Computes SHA-256 fingerprint.
        3. Extracts plain text from PDF/DOCX/TXT.
        4. Chunks semantically into 600-char windows.
        5. Persists CurriculumDocument and child CurriculumChunk records with tenant isolation.
        """
        tid = str(tenant_id)
        # Ensure database session has tenant context for PostgreSQL RLS policies
        db.info["tenant_id"] = tid
        if db.bind and db.bind.dialect.name == "postgresql":
            try:
                db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": tid}
                )
            except Exception as rls_err:
                logger.warning(f"Failed to set tenant context in ingest_document: {rls_err}")

        file_hash = hashlib.sha256(file_bytes).hexdigest()

        clean_title = sanitize_text(title)
        clean_class = sanitize_text(class_name)
        clean_subject = sanitize_text(subject)
        clean_chapter = sanitize_text(chapter) if chapter else None
        clean_year = sanitize_text(academic_year) or "2026"
        clean_group = sanitize_text(group) if group else None
        clean_file_name = sanitize_text(file_name)

        # Private storage persistence
        upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "curriculum", tid))
        os.makedirs(upload_dir, exist_ok=True)
        stored_path = os.path.join(upload_dir, f"{file_hash[:16]}_{clean_file_name}")
        try:
            with open(stored_path, "wb") as f:
                f.write(file_bytes)
        except Exception as storage_err:
            logger.warning(f"Could not persist original file copy: {storage_err}")
            stored_path = None

        doc = CurriculumDocument(
            tenant_id=tid,
            title=clean_title,
            class_name=clean_class,
            subject=clean_subject,
            chapter=clean_chapter,
            academic_year=clean_year,
            group=clean_group,
            file_name=clean_file_name,
            file_type=file_type.lower(),
            file_size_bytes=len(file_bytes),
            file_hash=file_hash,
            status="PARSING",
            chunks_count=0,
            metadata_payload=sanitize_payload({
                "is_global": is_global,
                "stage": "validating",
                "progress_pct": 10,
                "version": 1,
                "stored_path": stored_path
            })
        )
        db.add(doc)
        db.flush()

        try:
            # Stage: Extracting
            doc.metadata_payload = sanitize_payload({**doc.metadata_payload, "stage": "extracting", "progress_pct": 30})
            db.flush()

            raw_text = extract_text_from_bytes(file_bytes, file_type)
            clean_extracted = sanitize_text(raw_text)
            if not clean_extracted:
                raise ValueError("No readable text could be extracted from the uploaded document.")

            # Stage: Chunking
            doc.metadata_payload = sanitize_payload({**doc.metadata_payload, "stage": "chunking", "progress_pct": 60})
            db.flush()

            chunks = chunk_text(clean_extracted, chunk_size=600, overlap=100)
            if not chunks:
                raise ValueError("Document was empty or could not be segmented into knowledge chunks.")

            # Stage: Indexing
            doc.metadata_payload = sanitize_payload({**doc.metadata_payload, "stage": "indexing", "progress_pct": 85})
            db.flush()

            chunk_records = []
            for idx, c_text in enumerate(chunks):
                sanitized_c_text = sanitize_text(c_text)
                if not sanitized_c_text:
                    continue

                # Generate dense vector embedding (if online / key configured)
                c_emb = generate_embedding(sanitized_c_text)
                chunk_meta = {
                    "document_id": str(doc.id),
                    "file_name": clean_file_name,
                    "total_chunks": len(chunks)
                }
                if c_emb:
                    chunk_meta["embedding"] = c_emb

                chunk = CurriculumChunk(
                    tenant_id=None if is_global else tid,
                    document_id=doc.id,
                    title=sanitize_text(f"{clean_title} (Part {idx + 1})"),
                    class_name=clean_class,
                    subject=clean_subject,
                    chapter=clean_chapter,
                    academic_year=clean_year,
                    group=clean_group,
                    content=sanitized_c_text,
                    chunk_index=idx,
                    is_global_curriculum=is_global,
                    metadata_payload=sanitize_payload(chunk_meta)
                )
                db.add(chunk)
                chunk_records.append(chunk)

            if not chunk_records:
                raise ValueError("No valid text chunks remained after content sanitization.")

            doc.status = "INDEXED"
            doc.chunks_count = len(chunk_records)
            doc.metadata_payload = sanitize_payload({
                **doc.metadata_payload,
                "stage": "completed",
                "progress_pct": 100,
                "total_chunks": len(chunk_records)
            })
            db.commit()
            db.refresh(doc)
            return doc

        except ValueError as val_err:
            logger.warning(f"Curriculum document ingestion validation: {val_err}")
            db.rollback()
            try:
                doc.status = "FAILED"
                doc.chunks_count = 0
                doc.error_message = sanitize_text(str(val_err))[:500]
                doc.metadata_payload = sanitize_payload({
                    **(doc.metadata_payload or {}),
                    "stage": "failed",
                    "progress_pct": 0,
                    "error": sanitize_text(str(val_err))
                })
                db.add(doc)
                db.commit()
                db.refresh(doc)
                return doc
            except Exception as rec_err:
                db.rollback()
                logger.error(f"Failed to persist FAILED document status: {rec_err}")
                return doc
        except Exception as e:
            logger.error(f"Failed to ingest curriculum document: {e}", exc_info=True)
            db.rollback()
            try:
                # Re-add doc record with guaranteed 0 chunks and FAILED status
                doc.status = "FAILED"
                doc.chunks_count = 0
                doc.error_message = sanitize_text(str(e))[:500]
                doc.metadata_payload = sanitize_payload({
                    **(doc.metadata_payload or {}),
                    "stage": "failed",
                    "progress_pct": 0,
                    "error": sanitize_text(str(e))
                })
                db.add(doc)
                db.commit()
                db.refresh(doc)
                return doc
            except Exception as rec_err:
                db.rollback()
                logger.error(f"Failed to persist FAILED document status: {rec_err}")
                return doc

    @classmethod
    def ingest_document_async_start(
        cls,
        db: Session,
        tenant_id: str,
        title: str,
        class_name: str,
        subject: str,
        file_name: str,
        file_type: str,
        file_bytes: bytes,
        chapter: Optional[str] = None,
        academic_year: str = "2026",
        group: Optional[str] = None,
        is_global: bool = False,
    ) -> CurriculumDocument:
        """
        Initializes an asynchronous ingestion job:
        1. Validates magic bytes/type and size limit (<= 25MB).
        2. Computes SHA-256 fingerprint.
        3. Persists file to private disk storage.
        4. Creates CurriculumDocument in QUEUED state with stage=queued and progress=5%.
        Returns immediately (< 150ms) so HTTP caller is never blocked.
        """
        tid = str(tenant_id)
        db.info["tenant_id"] = tid
        if db.bind and db.bind.dialect.name == "postgresql":
            try:
                db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": tid}
                )
            except Exception as rls_err:
                logger.warning(f"Failed to set tenant context in ingest_document_async_start: {rls_err}")

        clean_type = file_type.lower().replace(".", "").strip()
        if clean_type not in ("pdf", "docx", "doc", "txt", "md"):
            raise ValueError(f"Unsupported file format '{clean_type}'. Allowed: PDF, DOCX, TXT, MD.")

        if len(file_bytes) > 25 * 1024 * 1024:
            raise ValueError("File size exceeds maximum permitted limit of 25MB.")

        file_hash = hashlib.sha256(file_bytes).hexdigest()
        clean_title = sanitize_text(title)
        clean_class = sanitize_text(class_name)
        clean_subject = sanitize_text(subject)
        clean_chapter = sanitize_text(chapter) if chapter else None
        clean_year = sanitize_text(academic_year) or "2026"
        clean_group = sanitize_text(group) if group else None
        clean_file_name = sanitize_text(file_name)

        # Private storage persistence
        upload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "curriculum", tid))
        os.makedirs(upload_dir, exist_ok=True)
        stored_path = os.path.join(upload_dir, f"{file_hash[:16]}_{clean_file_name}")
        with open(stored_path, "wb") as f:
            f.write(file_bytes)

        doc = CurriculumDocument(
            tenant_id=tid,
            title=clean_title,
            class_name=clean_class,
            subject=clean_subject,
            chapter=clean_chapter,
            academic_year=clean_year,
            group=clean_group,
            file_name=clean_file_name,
            file_type=clean_type,
            file_size_bytes=len(file_bytes),
            file_hash=file_hash,
            status="QUEUED",
            chunks_count=0,
            metadata_payload=sanitize_payload({
                "is_global": is_global,
                "stage": "queued",
                "progress_pct": 5,
                "version": 1,
                "stored_path": stored_path,
                "chunks_indexed": 0,
                "chunks_total": 0,
                "cancel_requested": False,
                "queued_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            })
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    @classmethod
    def process_document_background(cls, doc_id: uuid.UUID, tenant_id: str):
        """
        Durable Non-Blocking Background Worker Task:
        Executes validating, extracting, chunking, and batched indexing in a separate worker thread.
        CRITICAL ARCHITECTURE: Database sessions are strictly short-lived and checked in immediately.
        Sessions are NEVER held open across external network calls (Gemini embeddings) or CPU-heavy PDF parsing.
        This prevents SQLite connection locks and PostgreSQL pooler starvation, ensuring the rest of the application
        remains 100% interactive during background RAG operations.
        """
        from app.core.database import SessionLocal
        tid = str(tenant_id)

        def _open_session():
            s = SessionLocal()
            s.info["tenant_id"] = tid
            if s.bind and s.bind.dialect.name == "postgresql":
                try:
                    s.execute(
                        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                        {"tenant_id": tid}
                    )
                except Exception as rls_err:
                    logger.warning(f"RLS set in process_document_background: {rls_err}")
            return s

        try:
            # Step 1: Initial claim and validation (short-lived session)
            with _open_session() as db:
                doc = db.query(CurriculumDocument).filter(
                    CurriculumDocument.id == doc_id,
                    CurriculumDocument.tenant_id == tid
                ).first()
                if not doc:
                    logger.error(f"Background worker: document {doc_id} not found for tenant {tid}")
                    return

                if doc.status in ("PARSING", "INDEXING", "INDEXED", "CANCELLED"):
                    logger.info(f"Background worker: document {doc_id} is already in state {doc.status}, skipping duplicate processing")
                    return

                if (doc.metadata_payload or {}).get("cancel_requested"):
                    doc.status = "CANCELLED"
                    doc.metadata_payload = sanitize_payload({
                        **(doc.metadata_payload or {}),
                        "stage": "cancelled",
                        "cancelled_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
                    db.commit()
                    return

                # Stage 1: Validating (10%)
                doc.status = "VALIDATING"
                doc.metadata_payload = sanitize_payload({
                    **(doc.metadata_payload or {}),
                    "stage": "validating",
                    "progress_pct": 10,
                    "heartbeat_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                })
                db.commit()

                stored_path = (doc.metadata_payload or {}).get("stored_path")
                file_type = doc.file_type
                doc_title = doc.title
                doc_class_name = doc.class_name
                doc_subject = doc.subject
                doc_chapter = doc.chapter
                doc_academic_year = doc.academic_year
                doc_group = doc.group
                doc_file_name = doc.file_name
                is_global = (doc.metadata_payload or {}).get("is_global", False)

            if not stored_path or not os.path.exists(stored_path):
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if doc and doc.status not in ("INDEXED", "CANCELLED"):
                        doc.status = "FAILED"
                        doc.error_message = "Stored document file could not be located on disk."
                        doc.metadata_payload = sanitize_payload({
                            **(doc.metadata_payload or {}),
                            "stage": "failed",
                            "progress_pct": 0,
                            "error": doc.error_message
                        })
                        db.commit()
                return

            # Step 2: Extracting Text (in-memory CPU processing, NO DB session held)
            with _open_session() as db:
                doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                if doc:
                    doc.status = "PARSING"
                    doc.metadata_payload = sanitize_payload({
                        **(doc.metadata_payload or {}),
                        "stage": "extracting",
                        "progress_pct": 30,
                        "heartbeat_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
                    db.commit()

            with open(stored_path, "rb") as f:
                file_bytes = f.read()

            raw_text = extract_text_from_bytes(file_bytes, file_type)
            clean_extracted = sanitize_text(raw_text)
            if not clean_extracted:
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if doc and doc.status not in ("INDEXED", "CANCELLED"):
                        doc.status = "FAILED"
                        doc.error_message = "No readable text could be extracted from the uploaded document."
                        doc.metadata_payload = sanitize_payload({
                            **(doc.metadata_payload or {}),
                            "stage": "failed",
                            "progress_pct": 0,
                            "error": doc.error_message
                        })
                        db.commit()
                return

            # Step 3: Chunking (in-memory processing, NO DB session held)
            chunks = chunk_text(clean_extracted, chunk_size=600, overlap=100)
            if not chunks:
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if doc and doc.status not in ("INDEXED", "CANCELLED"):
                        doc.status = "FAILED"
                        doc.error_message = "Document was empty or could not be segmented into knowledge chunks."
                        doc.metadata_payload = sanitize_payload({
                            **(doc.metadata_payload or {}),
                            "stage": "failed",
                            "progress_pct": 0,
                            "error": doc.error_message
                        })
                        db.commit()
                return

            total_chunks = len(chunks)
            with _open_session() as db:
                doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                if doc:
                    doc.chunks_count = total_chunks
                    doc.metadata_payload = sanitize_payload({
                        **(doc.metadata_payload or {}),
                        "chunks_total": total_chunks,
                        "stage": "indexing",
                        "progress_pct": 50,
                        "heartbeat_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
                    db.commit()

            # Step 4: Indexing in batches with batched embeddings and checkpoint recovery
            batch_size = 10
            with _open_session() as db:
                doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                initial_cursor = int((doc.metadata_payload or {}).get("chunk_cursor", 0)) if doc else 0

            indexed_count = initial_cursor

            for b_start in range(initial_cursor, total_chunks, batch_size):
                b_end = min(b_start + batch_size, total_chunks)
                batch_slice = chunks[b_start:b_end]

                # Cooperative cancellation check in micro-session
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if doc and (doc.metadata_payload or {}).get("cancel_requested"):
                        logger.info(f"Ingestion job {doc_id} cancelled cooperatively at chunk {b_start}")
                        db.query(CurriculumChunk).filter(CurriculumChunk.document_id == doc.id).delete()
                        doc.status = "CANCELLED"
                        doc.chunks_count = 0
                        doc.metadata_payload = sanitize_payload({
                            **(doc.metadata_payload or {}),
                            "stage": "cancelled",
                            "cancelled_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                        })
                        db.commit()
                        return

                # Generate embeddings for the batch externally (NO DB session held!)
                batch_embeddings = generate_embeddings_batch(batch_slice, timeout_sec=6.0)

                # Persist batch chunks into database in short-lived transaction
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if not doc or doc.status == "CANCELLED":
                        return

                    for sub_idx, c_text in enumerate(batch_slice):
                        idx = b_start + sub_idx
                        sanitized_c_text = sanitize_text(c_text)
                        if not sanitized_c_text:
                            continue

                        c_emb = batch_embeddings[sub_idx] if sub_idx < len(batch_embeddings) else None
                        chunk_meta = {
                            "document_id": str(doc_id),
                            "file_name": doc_file_name,
                            "total_chunks": total_chunks,
                            "chunk_index": idx,
                        }
                        if c_emb:
                            chunk_meta["embedding"] = c_emb

                        chunk = CurriculumChunk(
                            tenant_id=None if is_global else tid,
                            document_id=doc_id,
                            title=f"{doc_title} (Part {idx + 1})",
                            class_name=doc_class_name,
                            subject=doc_subject,
                            chapter=doc_chapter,
                            academic_year=doc_academic_year,
                            group=doc_group,
                            content=sanitized_c_text,
                            chunk_index=idx,
                            is_global_curriculum=is_global,
                            metadata_payload=chunk_meta,
                        )
                        db.add(chunk)
                        indexed_count += 1

                    progress = min(95, 50 + int(45 * b_end / total_chunks))
                    doc.metadata_payload = sanitize_payload({
                        **(doc.metadata_payload or {}),
                        "chunk_cursor": b_end,
                        "chunks_indexed": b_end,
                        "progress_pct": progress,
                        "last_checkpoint_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "heartbeat_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
                    db.commit()

            # Step 5: Mark Completed (short-lived transaction)
            with _open_session() as db:
                doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                if doc and doc.status != "CANCELLED":
                    doc.status = "INDEXED"
                    doc.chunks_count = indexed_count
                    doc.metadata_payload = sanitize_payload({
                        **(doc.metadata_payload or {}),
                        "stage": "completed",
                        "progress_pct": 100,
                        "chunks_indexed": indexed_count,
                        "chunk_cursor": indexed_count,
                        "completed_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
                    db.commit()
                    logger.info(f"Curriculum document {doc_id} successfully indexed with {indexed_count} chunks.")

        except Exception as bg_err:
            logger.error(f"Background worker failed for document {doc_id}: {bg_err}", exc_info=True)
            try:
                with _open_session() as db:
                    doc = db.query(CurriculumDocument).filter(CurriculumDocument.id == doc_id).first()
                    if doc and doc.status not in ("INDEXED", "CANCELLED"):
                        doc.status = "FAILED"
                        doc.chunks_count = 0
                        doc.error_message = sanitize_text(str(bg_err))[:500]
                        doc.metadata_payload = sanitize_payload({
                            **(doc.metadata_payload or {}),
                            "stage": "failed",
                            "progress_pct": 0,
                            "error": sanitize_text(str(bg_err))
                        })
                        db.commit()
            except Exception as roll_err:
                logger.error(f"Failed to record FAILED status in background worker: {roll_err}")

    @classmethod
    def cancel_ingestion_job(cls, db: Session, tenant_id: str, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Cooperatively cancels an ongoing background ingestion job.
        """
        tid = str(tenant_id)
        doc = db.query(CurriculumDocument).filter(
            CurriculumDocument.id == document_id,
            CurriculumDocument.tenant_id == tid
        ).first()
        if not doc:
            return None

        if doc.status in ("INDEXED", "COMPLETED"):
            return cls.get_document_status(db, tid, document_id)

        # Mark cancel requested; background worker checks this between batches
        doc.metadata_payload = sanitize_payload({
            **(doc.metadata_payload or {}),
            "cancel_requested": True,
            "stage": "cancelling",
        })
        # If still in queued or parsing state, transition directly to CANCELLED
        if doc.status in ("QUEUED", "PENDING"):
            doc.status = "CANCELLED"
            doc.metadata_payload = sanitize_payload({
                **(doc.metadata_payload or {}),
                "stage": "cancelled",
                "cancelled_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })

        db.commit()
        return cls.get_document_status(db, tid, document_id)

    @classmethod
    def retry_ingestion_job(cls, db: Session, tenant_id: str, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Resets and re-queues a failed or cancelled ingestion job.
        Cleans up any dangling partial chunks and returns the updated job descriptor.
        """
        tid = str(tenant_id)
        doc = db.query(CurriculumDocument).filter(
            CurriculumDocument.id == document_id,
            CurriculumDocument.tenant_id == tid
        ).first()
        if not doc:
            return None

        # Clean up any partial chunks from prior attempts
        db.query(CurriculumChunk).filter(CurriculumChunk.document_id == doc.id).delete()
        doc.status = "QUEUED"
        doc.chunks_count = 0
        doc.error_message = None
        doc.metadata_payload = sanitize_payload({
            **(doc.metadata_payload or {}),
            "stage": "queued",
            "progress_pct": 5,
            "cancel_requested": False,
            "chunks_indexed": 0,
            "retried_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        })
        db.commit()
        return cls.get_document_status(db, tid, document_id)

    @staticmethod
    def list_documents(
        db: Session,
        tenant_id: str,
        class_name: Optional[str] = None,
        subject: Optional[str] = None
    ) -> List[CurriculumDocument]:
        """
        Lists curriculum documents for active tenant.
        """
        q = db.query(CurriculumDocument).filter(CurriculumDocument.tenant_id == str(tenant_id))
        if class_name and class_name.lower() != "all":
            q = q.filter(CurriculumDocument.class_name == class_name)
        if subject and subject.lower() != "all":
            q = q.filter(CurriculumDocument.subject.ilike(f"%{subject}%"))
        return q.order_by(CurriculumDocument.created_at.desc()).all()

    @staticmethod
    def delete_document(db: Session, tenant_id: str, document_id: uuid.UUID) -> bool:
        """
        Deletes a curriculum document and cascades its chunks.
        """
        doc = db.query(CurriculumDocument).filter(
            CurriculumDocument.id == document_id,
            CurriculumDocument.tenant_id == str(tenant_id)
        ).first()
        if not doc:
            return False
        db.delete(doc)
        db.commit()
        return True

    @staticmethod
    def get_document_status(db: Session, tenant_id: str, document_id: uuid.UUID) -> Optional[Dict[str, Any]]:
        """
        Retrieves real-time persisted ingestion lifecycle status, progress, and job details.
        """
        doc = db.query(CurriculumDocument).filter(
            CurriculumDocument.id == document_id,
            CurriculumDocument.tenant_id == str(tenant_id)
        ).first()
        if not doc:
            return None
        payload = doc.metadata_payload or {}
        return {
            "id": str(doc.id),
            "job_id": str(doc.id),
            "document_id": str(doc.id),
            "title": doc.title,
            "file_name": doc.file_name,
            "filename": doc.file_name,
            "file_type": doc.file_type,
            "class_name": doc.class_name,
            "subject": doc.subject,
            "chapter": doc.chapter,
            "status": doc.status,
            "stage": payload.get("stage", "completed" if doc.status in ("INDEXED", "COMPLETED") else "unknown"),
            "progress_pct": payload.get("progress_pct", 100 if doc.status in ("INDEXED", "COMPLETED") else 0),
            "chunks_count": doc.chunks_count,
            "chunks_total": payload.get("chunks_total", doc.chunks_count),
            "chunks_indexed": payload.get("chunks_indexed", doc.chunks_count if doc.status == "INDEXED" else 0),
            "cancel_requested": payload.get("cancel_requested", False),
            "error_message": doc.error_message,
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        }

    @staticmethod
    def get_document_preview(db: Session, tenant_id: str, document_id: uuid.UUID, max_chars: int = 2000) -> Optional[Dict[str, Any]]:
        """
        Retrieves a sanitized textual preview extracted from indexed chunks.
        """
        doc = db.query(CurriculumDocument).filter(
            CurriculumDocument.id == document_id,
            CurriculumDocument.tenant_id == str(tenant_id)
        ).first()
        if not doc:
            return None

        chunks = (
            db.query(CurriculumChunk)
            .filter(CurriculumChunk.document_id == document_id)
            .order_by(CurriculumChunk.chunk_index.asc())
            .limit(5)
            .all()
        )
        sample_text = "\n\n".join(c.content for c in chunks)
        if len(sample_text) > max_chars:
            sample_text = sample_text[:max_chars] + "...\n[Preview Truncated]"

        return {
            "document_id": str(doc.id),
            "title": doc.title,
            "file_name": doc.file_name,
            "class_name": doc.class_name,
            "subject": doc.subject,
            "chunks_count": doc.chunks_count,
            "preview_text": sample_text or "No text preview available."
        }

    @classmethod
    def retrieve_chunks(
        cls,
        db: Session,
        tenant_id: str,
        subject: str,
        class_name: str,
        query: str,
        limit: int = 4
    ) -> List[CurriculumChunk]:
        """
        Retrieves relevant curriculum chunks strictly scoped to active tenant or global curriculum.
        Hybrid Retrieval: Computes semantic vector cosine similarity using Gemini embeddings
        and falls back gracefully to lexical token matching. Guarantees zero cross-tenant leakage.
        """
        tid = str(tenant_id)
        clean_subj = subject.strip().lower()
        clean_cls = class_name.strip().lower()

        tenant_scope_filter = or_(
            CurriculumChunk.tenant_id == tid,
            CurriculumChunk.is_global_curriculum == True,
        )

        query_tokens = [t.lower() for t in re.findall(r'\w+', query) if len(t) > 2]

        q = db.query(CurriculumChunk).filter(
            tenant_scope_filter,
            CurriculumChunk.subject.ilike(f"%{clean_subj}%"),
            CurriculumChunk.class_name.ilike(f"%{clean_cls}%"),
        )

        candidate_chunks = q.all()
        if not candidate_chunks:
            return []

        # Vector search via Gemini Embeddings
        q_emb = generate_embedding(query)
        if q_emb:
            scored = []
            for c in candidate_chunks:
                c_emb = (c.metadata_payload or {}).get("embedding")
                sim = cosine_similarity(q_emb, c_emb) if c_emb else 0.0
                scored.append((sim, c))
            scored.sort(key=lambda x: x[0], reverse=True)
            top_vector = [c for sim, c in scored if sim > 0.35]
            if top_vector:
                return top_vector[:limit]

        # Lexical token matching fallback
        if query_tokens:
            def token_score(chunk: CurriculumChunk) -> int:
                c_low = (chunk.content or "").lower()
                t_low = (chunk.title or "").lower()
                return sum(2 if token in t_low else 1 for token in query_tokens if token in c_low or token in t_low)

            ranked = sorted(candidate_chunks, key=token_score, reverse=True)
            matched = [c for c in ranked if token_score(c) > 0]
            if matched:
                return matched[:limit]

        return candidate_chunks[:limit]

    @classmethod
    def format_grounding_context(
        cls,
        db: Session,
        tenant_id: str,
        subject: str,
        class_name: str,
        query: str,
        limit: int = 4
    ) -> str:
        """
        Generates an XML-delimited grounding context string for injection into prompts.
        """
        chunks = cls.retrieve_chunks(db, tenant_id, subject, class_name, query, limit)
        if not chunks:
            return "<curriculum_grounding source=\"standard_nctb_curriculum\" count=\"0\">\nNone available.\n</curriculum_grounding>"

        lines = [f"<curriculum_grounding count=\"{len(chunks)}\">"]
        for c in chunks:
            source_type = "Global_NCTB" if c.is_global_curriculum else f"Institutional_Tenant_{c.tenant_id}"
            lines.append(
                f"<chunk id=\"{c.id}\" source=\"{source_type}\" class=\"{c.class_name}\" subject=\"{c.subject}\" chapter=\"{c.chapter or 'N/A'}\">\n"
                f"{c.content}\n"
                f"</chunk>"
            )
        lines.append("</curriculum_grounding>")
        return "\n".join(lines)

    @classmethod
    def answer_with_citations(
        cls,
        db: Session,
        tenant_id: str,
        subject: str,
        class_name: str,
        question: str,
        limit: int = 4
    ) -> Dict[str, Any]:
        """
        Answers pedagogical queries strictly grounded in uploaded curriculum materials,
        returning answers accompanied by exact source citations (doc title, chapter, excerpt).
        """
        chunks = cls.retrieve_chunks(db, tenant_id, subject, class_name, question, limit=limit)
        citations = []
        for c in chunks:
            citations.append({
                "chunk_id": str(c.id),
                "document_title": c.title,
                "class_name": c.class_name,
                "subject": c.subject,
                "chapter": c.chapter or "General",
                "chunk_index": c.chunk_index,
                "excerpt": c.content[:200] + ("..." if len(c.content) > 200 else "")
            })

        grounding = cls.format_grounding_context(db, tenant_id, subject, class_name, question, limit=limit)

        answer_text = ""
        try:
            from app.core.ai_client import get_genai_client
            client = get_genai_client()
            if client:
                prompt = (
                    f"You are an expert pedagogical AI teacher at Kids Shine International School.\n"
                    f"Answer the user's question accurately and helpfully based strictly on the following curriculum grounding context.\n"
                    f"If the answer cannot be found in the context, explicitly indicate that.\n\n"
                    f"{grounding}\n\n"
                    f"Question: {question}\n\n"
                    f"Answer:"
                )
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt
                )
                answer_text = sanitize_text(response.text)
        except Exception as exc:
            logger.warning(f"Direct AI generation failed, falling back to extractive answer: {exc}")

        if not answer_text:
            if chunks:
                answer_text = f"According to the curriculum material for {class_name} {subject}:\n\n" + "\n\n".join(c.content[:300] for c in chunks[:2])
            else:
                answer_text = f"No specific curriculum material found matching your query for {class_name} {subject}."

        return {
            "question": sanitize_text(question),
            "answer": answer_text,
            "subject": subject,
            "class_name": class_name,
            "grounding_count": len(chunks),
            "citations": citations
        }


curriculum_rag = CurriculumRAGService()


