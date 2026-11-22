# EDUCATIONOS — RECOVERY RISK REGISTER
## Forensic Post-Crash Risk & Vulnerability Analysis

**Date:** 2026-11-14  
**Project:** EducationOS (`/Users/tashfinyousuf/Python/SCHOOL_OS`)

---

## 1. Risk Register Matrix

| Risk ID | Title | Severity | Likelihood | Affected Environments | Root Cause | Mitigation Strategy | Verification |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RSK-REC-01** | Missing `import uuid` in `ai.py` | HIGH | CERTAIN | Staging, Production (Backend Service) | The crash interrupted file editing right after adding `/curriculum/documents/{id}` deletion endpoint without importing `uuid`. | Add `import uuid` to `backend/app/api/endpoints/ai.py`. | `ruff check app/api/endpoints/ai.py` must pass with 0 errors. |
| **RSK-REC-02** | Hardcoded Head Revision Whitelist in Test | MEDIUM | CERTAIN | Test / CI Pipeline | `backend/tests/test_stage02_migrations.py:28` asserts `heads[0]` is in a static tuple that ended at `cedb24c053f7`. | Add `'407a7716be83'` to the assertion tuple in `test_stage02_migrations.py`. | `pytest backend/tests/test_stage02_migrations.py` passes. |
| **RSK-REC-03** | In-Memory SQLite Fixture Missing `student_enrollment_history` Table | MEDIUM | CERTAIN | Unit Test Suite (`test_stage05_rbac.py`) | Stage 05 RBAC tests use an explicit `target_tables` whitelist in the SQLite memory fixture, missing the newly added `StudentEnrollmentHistory` table. | Add `StudentEnrollmentHistory.__table__` to `target_tables` in `sqlite_session` fixture. | `pytest backend/tests/test_stage05_rbac.py` passes. |
| **RSK-REC-04** | Sandbox Network Isolation Blocking Live Supabase Tests | LOW | CERTAIN | Local Dev / Sandbox Environment | Standard sandbox mode restricts outbound network sockets to external poolers (`aws-1-ap-south-1.pooler.supabase.com:6543`), causing tests that connect to live Supabase to fail. | Run offline/mocked unit tests sandboxed; when validating full database integration, use sandbox bypass only for that step. | Unit tests pass in offline mode. |
| **RSK-REC-05** | Premature Migration Execution on Production DB | HIGH | LOW | Production Database (Supabase) | Executing `alembic upgrade head` before confirming all model definitions match migration scripts could cause schema lockouts. | Never run migrations automatically during audit; verify DDL safety first. All additions in `407a7716be83` use nullable columns and safe defaults. | Read migration file and verify zero `drop_*` statements. |
| **RSK-REC-06** | Hardcoded Class Arrays Across Frontend Causing Data Invisibility | HIGH | CERTAIN | Frontend Web Client (All Roles) | 7 dashboard pages hardcode `["Play"..."Class 5"]`, completely blinding users to Classes 6–12. | Create dynamic hook `useAcademicClasses.ts` and replace all static arrays. | Frontend renders Class 1 through 12 in all selectors. |
| **RSK-REC-07** | DOM Freezing in Fee Collection on Large Student Datasets | MEDIUM | HIGH | Finance Dashboard (`finance/page.tsx`) | Unpaginated `<select>` attempts to render 1,000+ student `<option>` elements at once. | Replace with debounced server-side combobox calling `GET /api/v1/students/search`. | Test search with 500+ records with under 100ms UI response. |
| **RSK-REC-08** | Stale Workspace Branding Displayed | LOW | MEDIUM | Header / Navigation | `WorkspaceContext` reads `localStorage` before `useInstitution()` profile finishes loading. | Synchronize `WorkspaceSwitcher` and `workspaceContext` with `useInstitution().name`. | Verified with `check_hardcoded_tenant.sh`. |

---

## 2. DDL & Database Impact Assessment

### Migration: `407a7716be83_academic_expansion_class_1_to_12.py`
- **Down Revision:** `cedb24c053f7`
- **Reversibility:** Fully reversible via `downgrade()`.
- **Destructive Operations:** ZERO.
  - No existing columns are dropped.
  - No existing tables are dropped.
  - All new columns are either `nullable=True` or provided with safe server defaults (`server_default='Morning'`, `server_default='2026'`, `server_default='A'`).
  - Constraint replacement on `attendance_events`: safely drops old `uq_attendance_student_day` and creates `uq_attendance_student_day_period`.
  - Row Level Security (RLS): enabled on `curriculum_documents` and `student_enrollment_history` with strict tenant isolation.
- **Affected Environments:**
  - Local development SQLite / Postgres.
  - Staging Supabase PostgreSQL.
  - Production Supabase PostgreSQL.

---

## 3. Resumption Safety Protocol

1. Keep all work sandboxed (`BypassSandbox: false`) for compilation, linting, unit tests, and frontend development.
2. Resolve the three interrupted blockers in dependency order.
3. Keep changes minimal and additive per `AGENTS.md`.
4. Validate `check.sh` and `npx tsc --noEmit` before and after each feature.

