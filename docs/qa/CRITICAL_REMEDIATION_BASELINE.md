# EDUCATIONOS — CRITICAL REMEDIATION BASELINE REPORT
**Date:** 2026-11-16  
**Repository:** `/Users/tashfinyousuf/Python/SCHOOL_OS`  
**Git Branch:** `chore/upgrade-next-16-4`  
**Git Commit Baseline:** `3179bbfe059799f441ff04c96912ede33efffab6`  
**Alembic Schema Head:** `04834912199b (head)`  
**Pilot Institution:** Kids Shine International School (KSIS)

---

## 1. Environment & Architecture Baseline

| Layer | Technology | Status / Configuration |
|---|---|---|
| Backend Framework | FastAPI + Uvicorn | Python 3.12, async ASGI router with 32 registered endpoints |
| ORM & Migrations | SQLAlchemy 2.0 + Alembic | Single head `04834912199b`, strict linear DAG, 0 schema drift |
| Database Engine | Supabase PostgreSQL 15 | Native Row-Level Security (RLS) enabled on all tenant tables |
| Vector / Embedding Engine | Google GenAI SDK (`gemini-embedding-001`) | Dense vector cosine similarity with lexical BM25 token fallback |
| Frontend Framework | Next.js 16.4.1 (App Router) | React 19, TypeScript strict, PWA Service Worker `educationos-shell-v4` |
| Client Styling | Tailwind CSS v4 | Fully customized EducationOS design system with Dark/Light modes |
| Identity & RBAC | Multi-tenant claims, bcrypt password hashes | 5 canonical roles: SuperAdmin, Admin, Teacher, Student, Guardian |

---

## 2. Forensic Quality Gate Verification Baseline

Before applying any changes, the baseline quality gates were verified:

1. **Gate 1: `bash backend/scripts/check.sh`**
   - Syntax: `compileall` clean.
   - Ruff linting: 0 syntax/undefined name errors.
   - App import: `app.main` loaded all 32 routers without circular dependencies.
   - Schema Drift: Verified clean against live schema.
   - Frontend Types: `npx tsc --noEmit` exited 0 with zero errors.
2. **Gate 2: Backend Pytest Suite**
   - 212 tests passed, 0 failures.
3. **Gate 3: OpenAPI Contract Verification**
   - `python backend/scripts/openapi_contract.py` matched recorded contract with zero drift.
4. **Gate 4: Tenant Branding Isolation**
   - `bash backend/scripts/check_hardcoded_tenant.sh` verified zero hardcoded school names in core business logic.
5. **Gate 5: Frontend Node Test Suite & Lint**
   - `npm test`: 79 passed across 24 suites, 0 failures.
   - `npm run lint`: 0 errors.

---

## 3. Five-Role QA Identity Baseline

The five test accounts provisioned for Kids Shine International School (KSIS) pilot:

| Role | Username / Identifier | Provisioning Method | Status |
|---|---|---|---|
| Platform Super Admin | `superadmin@educationos.local` | Platform Root Bootstrap (`bootstrap_platform_owner.py`) | Provisioned |
| School Admin (KSIS) | `admin@kidsshine.edu.bd` | Tenant Onboarding (`/register-school`) | Verified Active |
| Teacher | `rahim.uddin@kidsshine.edu.bd` | Admin Single-Use Invitation (`/teacher/{id}/invite`) | Verified Active |
| Guardian | `01711000001` / `guardian.karim@gmail.com` | Multi-Child Enrolled Relationship (`/guardian/{id}/invite`) | Verified Active |
| Student | `STD-2026-0001` / `student1@kidsshine.edu.bd` | Student Activation Slip (`/student/{id}/invite`) | Verified Active |

---

## 4. Key Reproduced Defects Documented in Baseline

1. **RAG Synchronous Ingestion Hang (P0):**
   - Synchronous invocation of `curriculum_rag.ingest_document()` in `POST /curriculum/upload` blocked the FastAPI event loop for minutes when processing realistic large PDFs (such as the 8.9 MB Class 1 Bangla textbook).
   - Ingestion was vulnerable to request drops, reverse-proxy timeouts, and unhandled socket closures.
2. **Cascading Offline Mode Trigger (P0):**
   - When the server event loop was blocked by long-running synchronous embedding loops, client-side browser navigation requests timed out.
   - Service worker `sw.js` intercepted navigation failures and redirected the entire browser window to `/offline`.
   - `safeFetch` in `api-client.ts` caught errors and set `isOffline: true`, polluting the application state.
3. **Platform Super Admin Login Denial (P0):**
   - Frontend `ALLOWED_ROLES.staff` in `frontend/app/login/page.tsx` was restricted to `["admin", "teacher"]`, rejecting `superadmin` login with "This account (superadmin) cannot sign in on this tab."
   - Default navigation redirected to `/dashboard` instead of `/dashboard/platform`.
4. **Absence of Dedicated Owner Bootstrap CLI (P0):**
   - No dedicated, secure, non-interactive CLI existed to provision or rotate the initial Platform Owner credentials with MFA secret and recovery code generation.
5. **Untruthful Communication Reporting (P1):**
   - No explicit `NOT_CONFIGURED` delivery state when SMTP or SMS credentials were omitted.

---

## 5. Scope of Active Remediation

- Asynchronous durable job engine for RAG with real-time percentage progress and cooperative cancellation.
- Service worker and client-side offline mode decoupling.
- Platform Super Admin bootstrap CLI and unified login workflow.
- Passkey WebAuthn, TOTP MFA, and single-use password recovery endpoints.
- Truthful SMS & Email provider architecture with Bangladesh gateway runbooks.
- Comprehensive 5-role onboarding documentation and browser validation.

