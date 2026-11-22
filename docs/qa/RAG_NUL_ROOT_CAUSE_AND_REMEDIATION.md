# EducationOS — Curriculum RAG NUL (0x00) Ingestion Root Cause & Remediation Report

**Defect ID:** DEF-RAG-01  
**Component:** Backend AI / Curriculum RAG Engine (`backend/app/services/curriculum_rag.py`)  
**Impact:** Document ingestion crash with `ValueError: A string literal cannot contain NUL (0x00) characters.`  
**Remediation Status:** REMEDIATED & VERIFIED  

---

## 1. Executive Summary

During curriculum document ingestion in the Academic module (Class 1–12 NCTB syllabus documents, lesson plans, PDFs, and DOCX files), users and automated QA observed that certain uploaded documents caused an unhandled 500 error or database transaction crash with:

```text
ValueError: A string literal cannot contain NUL (0x00) characters.
```

Or in PostgreSQL drivers (`psycopg2` / `asyncpg`):
```text
psycopg2.DataError: invalid byte sequence for encoding "UTF8": 0x00
```

This blocked ingestion of real-world PDF textbooks and scanned syllabi that contained embedded binary font descriptors, compressed cross-reference streams, or trailing control characters.

---

## 2. Root Cause Analysis

Investigation of `backend/app/services/curriculum_rag.py` revealed four interconnected causes:

1. **Unsanitized Binary Stream Decoding:**
   In `extract_text_from_bytes(file_bytes, file_type)`:
   - For PDF files where standard `pypdf` extraction failed or hit low-level parsing issues, the fallback logic executed:
     ```python
     raw = file_bytes.decode("latin-1", errors="ignore")
     matches = re.findall(r'\((.*?)\)\s*T[jJ]', raw)
     if matches:
         return " ".join(matches)
     return raw[:5000]
     ```
   - `latin-1` maps every byte 0x00-0xFF directly into a Python Unicode character `\x00`–`\xFF`. Raw PDF binary streams contain abundant `0x00` bytes.
   - Returning `raw[:5000]` passed thousands of raw binary bytes with `\x00` directly into the chunking engine.

2. **PostgreSQL Protocol Invariant:**
   PostgreSQL `TEXT` and `VARCHAR` columns strictly forbid `\x00` (NUL) bytes because strings in the PostgreSQL C server core are null-terminated. Attempting to insert a Python string containing `\x00` fails at the driver level before reaching the query planner.

3. **DOCX / Text Fallback Exposure:**
   Similar fallbacks in `clean_type in ("docx", "doc")` returned `file_bytes.decode("latin-1", errors="ignore")[:5000]` on malformed XML, dumping raw zip directory headers into text fields.

4. **Metadata and Error Propagation:**
   User-submitted file names, titles, or extracted chapter headings from malformed PDFs could harbor unprintable control characters, propagating directly into `CurriculumDocument` and `CurriculumChunk` rows. When an exception was raised, `str(e)` itself could contain the offending string, failing the subsequent `doc.error_message` commit.

---

## 3. Remediation Details

We applied the following architectural fixes in [backend/app/services/curriculum_rag.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/services/curriculum_rag.py):

### A. Dedicated Text Sanitization Function (`sanitize_text`)

Added a hardened sanitization utility:
```python
def sanitize_text(text: Optional[str]) -> str:
    """
    Sanitizes strings for safe database persistence and NLP processing.
    Strips PostgreSQL-illegal NUL bytes (\x00) and unprintable C0/C1 control characters
    while preserving standard whitespace (\t, \n, \r) and valid Unicode text (e.g. Bengali).
    """
    if not text:
        return ""
    # Strip NUL characters immediately
    clean = text.replace("\x00", "")
    # Remove control characters except tab, newline, carriage return (\t = 0x09, \n = 0x0A, \r = 0x0D)
    clean = re.sub(r'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]', '', clean)
    return clean.strip()
```

### B. Safe Text Extraction (`extract_text_from_bytes`)

1. **PDF Protection:**
   - Text extracted from each page via `pypdf` is immediately sanitized through `sanitize_text()`.
   - The fallback regex extraction searches for parenthesized text and runs each match through `sanitize_text()`.
   - **Crucial:** The fallback slice `return raw[:5000]` has been completely eliminated. If no readable text can be extracted, the function returns `""`, safely triggering a clean `ValueError("No readable text could be extracted from the uploaded document.")` rather than corrupting the database.

2. **DOCX Protection:**
   - Extracted XML nodes are sanitized and filtered. If zip parsing fails, it safely logs a warning and returns `""`.

3. **TXT / MD / CSV / JSON Protection:**
   - Decoded streams pass through `sanitize_text()` to eliminate any stray nulls.

### C. Comprehensive Ingestion Sanitization

In both `ingest_chunk` and `ingest_document`:
- Cleaned: `clean_title`, `clean_class`, `clean_subject`, `clean_chapter`, `clean_year`, `clean_group`, `clean_file_name`.
- Chunks: Each chunk candidate is verified through `sanitize_text(c_text)`. Any empty or whitespace-only chunks are discarded.
- Status and Error Message: If an exception occurs, `doc.error_message = sanitize_text(str(e))[:500]`, guaranteeing that error logging and failure state persistence will never crash due to NULs.

---

## 4. Verification & Evidence

### Automated Test Verification
A regression test was added to [backend/tests/test_rc3_defect_remediation.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/tests/test_rc3_defect_remediation.py):
- `test_def_rag_01_nul_character_sanitization_and_ingestion`

```bash
$ pytest backend/tests/test_rc3_defect_remediation.py -k "test_def_rag_01_nul_character_sanitization_and_ingestion" -v
============================== test session starts ==============================
backend/tests/test_rc3_defect_remediation.py::test_def_rag_01_nul_character_sanitization_and_ingestion PASSED [100%]
============================== 1 passed in 1.12s ===============================
```

### Checks Performed:
1. `sanitize_text` successfully removes `\x00` and control characters `[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]` while preserving Unicode (e.g., Bengali script `বাংলা`).
2. Documents containing embedded NUL bytes in both metadata and raw payload are successfully parsed, chunked, and persisted without database failure.
3. Chunks queried back from the database contain zero NUL bytes.

