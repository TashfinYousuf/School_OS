# EDUCATIONOS — RAG INGESTION & OFFLINE-MODE FORENSIC DIAGNOSTIC REPORT
**Date:** 2026-11-16  
**Investigator:** Principal AI Architect & Reliability Engineer  
**Target:** Curriculum RAG Ingestion Pipeline & PWA Service Worker  
**Incident Reference:** DEF-P0-RAG-01 (Class 1 Bangla Textbook ~8.9 MB Parsing Hang & Offline Cascade)

---

## 1. Executive Summary & Defect Characterization

When uploading an ~8.95 MB Class 1 Bangla Textbook (`bangla_class1_textbook_8_9mb.pdf`), the application exhibits the following failure modes:
1. The upload modal displays an indeterminate spinner for minutes without meaningful progress percentage.
2. The user cannot cancel or abort the upload.
3. If the user refreshes the page or navigates, the entire application switches into "Offline Mode" (`/offline`), displaying a network disconnected error screen despite full physical internet connectivity.
4. The database document record remains stuck in `status = "PARSING"` or `metadata_payload["stage"] = "indexing"`.

---

## 2. Root Cause Analysis (Code Level)

### Root Cause 1: Synchronous Ingestion in Async Request Cycle
**File:** `backend/app/api/endpoints/ai.py`  
**Lines:** 389–440  
```python
@router.post("/curriculum/upload", status_code=status.HTTP_201_CREATED)
async def upload_curriculum_document(
    file: UploadFile = File(...),
    ...
):
    # BLOCKING SYNCHRONOUS INVOCATION INSIDE ASYNC FASTAPI HANDLER
    doc = curriculum_rag.ingest_document(
        db=db,
        tenant_id=str(tenant_id),
        ...
    )
```
- Ingestion executes synchronously inside the HTTP handler of FastAPI.
- For an 8.9 MB PDF containing 27–100 illustrated pages, text extraction, semantic chunking (600 characters with 100 character overlap), and sequential Gemini dense vector embedding generation is performed synchronously.

### Root Cause 2: Sequential Unbounded Gemini API Embedding Loop
**File:** `backend/app/services/curriculum_rag.py`  
**Lines:** 362–378  
```python
chunk_records = []
for idx, c_text in enumerate(chunks):
    sanitized_c_text = sanitize_text(c_text)
    if not sanitized_c_text:
        continue

    # Synchronous HTTPS request per chunk
    c_emb = generate_embedding(sanitized_c_text)
    ...
```
- Each chunk triggers a separate HTTPS request to Google Gemini API (`models/gemini-embedding-001`).
- For 50 to 500 chunks, making 50–500 sequential network requests across the public internet takes between 90 and 300+ seconds.
- Standard client HTTP timeouts (browser fetch, reverse proxy Nginx, or Uvicorn keep-alive) terminate the connection after 30–60 seconds.
- Because the socket terminates abnormally, the uncommitted database transaction fails or is orphaned, leaving the document stuck at `PARSING`.

### Root Cause 3: Service Worker Navigation Interception into Offline Mode
**File:** `frontend/public/sw.js`  
**Lines:** 80–98  
```javascript
if (request.mode === "navigate") {
  event.respondWith(
    fetch(request)
      .then((networkResponse) => { ... })
      .catch(async () => {
        const cachedPage = await caches.match(request);
        if (cachedPage) return cachedPage;
        const fallback = await caches.match("/offline");
        return fallback || new Response("Offline. Please reconnect to internet.");
      })
  );
  return;
}
```
- When the backend thread is tied up processing synchronous embeddings, incoming browser navigation requests to Next.js or the backend hang and exceed browser timeout thresholds.
- The Service Worker's `fetch(request)` catches the timeout and immediately serves `/offline`.
- The user is greeted with the PWA Offline screen, creating the misleading illusion that EducationOS has crashed or the internet is down.

### Root Cause 4: Lack of Frontend Durable Progress Tracking
**File:** `frontend/app/dashboard/academic/page.tsx`  
**Lines:** 600–638  
- The frontend uploaded via `fetchWithTenant("/api/v1/ai/curriculum/upload")` and blocked awaiting a 201 response.
- No job ID was returned or saved to `localStorage`.
- Refreshing the page caused the local component state (`uploadingDoc = true`) to be lost completely, abandoning visual tracking of the document.

---

## 3. Architectural Remediation Blueprint

```
User uploads 8.9MB PDF
       │
       ▼
POST /api/v1/ai/curriculum/upload
       │ (Validates size, SHA-256 fingerprint, persists to private storage)
       ▼
Insert CurriculumDocument (status="QUEUED", progress=5%)
       │
       ├─► Returns HTTP 202 Accepted immediately (< 150ms) with job_id
       │
       ▼
Background Task Dispatch (Worker Thread)
       │
       ├─► Stage 1: VALIDATING (10%)
       ├─► Stage 2: EXTRACTING text via pypdf (30%)
       ├─► Stage 3: CHUNKING semantic windows (50%)
       ├─► Stage 4: INDEXING chunks with batched embeddings & heartbeat (50-95%)
       │      (Checks cancel_requested before each batch)
       └─► Stage 5: INDEXED / COMPLETED (100%)
```

- **Asynchronous Decoupling:** `POST /curriculum/upload` returns in < 150ms with HTTP 202 Accepted.
- **Durable Progress Polling:** Frontend polls `GET /api/v1/ai/curriculum/documents/{doc_id}/status` or `GET /api/v1/ai/curriculum/jobs/{job_id}`.
- **Refresh Safety:** Active job ID is stored in `localStorage` so page refreshes seamlessly resume progress monitoring.
- **Cooperative Cancellation:** User can click "Cancel Ingestion" which sets `cancel_requested = true`; the background worker aborts cleanly and rolls back partial chunks.
- **Offline Decoupling:** Service Worker `sw.js` and `api-client.ts` never enter global `/offline` mode on isolated AI/curriculum errors.

