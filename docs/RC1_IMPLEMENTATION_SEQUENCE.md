# EducationOS RC1 — Phase 0: Implementation Sequence & Dependency Graph

**Document Reference:** `RC1-SEQ-20261103`  
**Evaluation Date:** 2026-11-03  
**Auditor / Security Engineer:** Principal Software Architect & Security Engineer  
**Classification:** SEQUENCING SPECIFICATION & GO/NO-GO DIRECTIVE — PHASE 0  
**Scope:** Priority-ordered execution roadmap and dependency gating for Phase 1 through Phase 4 remediation  

---

## 1. Technical Dependency Rationale

Executing remediation tasks out of order risks cascading regressions, un-testable states, and corrupted data. The remediation sequence is governed by strict foundational dependencies:

```
[Level 1: Startup & Runtime Stability]
  (main.py import crash, config.py path, lifespan parameter)
                     │
                     ▼
[Level 2: Database & Migration Lineage]
  (Alembic DAG repair, table names, model attributes)
                     │
                     ▼
[Level 3: Authentication & Identity]
  (Frontend token persistence, JWT claim validation)
                     │
                     ▼
[Level 4: Tenant Isolation & Database RLS]
  (deps.get_db injection across all 28 routers, fail-closed tenant_guard)
                     │
                     ▼
[Level 5: Role-Based Access Control (RBAC)]
  (Superadmin endpoint protection, RoleRouteGuard sync)
                     │
                     ▼
[Level 6: Commercial & Financial Integrity]
  (Cashier receipts, TrxID uniqueness, payment verification)
                     │
                     ▼
[Level 7: Frontend & API Synchronization]
  (TS2339 build fix, typed api-client.ts migration, URL envs)
                     │
                     ▼
[Level 8: Institutional & Academic Workflows]
  (Approvals double prefix, exam publishing pipeline, BOLA/IDOR fixes)
                     │
                     ▼
[Level 9: AI, PWA & Billing Subsystems]
  (ai_tutor mount, PWA icons, SW deduplication, subscriptions consolidation)
                     │
                     ▼
[Level 10: Containerization & Deployment Hardening]
  (Dockerfile verification, Nginx rules, CI automated test suite)
```

---

## 2. Ten-Stage Prioritized Implementation Sequence

---

### Stage 1: Startup Failures & Import Stability (Immediate Prerequisite)
- **Target Defects:** DEF-P0-01, DEF-P0-04, DEF-P0-05
- **Actions:**
  1. Remove synchronous `engine.connect()` in `backend/app/main.py:35-43`.
  2. Implement database connectivity checks inside `lifespan(app: FastAPI)` with exponential backoff retries.
  3. Wire `lifespan=lifespan` into `FastAPI(...)` constructor call.
  4. Fix import in `backend/app/api/endpoints/workspaces.py:11` from `InstitutionalMembership` to `WorkspaceMembership`.
  5. Remove `try...except ImportError` fallback in `main.py` to ensure fail-fast module loading.
  6. Ensure `backend/app/core/config.py` resolves `.env` relative to the backend root directory so pytest can run from any working directory.
- **Verification Gate:** `pytest --collect-only` completes with 0 errors from both project root and `backend/`.

---

### Stage 2: Database & Migration Integrity
- **Target Defects:** DEF-P0-03, Schema Inconsistencies
- **Actions:**
  1. Update `down_revision = '63d9333ead59'` in `backend/alembic/versions/xxxx_enforce_native_rls.py`.
  2. In `xxxx_enforce_native_rls.py`, rename table `attendance_records` to `attendance_events`.
  3. Add `deleted_at = Column(DateTime(timezone=True), nullable=True)` to `backend/app/models/tenant.py` for both `User` and `Tenant` models, or align queries in `users.py` and `tenants.py` to `is_active == True`.
  4. Standardize `tenant_id` column data types in `models/audit_log.py` and `models/communication.py` to native PostgreSQL `UUID(as_uuid=True)`.
- **Verification Gate:** `alembic -c backend/alembic.ini heads` displays single clean head `b749d0e2e92b (head)`. `alembic check` passes without discrepancies.

---

### Stage 3: Authentication & Token Lifecycle
- **Target Defects:** DEF-P0-06
- **Actions:**
  1. Standardize authentication token storage keys in `frontend/app/login/page.tsx` to set both `'access_token'` and `'token'` (and `'refresh_token'`).
  2. Update `frontend/lib/api-client.ts` to inspect `'access_token'` with fallback to `'token'`.
  3. Ensure logout cleans all storage keys (`access_token`, `token`, `user_role`, `tenant_id`).
- **Verification Gate:** Browser login persists tokens cleanly; `api-client.ts` retrieves valid Bearer string without returning `null`.

---

### Stage 4: Tenant Isolation & Database RLS Enforcement
- **Target Defects:** DEF-P0-02, DEF-P1-08
- **Actions:**
  1. Refactor all 28 router modules in `backend/app/api/endpoints/` to import `get_db` exclusively from `app.api.deps`.
  2. In `backend/app/core/tenant_guard.py`, enforce fail-closed security: raise `PermissionError` when `tenant_id` is missing on non-exempt queries.
  3. Purge hardcoded fallback tenant UUID (`"1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"`) in `students.py:103` and `communication.py:86`.
- **Verification Gate:** Run `tests/test_rls_isolation.py`; verify cross-tenant data queries are strictly rejected.

---

### Stage 5: Role-Based Access Control (RBAC) & Endpoint Authorization
- **Target Defects:** DEF-P0-07, DEF-P1-04
- **Actions:**
  1. Add `current_user: User = Depends(require_roles(["superadmin"]))` to `backend/app/api/endpoints/tenants.py` (`GET /`, `POST /`).
  2. Add `current_user: User = Depends(require_roles(["superadmin", "school_admin"]))` to `backend/app/api/endpoints/users.py` (`GET /`, `POST /`).
  3. Synchronize `frontend/components/RoleRouteGuard.tsx` with `dashboard/layout.tsx` navigation whitelists (grant teachers access to academic routines and guardian lists; grant students access to AI Doubt Solver).
- **Verification Gate:** Unauthenticated requests to `/api/v1/users/` and `/api/v1/tenants/` return `401 Unauthorized`. Authorized users can navigate all valid sidebar routes without "Access Denied" errors.

---

### Stage 6: Commercial & Financial Transaction Integrity
- **Target Defects:** DEF-P0-08
- **Actions:**
  1. Add a composite unique index on `(tenant_id, payment_method, transaction_id)` in `FeePayment` model.
  2. Enforce cashier identity logging in `backend/app/api/endpoints/finance.py:collect_student_fee`.
  3. For manual cash collections, generate sequential cashier receipt numbers.
  4. For digital wallet payments (bKash/Nagad), require valid merchant gateway reconciliation before marking invoice status as `COMPLETED`.
- **Verification Gate:** Duplicate transaction ID submissions fail with `409 Conflict`. Audit logs record cashier user IDs for all cash desk receipts.

---

### Stage 7: Frontend & API Synchronization
- **Target Defects:** DEF-P0-06 (TypeScript build), Hardcoded URLs
- **Actions:**
  1. In `frontend/lib/workspaceContext.tsx`, declare `enableAcademyModule: (orgId: string) => Promise<void>` on `WorkspaceContextType` and implement workspace switching.
  2. Migrate raw `fetch("http://127.0.0.1:8000/api/v1/...")` calls across all 18 dashboard subpages to use central typed `lib/api-client.ts`.
  3. Ensure `process.env.NEXT_PUBLIC_API_URL` is universally respected.
- **Verification Gate:** `npx tsc --noEmit` and `npm run build` pass with 0 errors.

---

### Stage 8: Institutional & Academic Workflows
- **Target Defects:** DEF-P1-01, DEF-P1-02, DEF-P1-03, DEF-P1-09
- **Actions:**
  1. Remove duplicate `prefix="/approvals"` in `backend/app/api/endpoints/approvals.py`; standardize status strings to `"pending_review"`.
  2. Add "Publish Exam" action in `frontend/app/dashboard/exams/page.tsx` and connect to backend publishing endpoint.
  3. Remove hardcoded fallback demo report card ("Talha Hussain") in `frontend/app/dashboard/results/page.tsx`.
  4. Close BOLA / IDOR gaps in `students.py` (`profile-360`) and `results.py` (`progress-card`): verify guardian-student linkage.
- **Verification Gate:** Approval requests load cleanly under `/api/v1/approvals/pending`. AI-generated exams appear in student live exams after publishing. Guardians cannot access unauthorized student records.

---

### Stage 9: AI Gateway, PWA & Billing Subsystems
- **Target Defects:** DEF-P1-05, DEF-P1-06, DEF-P1-07
- **Actions:**
  1. Mount `ai_tutor.router` in `backend/app/main.py` under `/api/v1/ai-tutor`.
  2. Remove dead duplicate `backend/app/api/endpoints/subscriptions.py`.
  3. Create standard 192x192 and 512x512 PNG icons in `frontend/public/icons/`.
  4. Deduplicate `fetch` event listeners in `frontend/public/sw.js`.
  5. Move WhatsApp webhook verification token to environment variable and use `hmac.compare_digest`.
- **Verification Gate:** AI Doubt Solver chat succeeds. PWA service worker installs without 404 caching errors.

---

### Stage 10: Containerization, Deployment Hardening & Test Harness
- **Target Defects:** Docker builds, CI test runner
- **Actions:**
  1. Provide mock database session fixtures for `pytest` in `backend/tests/conftest.py` allowing test execution without live Supabase connectivity.
  2. Execute full backend test suite (`pytest -v backend/tests`).
  3. Build and test Docker containers: `docker compose -f docker-compose.prod.yml build`.
  4. Verify Nginx health check routing: `curl -f http://localhost:8000/healthz`.
- **Verification Gate:** All unit and integration tests pass green. Container images build cleanly in multi-stage Docker runner.

---

## 3. Go / No-Go Recommendation for Phase 1 Remediation

### Evaluation Summary:
- **P0 Findings Validated:** 8 / 8 Confirmed (100% precision)
- **Root Causes Identified:** Yes, exact lines and failure mechanisms documented.
- **Baseline Captured:** Yes, git tree, test failures, compiler errors, and Alembic graph recorded.
- **Sequencing Established:** Yes, 10-stage dependency-gated sequence ready.
- **Application State Preserved:** Yes, zero files modified or deleted during Phase 0.

### Formal Recommendation:
**AUTHORIZATION GRANTED TO PROCEED TO PHASE 1 REMEDIATION.**

Phase 1 must execute exclusively on **Stage 1 (Startup Failures & Import Stability)** and **Stage 2 (Database & Migration Integrity)**, followed by immediate execution of the test suite to establish an active, passing CI baseline before any business logic is altered.

