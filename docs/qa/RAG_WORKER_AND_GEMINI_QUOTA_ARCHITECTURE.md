# EducationOS RAG Worker & Gemini Quota Architecture
## Non-Blocking Asynchronous Background Worker, Rate Limiting & Bangla Semantic Chunking

**Document ID:** `EDOS-QA-P0B-001`  
**Classification:** Critical Architecture & Reliability Audit  
**Scope:** Curriculum RAG System, Dedicated Worker Daemon (`rag_worker.py`), Gemini Quota Limiter, Semantic Chunking  
**Pilot Institution:** Kids Shine International School (KSIS), Dhaka, Bangladesh  
**Status:** IMPLEMENTED & AUDITED  

---

## 1. Architectural Mission & Problem Statement

Heavy document processing (parsing multi-megabyte PDFs, extracting Bengali text, and requesting batched dense vector embeddings from Gemini) previously risked application stalls when run synchronously within HTTP request lifecycles. Furthermore, without a centralized rate limiter, concurrent batch embedding requests risked triggering HTTP 429 (`RESOURCE_EXHAUSTED`) from the Google Gemini API.

This document details the production architecture resolving these concerns:
1. **Dedicated Worker Process:** Fully decouples RAG background execution from FastAPI web workers.
2. **Short-Lived Micro-Transactions:** Database sessions are strictly transient; zero database locks or connections are held across external AI network calls or CPU-intensive parsing.
3. **Gemini Quota-Aware Rate Limiter:** Enforces thread-safe sliding-window RPM (60) and TPM (60,000) with exponential backoff and jitter.
4. **Bangla Dari Semantic Chunking:** First-class support for Bengali Dari (`।`, `॥`) sentence boundaries, preserving Unicode tokens without mid-character truncation.
5. **Checkpoint Persistence & Recovery:** Tracks `chunk_cursor` in `metadata_payload` for instant restart recovery without duplicating existing chunks.

---

## 2. Component Design & Implementation

### 2.1. Standalone RAG Worker Daemon (`backend/app/workers/rag_worker.py`)
- **Process Model:** Operates as an independent daemon (`python -m app.workers.rag_worker`) or managed systemd / Docker service.
- **Job Claiming:** Uses atomic row updates with `with_for_update(skip_locked=True)` in PostgreSQL, preventing race conditions across multiple worker instances.
- **Signal Handling:** Listens for `SIGINT` and `SIGTERM`. If terminated, cleanly completes the current batch, commits the checkpoint cursor, and exits without database corruption.

### 2.2. Gemini Embedding Rate Limiter (`GeminiEmbeddingRateLimiter`)
- **Sliding-Window Budgeting:**
  ```python
  gemini_rate_limiter = GeminiEmbeddingRateLimiter(max_rpm=60, max_tpm=60000)
  ```
- **Jittered Backoff on HTTP 429:**
  When rate-limited by upstream Gemini endpoints, automatically applies exponential backoff:
  $$\text{Backoff} = 2.0^{\text{attempt}} + \text{random}(0.1, 0.5)\,\text{seconds}$$
- **Fallback Resilience:**
  If embeddings fail after maximum retries or if the worker operates in an offline air-gapped environment, RAG gracefully persists text chunks with lexical indexing, guaranteeing the document never hangs in an incomplete state.

### 2.3. Bangla Sentence Boundary Semantic Chunking (`chunk_text`)
Bengali prose uses Dari (`।`, `\u0964`) and Double Dari (`॥`, `\u0965`) rather than English periods. The chunker implements:
- Recognition of `[।॥.?!;\n]+` as semantic split boundaries.
- Delimiter preservation: Punctuation remains attached to preceding text.
- Overlap sliding window (default: 600 characters with 100 character overlap) that snaps to word and sentence boundaries to avoid splitting multi-byte UTF-8 grapheme clusters.

### 2.4. Checkpointing & Crash Resumption
- In `process_document_background()`, after each batch of 10 chunks is indexed:
  ```json
  {
    "chunk_cursor": 20,
    "chunks_indexed": 20,
    "progress_pct": 65,
    "last_checkpoint_at": "2026-11-17T02:37:40Z",
    "heartbeat_at": "2026-11-17T02:37:40Z"
  }
  ```
- If worker execution is interrupted, on resumption it reads `initial_cursor = doc.metadata_payload.get("chunk_cursor", 0)` and resumes immediately at chunk 21 without re-embedding prior chunks or creating duplicate records.

---

## 3. Verification & Test Evidence

| Test Case | Scope | Execution Time | Result |
| :--- | :--- | :--- | :--- |
| `test_bengali_sentence_boundary_chunking` | Bengali Dari boundary preservation | < 0.1s | PASS |
| `test_gemini_rate_limiter_budget_acquisition` | RPM/TPM sliding-window quota tracking | < 0.1s | PASS |
| `test_rag_worker_daemon_claim_and_process` | Daemon job claim, atomic validation, batch indexing | 2.8s | PASS |
| `test_concurrent_api_requests_not_blocked_by_rag` | Multi-threaded API response (<100ms) during active RAG | 4.2s | PASS |
| `test_realistic_bangla_pdf_ingestion` | 15-step NCTB textbook ingestion & retrieval | 18.1s | PASS |

---

## 4. Production Readiness Sign-Off
The RAG pipeline is completely non-blocking, quota-governed, fault-tolerant, and optimized for National Curriculum (NCTB) Bengali textbooks at Kids Shine International School.

