# EducationOS RC1 — Phase 0: Remediation Matrix

**Document Reference:** `RC1-MATRIX-20261103`  
**Evaluation Date:** 2026-11-03  
**Auditor / Security Engineer:** Principal Software Architect & Security Engineer  
**Classification:** REMEDIATION ACTION SPECIFICATION — PHASE 0  
**Scope:** Actionable resolution matrix for all confirmed P0 Release Blockers and critical P1 defects  

---

## 1. Overview & Remediation Principles

This document provides the definitive, technical remediation blueprint for each confirmed vulnerability and structural failure in EducationOS Release Candidate 1. 

### Mandatory Architectural Guardrails:
1. **Zero Downtime & Safe Startup:** The application must never exit (`SystemExit`) or crash during module import. All connectivity checks must reside within asynchronous lifespan handlers with retry backoff.
2. **Fail-Closed Multi-Tenancy:** Multi-tenant boundaries must be enforced at the dependency injection level. Missing tenant context on non-system queries must throw an immediate `403 Forbidden` or `PermissionError`.
3. **Database Migration Lineage:** Alembic migration DAGs must form a single, unbroken directed acyclic graph. Table references in DDL must strictly match declarative SQLAlchemy models.
4. **Unified API & Token Contract:** Frontend code must consume a single, typed API client library with synchronized authentication headers and environment-driven base URLs.

---

## 2. Comprehensive Remediation Matrix

---

### DEF-P0-01: Synchronous Database Probe on Module Import
- **Severity:** P0 — Release Blocker (Availability & Testing Outage)
- **Affected Component:** `backend/app/main.py` (lines 35–43)
- **Root Cause:** Top-level synchronous `with engine.connect() as _conn:` check executed during module import, raising `SystemExit(1)` if database cannot be reached immediately.
- **Reproduction Evidence:** Running `pytest` fails test collection with `INTERNALERROR> SystemExit: 1` in `backend/app/main.py:43`.
- **Proposed Solution:**
  1. Delete lines 35–43 in `backend/app/main.py`.
  2. Implement an asynchronous connectivity probe inside the `lifespan(app: FastAPI)` handler with an exponential backoff retry loop (3 retries, max 5s timeout).
  3. Allow development/offline/mock mode if `ENVIRONMENT == "test"` or `ENVIRONMENT == "offline"`.
- **Dependencies:** None.
- **Regression Tests Required:**
  - `tests/test_startup.py`: Verify that importing `from app.main import app` does not trigger network calls or `SystemExit`.
  - Pytest collection test: `pytest --collect-only` completes with 0 errors across all test files.
- **Rollback Strategy:** Re-insert try/except block if required, but wrap in a conditional `if not os.getenv("PYTEST_CURRENT_TEST")`.

---

### DEF-P0-02: Universal Multi-Tenant RLS & ORM Guard Bypass
- **Severity:** P0 — Release Blocker (Critical Security & Data Segregation Failure)
- **Affected Component:**
  - `backend/app/core/database.py` (lines 21–29)
  - `backend/app/core/tenant_guard.py` (lines 40–44)
  - All router modules in `backend/app/api/endpoints/`
- **Root Cause:**
  All backend routers import `get_db` from `app.core.database` instead of `app.api.deps`. `core.database.get_db` never populates `session.info["tenant_id"]` and never executes `SET LOCAL app.current_tenant_id`. `tenant_guard.py` silently returns on `None`, executing un-scoped queries.
- **Reproduction Evidence:** Grep confirms all 22 active router files import `from app.core.database import get_db`. Trace analysis confirms `session.info.get("tenant_id")` is `None` on all API requests.
- **Proposed Solution:**
  1. Refactor all 28 router modules in `backend/app/api/endpoints/` to import `from app.api.deps import get_db`.
  2. In `backend/app/core/tenant_guard.py`, change line 43 from `return` to:
     ```python
     if not tenant_id:
         if not execute_state.execution_options.get("system_bypass", False):
             raise PermissionError("Zero-Trust Security Violation: Query executed without active tenant context.")
         return
     ```
  3. Ensure `app.api.deps.get_db` is the single source of truth for request sessions.
- **Dependencies:** DEF-P0-01 (must be able to run test suite).
- **Regression Tests Required:**
  - `tests/test_rls_isolation.py`: Query students from Tenant A using Tenant B credentials; verify 0 records returned or 403 Forbidden.
  - Test cross-tenant attendance queries; verify strict isolation.
- **Rollback Strategy:** Revert router imports to `app.core.database.get_db` and reset `tenant_guard.py` to silent return.

---

### DEF-P0-03: Severed Alembic Migration DAG and Nonexistent Table Reference
- **Severity:** P0 — Release Blocker (Deployment Pipeline Breakdown)
- **Affected Component:** `backend/alembic/versions/xxxx_enforce_native_rls.py` (lines 9–20)
- **Root Cause:**
  `down_revision` is set to `'a829f0c2e91a'`, which does not exist in `backend/alembic/versions/`. The migration references table `attendance_records`, whereas the declarative model defines `attendance_events`.
- **Reproduction Evidence:** `./venv/bin/alembic -c backend/alembic.ini heads` crashes with `KeyError: 'a829f0c2e91a'`.
- **Proposed Solution:**
  1. In `xxxx_enforce_native_rls.py`, update `down_revision = '63d9333ead59'`.
  2. In `TABLES` list, replace `"attendance_records"` with `"attendance_events"`.
  3. Verify `alembic heads` reports `b749d0e2e92b (head)`.
- **Dependencies:** None.
- **Regression Tests Required:**
  - Execute `alembic upgrade head --sql` to verify clean SQL DDL generation without Alembic graph errors.
  - Verify `alembic current` matches schema.
- **Rollback Strategy:** Git restore `backend/alembic/versions/xxxx_enforce_native_rls.py`.

---

### DEF-P0-04: Workspace Router Import Crash & Silent Deactivation
- **Severity:** P0 — Release Blocker (Functional Outage)
- **Affected Component:**
  - `backend/app/api/endpoints/workspaces.py` (line 11)
  - `backend/app/main.py` (lines 81–86, 182–183)
- **Root Cause:**
  `workspaces.py` imports `InstitutionalMembership`, which does not exist in `app.models.workspace` (correct class is `WorkspaceMembership`). `main.py` catches `ImportError` and sets `workspaces_router = None`.
- **Reproduction Evidence:** Calling `/api/v1/workspaces/my-workspaces` returns HTTP 404. Log output displays `"workspaces router DISABLED: cannot import name 'InstitutionalMembership'"`.
- **Proposed Solution:**
  1. In `backend/app/api/endpoints/workspaces.py` line 11, replace `InstitutionalMembership` with `WorkspaceMembership`.
  2. Update any references inside `workspaces.py` from `InstitutionalMembership` to `WorkspaceMembership`.
  3. In `main.py`, remove the `try...except ImportError` fallback so that router loading is fail-fast and verified on startup.
- **Dependencies:** DEF-P0-01.
- **Regression Tests Required:**
  - `GET /api/v1/workspaces/my-workspaces`: returns 200 with list of available institution workspaces.
  - `POST /api/v1/workspaces/switch`: returns updated JWT token with selected workspace context.
- **Rollback Strategy:** Restore original import and `try/except` in `main.py`.

---

### DEF-P0-05: Missing FastAPI Lifespan Wiring
- **Severity:** P0 — Release Blocker (Initialization Failure)
- **Affected Component:** `backend/app/main.py` (lines 88–135)
- **Root Cause:** `lifespan(app: FastAPI)` function is implemented with critical DDL migration and index creation logic, but `FastAPI(...)` on line 129 is called without `lifespan=lifespan`.
- **Reproduction Evidence:** Code inspection verifies `app = FastAPI(...)` has no `lifespan` argument. Startup self-healing prints never appear in application logs.
- **Proposed Solution:**
  Update `main.py` line 129:
  ```python
  app = FastAPI(
      title=settings.PROJECT_NAME,
      description="AI-Powered Autonomous School Operating System API",
      lifespan=lifespan,
      openapi_url=None if is_production else f"{settings.API_V1_STR}/openapi.json",
      docs_url=None if is_production else "/docs",
      redoc_url=None if is_production else "/redoc"
  )
  ```
- **Dependencies:** DEF-P0-01 (lifespan must handle DB connectivity safely).
- **Regression Tests Required:**
  - Launch FastAPI test client; verify lifespan startup executes and logs `"Database schema self-healed and perfectly synchronized."`
- **Rollback Strategy:** Remove `lifespan=lifespan` argument.

---

### DEF-P0-06: Frontend Authentication Token Storage Desynchronization
- **Severity:** P0 — Release Blocker (Universal User Access Failure)
- **Affected Component:**
  - `frontend/app/login/page.tsx` (line 81)
  - `frontend/lib/api-client.ts` (line 5)
  - `frontend/lib/workspaceContext.tsx`
  - `frontend/components/AcademySetupWizard.tsx` (line 9)
- **Root Cause:**
  `login/page.tsx` stores JWT under `"token"`. `api-client.ts` retrieves `"access_token"`, leading to empty auth headers. `AcademySetupWizard.tsx` calls `enableAcademyModule()`, which is missing from `WorkspaceContextType`, breaking TypeScript compilation.
- **Reproduction Evidence:**
  - `npm run build` fails with `TS2339: Property 'enableAcademyModule' does not exist on type 'WorkspaceContextType'`.
  - Manual trace shows `api-client.ts` sends `Authorization: Bearer null`.
- **Proposed Solution:**
  1. Standardize frontend storage: In `login/page.tsx`, set both `"access_token"` and `"token"` (or migrate all to canonical `"access_token"`).
  2. In `frontend/lib/api-client.ts`, fallback to `localStorage.getItem('token')` if `'access_token'` is null.
  3. In `frontend/lib/workspaceContext.tsx`, add `enableAcademyModule: (orgId: string) => Promise<void>` to `WorkspaceContextType` and provide the implementation.
- **Dependencies:** None.
- **Regression Tests Required:**
  - `npm run build`: Completes successfully with 0 TypeScript errors.
  - End-to-end login flow: Submitting valid credentials persists tokens and enables authenticated dashboard requests.
- **Rollback Strategy:** Revert changes to `login/page.tsx` and `workspaceContext.tsx`.

---

### DEF-P0-07: Public Unauthenticated User and Tenant Endpoints with 500 Crashes
- **Severity:** P0 — Release Blocker (Security Breach & Runtime Crash)
- **Affected Component:**
  - `backend/app/api/endpoints/users.py` (lines 66–74)
  - `backend/app/api/endpoints/tenants.py` (lines 40–47)
- **Root Cause:**
  `GET /` in both routers has no authentication dependency and queries `deleted_at`, which does not exist on `User` or `Tenant` models.
- **Reproduction Evidence:** Code inspection confirms `User` and `Tenant` lack `deleted_at`. Calling `GET /api/v1/users/` or `GET /api/v1/tenants/` results in `AttributeError`.
- **Proposed Solution:**
  1. In `endpoints/users.py`:
     - Add `current_user: User = Depends(require_roles(["superadmin", "school_admin"]))`.
     - Change filter from `User.deleted_at.is_(None)` to `User.is_active == True`.
  2. In `endpoints/tenants.py`:
     - Add `current_user: User = Depends(require_roles(["superadmin"]))`.
     - Change filter from `Tenant.deleted_at.is_(None)` to `Tenant.created_at.isnot(None)` or add `is_active` check.
- **Dependencies:** DEF-P0-02 (auth guards and session isolation).
- **Regression Tests Required:**
  - Unauthenticated `GET /api/v1/users/`: Returns `401 Unauthorized`.
  - Authenticated non-admin `GET /api/v1/tenants/`: Returns `403 Forbidden`.
  - Superadmin `GET /api/v1/users/?tenant_id=...`: Returns 200 with active user list.
- **Rollback Strategy:** Revert dependencies and filters.

---

### DEF-P0-08: Unverified Payment Gateway Webhooks and Client-Asserted Collections
- **Severity:** P0 — Release Blocker (Financial Fraud Exposure)
- **Affected Component:**
  - `backend/app/api/endpoints/finance.py` (lines 255–265)
  - `backend/app/services/payment_providers.py` (lines 81–142)
- **Root Cause:**
  Manual fee collection endpoint marks payment status `COMPLETED` based on client-provided `transaction_id` strings without verifying gateway status or duplicate transaction IDs. Provider classes are mock stubs returning `True`.
- **Reproduction Evidence:** `finance.py` assigns `new_payment.payment_status = "COMPLETED"` and commits immediately without calling gateway APIs or checking existing transaction references.
- **Proposed Solution:**
  1. For offline/counter payments, mark `payment_method = "CASH"` and generate a sequential cashier receipt number (`CASH-REC-{tenant_id}-{counter}`).
  2. For digital mobile wallet payments (bKash/Nagad), if entered manually by cashier:
     - Require cashier user ID in audit trail.
     - Add a database unique constraint on `(tenant_id, payment_method, transaction_id)` to prevent replay/duplicate reuse of the same TrxID.
  3. For automated online payments, route through server-to-server gateway verification (`bKash Query API` / `Nagad Verification API`) before setting `payment_status = "COMPLETED"`.
- **Dependencies:** DEF-P0-02, DEF-P0-05.
- **Regression Tests Required:**
  - Duplicate transaction ID submission returns `409 Conflict`.
  - Verify manual cash payments log cashier user ID in `metadata_payload`.
- **Rollback Strategy:** Revert unique constraint and validation checks.

---

## 3. High-Priority P1 Defect Remediation Summary

| Defect ID | Affected File | Root Cause | Proposed Solution |
| :--- | :--- | :--- | :--- |
| **DEF-P1-01** | `endpoints/approvals.py:14`, `main.py:165` | Double prefix `/approvals/approvals/` and status casing mismatch (`"pending_review"` vs `"Pending"`). | Remove `prefix="/approvals"` in `approvals.py`; standardize status strings to lowercase `"pending_review"`. |
| **DEF-P1-02** | `dashboard/exams/page.tsx`, `academy.py` | AI question papers created with `is_published=False` without publish action. | Add "Publish Exam" button in `dashboard/exams/page.tsx` and wire to `PUT /api/v1/question-papers/{id}/publish`. |
| **DEF-P1-03** | `dashboard/results/page.tsx:113` | Hardcoded demo fallback ("Talha Hussain", GPA 5.0) on 422 error. | Remove fallback mock object; display clear error banner and empty state. |
| **DEF-P1-04** | `components/RoleRouteGuard.tsx` | Whitelist desynchronized from `dashboard/layout.tsx`. | Add `teacher` and `student` to authorized roles for academic routines and AI Doubt Solver. |
| **DEF-P1-05** | `public/sw.js`, `public/icons/` | Conflicting `fetch` handlers in service worker and missing icons directory. | Deduplicate `fetch` event listeners; add standard 192x192 and 512x512 PNG icons to `public/icons/`. |
| **DEF-P1-06** | `endpoints/ai_tutor.py`, `main.py` | `ai_tutor.py` unmounted in `main.py`, returning 404 on `/api/v1/ai-tutor/chat`. | Mount `ai_tutor.router` in `main.py` under `/api/v1/ai-tutor`. |
| **DEF-P1-07** | `endpoints/communication.py:43` | Hardcoded WhatsApp secret token `"educationos_webhook_secret_2026"`. | Read token from `settings.WHATSAPP_VERIFY_TOKEN` and use `hmac.compare_digest`. |
| **DEF-P1-08** | `endpoints/students.py:103`, `communication.py:86` | Hardcoded fallback UUID `"1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"`. | Delete hardcoded fallback string; raise `HTTPException(400, "Tenant context required")`. |
| **DEF-P1-09** | `endpoints/students.py` (`profile-360`), `results.py` | BOLA / IDOR vulnerability allowing guardians to view any student's data. | Add explicit guardianship check: verify `student_id` exists in `guardian.students`. |

