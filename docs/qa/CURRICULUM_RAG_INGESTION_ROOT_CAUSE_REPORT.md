# CURRICULUM RAG INGESTION ROOT CAUSE & REMEDIATION REPORT (DEF-10)

## 1. Incident Overview
- **Observed Defect:** Uploading curriculum PDF documents produced a failure state (`status = "FAILED"`), but the UI displayed 9 chunks while backend terminal logs showed successful document list retrieval (`GET /api/v1/ai/curriculum/documents`).
- **Defect Classification:** State inconsistency, missing session tenant context for PostgreSQL Row Level Security (RLS), and lack of transactional rollback cleanup for in-memory object attributes.

## 2. Root Cause Analysis
1. **Tenant Context Missing for PostgreSQL RLS:**
   - `CurriculumChunk` had RLS enabled (`FORCE ROW LEVEL SECURITY`) with policy `tenant_curriculum_isolation`:
     `USING (is_global_curriculum = true OR tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))`
   - In `upload_curriculum_document`, database session was obtained via `get_db` without setting `session.info["tenant_id"]`.
   - When non-global institutional chunks were committed to PostgreSQL, `app.current_tenant_id` was NULL, triggering an RLS policy violation: `new row violates row-level security policy for table "curriculum_chunks"`.
2. **In-Memory Attribute Persistence after Rollback:**
   - In `curriculum_rag.ingest_document()`, `doc.chunks_count = len(chunk_records)` (9 chunks) was assigned to the Python `CurriculumDocument` instance *before* `db.commit()`.
   - When the commit failed and `db.rollback()` was invoked, `db.rollback()` wiped all database state, but the in-memory Python object attribute `doc.chunks_count` remained `9`.
   - The exception handler then assigned `doc.status = "FAILED"`, `db.add(doc)`, and `db.commit()`. The document was persisted with `status = "FAILED"` and `chunks_count = 9`, even though 0 child chunks existed in the database.
3. **HTTP 201 Response on Failure:**
   - `upload_curriculum_document` previously returned HTTP 201 with `{..., "status": "FAILED"}` rather than raising a 422 Unprocessable Entity error.
4. **Field Mapping Discrepancy:**
   - Frontend expected `doc.filename` while backend serialized `file_name`.

## 3. Implemented Fixes
1. **RLS Tenant Context Injection:**
   - In `CurriculumRAGService.ingest_document()`, explicitly initialized `db.info["tenant_id"] = tid` and invoked `set_config('app.current_tenant_id', :tenant_id, true)` on PostgreSQL dialects before chunk persistence.
2. **Atomic Rollback & Guaranteed 0 Chunks on Failure:**
   - In `CurriculumRAGService.ingest_document()`, `except Exception:` guarantees `doc.chunks_count = 0` upon rollback, preventing ghost chunk counts.
3. **HTTP Status Code Alignment:**
   - In `upload_curriculum_document()`, if `doc.status == "FAILED"`, the endpoint raises `HTTPException(422, detail=doc.error_message)`.
4. **Contract Dual-Mapping:**
   - Backend now provides both `file_name` and `filename` in document responses.
   - Frontend `CurriculumDoc` interface supports both `file_name` and `filename`, with error tooltip rendering on `FAILED` badges.

