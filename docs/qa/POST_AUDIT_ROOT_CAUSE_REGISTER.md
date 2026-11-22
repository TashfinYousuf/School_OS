# EducationOS — Post-Audit Root-Cause Register & Defect Investigation

**Repository:** `/Users/tashfinyousuf/Python/SCHOOL_OS`  
**Release:** RC3 — Post-Independent-Audit Remediation  
**Auditor / Engineer:** Principal Full-Stack Engineer & Database Architect  
**Date:** November 14, 2026  
**Status:** ALL DEFECTS REPRODUCED, ROOT-CAUSES IDENTIFIED & REMEDIATION DESIGNED  

---

## 1. Executive Defect Register

| Defect ID | Description | Severity | Affected Component | Root Cause Category | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **DEF-WS-01** | `GET /api/v1/workspaces/my-workspaces` returns HTTP 500: `new row violates row-level security policy for table "organizations"` | **CRITICAL** | [workspaces.py:359](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/workspaces.py#L359) | Missing PostgreSQL RLS policy on `organizations` table | **REMEDIATED** |
| **DEF-FIN-01** | Finance Monthly Archive print preview renders a completely blank white page | **HIGH** | [finance/page.tsx:524](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/app/dashboard/finance/page.tsx#L524) | Parent container has `className="print:hidden space-y-6"`, wrapping the entire monthly report | **REPRODUCED** |
| **DEF-RAG-01** | Curriculum RAG upload fails with `ValueError: A string literal cannot contain NUL (0x00) characters` | **HIGH** | [curriculum_rag.py:46](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/services/curriculum_rag.py#L46) | Raw PDF byte stream extraction fallback decodes binary streams with embedded `0x00` NUL bytes into text columns | **REPRODUCED** |
| **DEF-CUR-01** | Curriculum & Competencies panel displays static hardcoded HTML with no dynamic database integration | **MEDIUM** | [academic/page.tsx:498](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/app/dashboard/academic/page.tsx#L498) | UI lacks live API binding to NCTB competencies and learning outcomes | **REPRODUCED** |
| **DEF-HUB-01** | Daily Teaching Hub & Handouts is a single input box with alert popup instead of integrated teaching workflow | **MEDIUM** | [academic/page.tsx:760](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/app/dashboard/academic/page.tsx#L760) | Frontend lacked full teaching hub interface; endpoints were unintegrated | **REPRODUCED** |
| **SEC-AUDIT-IDOR-01** | BOLA / IDOR on `GET /api/v1/finance/students/{student_id}/history` | **HIGH** | [finance.py:424](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/finance.py#L424) | Missing `security_guard.verify_student_scope` enforcement | **REMEDIATED** |
| **DEF-QA-01** | Four-role QA accounts cannot be authenticated because passwords/credentials were unprovisioned | **HIGH** | Backend IAM / CLI | Absence of automated, local synthetic account seed and verification tooling | **REPRODUCED** |

---

## 2. In-Depth Root-Cause Analyses & Reproduction Evidence

### A. DEF-WS-01: Workspace Bootstrap RLS Violation on `organizations`
- **Symptom**: User logs in; frontend requests `GET /api/v1/workspaces/my-workspaces`; server crashes with HTTP 500:
  ```
  sqlalchemy.exc.ProgrammingError: (psycopg2.errors.InsufficientPrivilege) new row violates row-level security policy for table "organizations"
  [SQL: INSERT INTO organizations (id, name, institution_type, enabled_modules, address, contact_phone, is_active) VALUES ...]
  ```
- **Reproduction**: When a user without pre-existing workspace memberships calls `/my-workspaces`, the endpoint attempts to auto-bootstrap an `Organization` record under the authenticated session. In `get_tenant_db`, `SET LOCAL ROLE authenticated` is applied. In PostgreSQL, RLS was enabled on `organizations` (either by Supabase defaults or prior scripts), but NO `CREATE POLICY` statement existed for `organizations` in Alembic migrations. PostgreSQL default-deny rejected both `SELECT` (hiding any existing organization) and `INSERT` (violating RLS).
- **Remediation**:
  1. Author migration `a2b3c4d5e6f7` enabling RLS with permissive `tenant_organization_isolation_policy` on `organizations` allowing access where `id::text = current_setting('app.current_tenant_id', true)` or via associated workspaces, and granting permissions to `authenticated`.
  2. Harden `workspaces.py` to make auto-bootstrap atomic, check existing workspaces, and fall back cleanly without 500 errors.

---

### B. DEF-FIN-01: Blank Print Page on Monthly Financial Archive
- **Symptom**: In `/dashboard/finance` -> Monthly Archive tab -> Click "Print Statement" -> Browser print preview opens a blank white page.
- **Reproduction**:
  Inspecting [frontend/app/dashboard/finance/page.tsx](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/app/dashboard/finance/page.tsx#L524):
  Line 524 opens: `<div className="print:hidden space-y-6">`.
  This `div` wraps the header, tabs, and the entire Monthly Archive view (lines 752 to 929), closing at line 930.
  When `window.print()` is executed, CSS `@media print` applies `display: none` to the entire container. Because the monthly report was nested inside `print:hidden`, nothing from the report remained visible in the print media canvas.
- **Remediation**:
  Extract the official printable statement outside `print:hidden` or use responsive print selectors (`print:block print:w-full`) for the official statement document, while hiding only screen navigation, filters, and action buttons. Add full A4 formatting with institutional letterhead, signature blocks, and itemized transaction tables.

---

### C. DEF-RAG-01: NUL Character Failure During Curriculum PDF Ingestion
- **Symptom**: Ingestion fails with `ValueError: A string literal cannot contain NUL (0x00) characters`.
- **Reproduction**:
  In [backend/app/services/curriculum_rag.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/services/curriculum_rag.py#L46):
  `raw = file_bytes.decode("latin-1", errors="ignore")`
  When parsing PDF streams or font tables containing raw byte `0x00`, `latin-1` preserves `\x00` in the decoded Python string. PostgreSQL `TEXT` columns strictly prohibit NUL characters. When SQLAlchemy flushed chunks containing `\x00`, psycopg2 raised `ValueError`.
- **Remediation**:
  Implement a strict `sanitize_text()` helper that strips `\x00` and unprintable control characters while preserving Bangla and Unicode text. Never fall back to returning raw binary decoded bytes (`raw[:5000]`). Enforce sanitization on titles, chapters, filenames, and chunk bodies prior to database flush.

---

### D. DEF-CUR-01 & DEF-HUB-01: Missing Dynamic Academic & Teaching Workflows
- **Symptom**: Curriculum & Competencies displayed static mock text cards; Daily Teaching Hub consisted of an alert box.
- **Reproduction**:
  In `frontend/app/dashboard/academic/page.tsx`, `activeTab === "curriculum"` rendered hardcoded text ("NCTB alignment is at 100%..."), and `activeTab === "lessons"` called `window.alert()`.
- **Remediation**:
  Connect backend APIs:
  - `GET /api/v1/academic/grades`, `GET /api/v1/academic/classes` for competencies and learning outcome mapping.
  - `GET /api/v1/academic/lessons/history`, `POST /api/v1/academic/lessons/log`, and `POST /api/v1/academic/lessons/generate-materials` for the Daily Teaching Hub with a real lecture log table, lesson plan builder, and downloadable/printable handouts.

---

### E. SEC-AUDIT-IDOR-01: Broken Object-Level Authorization on Student Fee Ledger
- **Symptom**: An authenticated student or guardian could view any other student's fee ledger within the same tenant via `GET /api/v1/finance/students/{student_id}/history`.
- **Reproduction**:
  `finance.py` filtered only `FeePayment.tenant_id == tid` without verifying whether the requesting user owned the student record or had a verified guardian relationship.
- **Remediation**:
  Inject `current_user: dict = Depends(get_current_user_claims)` and invoke `security_guard.verify_student_scope(current_user["role"], current_user["user_id"], st, db)`.

---

### F. DEF-QA-01: Lack of Provisioned QA Accounts and Credential Tooling
- **Symptom**: Owner could not manually verify role-based flows because synthetic QA credentials were not provisioned or documented.
- **Remediation**:
  Create `backend/app/cli/qa_accounts.py` supporting `provision` and `verify` commands with cryptographically secure credentials stored locally in `.qa-credentials.local` (Git-ignored) and detailed instructions in `docs/qa/FOUR_ROLE_QA_ACCOUNT_SETUP.md`.

