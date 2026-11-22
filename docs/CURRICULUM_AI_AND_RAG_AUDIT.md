# CURRICULUM AI & RAG ARCHITECTURE FORENSIC AUDIT

**Document Reference:** `docs/CURRICULUM_AI_AND_RAG_AUDIT.md`  
**Release Track:** EducationOS RC3 — Academic & Experience Transformation  
**Auditor:** AI/RAG Architect & Senior Full-Stack Security Engineer  
**Date:** 2026-11-14

---

## 1. Executive Summary & RAG Baseline

EducationOS features several AI-assisted educational modules:
1. `backend/app/services/ai_gateway.py`: `MultiModelAIGateway` with prompt-injection sanitization, budget enforcement, and failover.
2. `backend/app/services/curriculum_rag.py`: Keyword-based chunk retrieval filtering on `tenant_id` and global curriculum.
3. `backend/app/models/curriculum.py`: `CurriculumChunk` table storing titles, class names, subjects, chapters, content, and metadata payloads.
4. `backend/app/api/endpoints/ai.py`: Generation endpoints for question papers, lesson blueprints, and socratic tutor.
5. `backend/app/api/endpoints/learning_studio.py`: Student study room, flashcards, and practice quiz endpoints.

Despite these components, forensic source-code inspection reveals critical architecture and implementation gaps:
- **Ungrounded Direct LLM Calls in Academic Router:** In `backend/app/api/endpoints/academic.py:274-365`, `generate_lecture_blueprint` and `generate_lecture_and_homework_ai` bypassed `ai_gateway` and `curriculum_rag` entirely, directly calling `ai_client.chats.create`. These calls completely lacked prompt injection defenses, token budget accounting, and curriculum grounding.
- **Absence of a Document Ingestion Pipeline:** While `CurriculumRAGService.ingest_chunk` existed for single pre-split text chunks (`POST /api/v1/ai/curriculum/ingest`), there was no multi-format ingestion pipeline for actual files (PDF textbooks, DOCX notes, scanned syllabus documents). Text extraction, chunking, OCR, and validation were unimplemented.
- **Missing Curriculum Knowledge Management Workspace in Frontend:** The frontend lacked an interface for teachers and administrators to upload curriculum documents, monitor extraction status, view indexed chunks, or organize materials by Class (1–12), Subject, and Academic Year.
- **No Grounding Citations or Source Transparency in UI:** Student doubt-solving and lesson generation did not show which chapter, book edition, or curriculum chunk was referenced, risking hallucination without user verifiability.

---

## 2. Granular Forensic Findings

### Finding RAG-F01 (Severity: CRITICAL)
- **Title:** Direct LLM Invocations Bypassing AI Gateway & RAG Grounding
- **Affected Files:**
  - `backend/app/api/endpoints/academic.py:274-301, 326-365`
- **Root Cause:** Developers implemented `generate-lecture` and `lessons/generate-materials` using raw `ai_client.chats.create(model='gemini-2.5-flash', ...)` rather than delegating to `ai_gateway.execute_with_failover` and `curriculum_rag.format_grounding_context`.
- **Impact:**
  - No prompt-injection sanitization (vulnerable to prompt jailbreaking).
  - No tenant AI budget tracking in `AIUsageLog` (violating FinOps governance).
  - Generated lecture plans had zero grounding in actual uploaded NCTB curriculum or school textbooks.
- **Implementation Plan:**
  1. Refactor `academic.py` endpoints to route through `ai_gateway.sanitize_input` and `ai_gateway.execute_with_failover`.
  2. Inject authoritative grounding chunks via `curriculum_rag.format_grounding_context`.
  3. Log token consumption in `AIUsageLog` with proper `feature="lecture_blueprint"`.
- **Verification Test:** Automated unit test sending malicious prompt injection strings and asserting HTTP `400` rejection; verifying token count increments in `ai_usage_logs`.

---

### Finding RAG-F02 (Severity: HIGH)
- **Title:** Missing Multi-Format Document Ingestion Pipeline (PDF, DOCX, TXT)
- **Affected Files:**
  - `backend/app/services/curriculum_rag.py`
  - `backend/app/models/curriculum.py`
  - `backend/app/api/endpoints/ai.py`
- **Root Cause:** Ingestion was modeled only around raw string payloads (`CurriculumChunkCreate`). There was no file upload handler, MIME validation, or text chunker to ingest real PDF textbooks or DOCX lecture notes.
- **Impact:** Teachers and administrators could not upload official NCTB PDF textbooks, syllabi, or school handouts into the RAG knowledge base.
- **Implementation Plan:**
  1. Create a `CurriculumDocument` model in `curriculum.py` to track uploaded files, file hashes, processing status (`PENDING`, `PARSING`, `INDEXED`, `FAILED`), and metadata.
  2. Implement `POST /api/v1/ai/curriculum/upload` supporting PDF, DOCX, and TXT files with safe text extraction, regex normalization, and semantic sliding-window chunking (500–1000 tokens with 100-token overlap).
  3. Ensure strict tenant isolation: uploaded institutional materials are tagged with `tenant_id` and never leak across institutions.
- **Verification Test:** Test uploading a sample PDF/TXT file, asserting extraction, chunk creation, and retrieval query match.

---

### Finding RAG-F03 (Severity: HIGH)
- **Title:** Missing Curriculum Knowledge Workspace in Frontend
- **Affected Files:**
  - `frontend/app/dashboard/academic/page.tsx`
  - `frontend/app/dashboard/learning/page.tsx`
- **Root Cause:** No UI view was created for curriculum document management. The `academic` page only had routine and basic class creation tabs.
- **Impact:** Institution administrators had no visual mechanism to upload, inspect, or delete curriculum knowledge sources.
- **Implementation Plan:**
  1. Add a dedicated **"Curriculum Knowledge Base"** tab in `frontend/app/dashboard/academic/page.tsx`.
  2. Provide a file dropzone with Class (1–12), Subject, Chapter, and Academic Year selectors.
  3. Display a list of uploaded documents with parsing status badges, chunk counts, and deletion controls.
- **Verification Test:** Cypress / unit test verifying document upload triggers API call and displays parsed chunk status.

---

### Finding RAG-F04 (Severity: MEDIUM)
- **Title:** Lack of Source Citations & Academic Context in Chat Interfaces
- **Affected Files:**
  - `frontend/app/dashboard/doubt-solver/page.tsx`
  - `frontend/app/dashboard/learning/page.tsx`
  - `backend/app/api/endpoints/learning_studio.py`
- **Root Cause:** Generation endpoints returned raw string responses without referencing specific source document titles, chapters, or page numbers.
- **Impact:** Students and teachers could not verify whether AI responses were grounded in real textbook material or fabricated.
- **Implementation Plan:**
  1. Update RAG retrieval to return citation metadata (`title`, `chapter`, `source_type`).
  2. Include citations in generation prompts and response payloads.
  3. Render expandable "References & Citations" badges in frontend chat and handout views.
- **Verification Test:** Assert response payload includes `citations` array with matching chapter and title.

---

## 3. RAG Pipeline Architecture Design

```
[Uploaded Document: PDF / DOCX / TXT]
                    │
                    ▼
          [MIME & Magic Byte Check] ──(Invalid)──> [HTTP 422 Rejection]
                    │
                    ▼
          [Text Extraction Engine] (PyPDF2 / pdfplumber / python-docx / UTF-8)
                    │
                    ▼
          [Normalization & Cleaning] (Whitespace, ligatures, Bengali unicode)
                    │
                    ▼
          [Sliding-Window Chunker] (600 tokens, 100 token overlap)
                    │
                    ▼
   [CurriculumChunk Persistence in Postgres] (tenant_id, class, subject, chapter)
                    │
                    ▼
 [Grounded Retrieval via CurriculumRAGService] <── [Student / Teacher Query]
                    │
                    ▼
  [MultiModelAIGateway Prompt Construction] (Strict System Context + Citations)
                    │
                    ▼
    [Gemini 2.5 Flash Inference with Safety & Token Tracking]
```
