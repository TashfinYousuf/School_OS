# EducationOS Production Blockers & Defect Register

**Audit Date:** 2026-11-01  
**Auditor:** Principal Software Architect  
**Classification:** RELEASE BLOCKER AUDIT — RELEASE CANDIDATE 1 (RC1)  
**Status:** **NOT READY FOR PRODUCTION DEPLOYMENT**

---

## 1. Executive Summary

A comprehensive pre-release architectural audit of the EducationOS repository has identified **8 Priority-0 (P0) Release Blockers**, **9 Priority-1 (P1) Critical Defects**, and **7 Priority-2 (P2) Major Defects**.

Deployment to production in the current state will result in container crash loops, multi-tenant data contamination, complete failure of the workspace and coaching modules, silent loss of examination materials, and severe financial fraud exposure.

---

## 2. Priority-0 (P0) Release Blockers

### BLK-P0-01: Module-Import Synchronous Database Crash on Startup
- **Severity:** P0 — Total Service Outage
- **Files Affected:** `backend/app/main.py` (Lines 35–43)
- **Root Cause:**
  A synchronous database connection check (`with engine.connect() as conn: conn.execute(text("SELECT 1"))`) is executed at top-level module import time. If the database is cold, experiencing DNS resolution lag, or if test runners import `app` without an active database connection, it calls `raise SystemExit(1)`.
- **Impact:**
  - Automated CI/CD test collection fails with an instant fatal exit code.
  - Container orchestrators (Docker Swarm, Kubernetes) experience immediate crash loops before readiness probes can even initialize.
- **Remediation:**
  Remove the top-level `engine.connect()` check. Move database ping and schema verification inside the FastAPI `lifespan` context manager with retry logic.

---

### BLK-P0-02: Universal Multi-Tenant Data Leak via `get_db` Session Injection
- **Severity:** P0 — Critical Security Breach & Data Corruption
- **Files Affected:**
  - `backend/app/core/database.py` (Lines 18–24)
  - `backend/app/core/tenant_guard.py` (Lines 22–32)
  - All 28 router modules in `backend/app/api/endpoints/`
- **Root Cause:**
  All backend endpoints import `from app.core.database import get_db` rather than `from app.api.deps import get_db`. `core.database.get_db` does not extract tenant headers or populate `session.info["tenant_id"]`. `tenant_guard.py` silently returns on `None`, bypassing both the SQLAlchemy ORM filter and PostgreSQL native RLS.
- **Impact:**
  Institutional data isolation fails completely. Queries without manual tenant filters return cross-tenant data, creating massive privacy violations and regulatory non-compliance.
- **Remediation:**
  Refactor all 28 routers in `backend/app/api/endpoints/` to import `get_db` from `app.api.deps`. Update `tenant_guard.py` to raise a `PermissionError` if `tenant_id` is missing.

---

### BLK-P0-03: Severed Alembic Migration DAG and Nonexistent Table Reference
- **Severity:** P0 — Deployment Pipeline Breakdown
- **Files Affected:** `backend/alembic/versions/xxxx_enforce_native_rls.py` (Lines 12–25)
- **Root Cause:**
  - Migration declares `down_revision = 'a829f0c2e91a'`, which does not exist in the repository.
  - Migration executes DDL against table `attendance_records`, which does not exist in the declarative schema (the table is named `attendance_events`).
- **Impact:**
  Running `alembic upgrade head` on fresh staging or production databases fails immediately, halting automated deployments.
- **Remediation:**
  - Update `down_revision` to the actual parent migration revision hash.
  - Correct the DDL statement to reference `attendance_events`.

---

### BLK-P0-04: Workspace Router Crash Due to Invalid Model Import
- **Severity:** P0 — Broken Core Architecture
- **Files Affected:**
  - `backend/app/api/endpoints/workspaces.py` (Line 11)
  - `backend/app/main.py` (Lines 270–274)
- **Root Cause:**
  `workspaces.py` attempts to import `InstitutionalMembership` from `app.models.workspace`. The model is actually named `WorkspaceMembership`. `main.py` catches `ImportError` and skips the router.
- **Impact:**
  The workspace router is never loaded. Requests to `/api/v1/workspaces/my-workspaces` return HTTP 404. Multi-school groups and academy networks cannot manage or switch workspaces.
- **Remediation:**
  Change the import statement in `workspaces.py` to `from app.models.workspace import WorkspaceMembership`.

---

### BLK-P0-05: Missing FastAPI Lifespan Parameter Disabling Startup Hooks
- **Severity:** P0 — System Initialization Failure
- **Files Affected:** `backend/app/main.py` (Lines 88–130)
- **Root Cause:**
  An async lifespan function `lifespan(app: FastAPI)` containing database self-healing, missing column creation, and background scheduler startup is implemented, but `app = FastAPI(...)` is instantiated **without** `lifespan=lifespan`.
- **Impact:**
  Database self-healing DDL, automated schema checks, and background worker threads never run on startup.
- **Remediation:**
  Instantiate the application with `app = FastAPI(..., lifespan=lifespan)`.

---

### BLK-P0-06: Frontend Authentication Token Storage Desynchronization
- **Severity:** P0 — Universal User Access Failure
- **Files Affected:**
  - `frontend/app/login/page.tsx` (Line 48)
  - `frontend/lib/api-client.ts` (Line 12)
- **Root Cause:**
  `login/page.tsx` stores access tokens under `localStorage.setItem('token', ...)`, whereas the central API client `lib/api-client.ts` reads `localStorage.getItem('access_token')`.
- **Impact:**
  Authenticated users receive `null` Bearer tokens when using `api-client.ts`, resulting in immediate `401 Unauthorized` responses and broken dashboard widgets.
- **Remediation:**
  Standardize token key names across the entire frontend to `'access_token'` and `'refresh_token'`.

---

### BLK-P0-07: Public Unauthenticated User and Tenant Endpoints with 500 Crashes
- **Severity:** P0 — Security Vulnerability & Runtime Crash
- **Files Affected:**
  - `backend/app/api/endpoints/users.py` (Lines 22–36)
  - `backend/app/api/endpoints/tenants.py` (Lines 20–34)
- **Root Cause:**
  Endpoints lack `get_current_user` dependencies and query `Model.deleted_at.is_(None)`. Neither `User` nor `Tenant` models define a `deleted_at` column.
- **Impact:**
  - Current state: Returns unhandled 500 `AttributeError` exceptions.
  - If fixed naively without authentication: Exposes sensitive PII and institutional configurations to unauthenticated public scraping.
- **Remediation:**
  Add `current_user: User = Depends(require_roles(["superadmin"]))` and change query filters to `is_active == True`.

---

### BLK-P0-08: Unverified Payment Gateway Webhooks and Client-Asserted Collections
- **Severity:** P0 — Financial Fraud & Revenue Loss
- **Files Affected:**
  - `backend/app/api/endpoints/finance.py`
  - `backend/app/services/payment_providers.py`
- **Root Cause:**
  Payment webhooks and fee collection endpoints accept client-asserted transaction IDs (`TrxID`) without verifying cryptographic signatures or performing server-to-server gateway confirmation callbacks.
- **Impact:**
  Students or unauthorized personnel can mark institutional fee invoices as `PAID` using synthetic transaction IDs with zero funds transferred.
- **Remediation:**
  Enforce RSA/HMAC signature verification on webhooks and execute mandatory server-to-server query verification before clearing invoices.

---

## 3. Priority-1 (P1) Critical Defects

### BLK-P1-01: Double Routing Prefix on Approvals Router
- **Files Affected:**
  - `backend/app/api/endpoints/approvals.py` (Line 14)
  - `backend/app/main.py` (Line 225)
- **Root Cause:** `approvals.py` defines `prefix="/approvals"` and `main.py` mounts it with `prefix=f"{settings.API_V1_STR}/approvals"`, exposing routes at `/api/v1/approvals/approvals/...`.
- **Impact:** Frontend calls to `/api/v1/approvals/pending` produce HTTP 404. All administrative approval workflows are broken.

---

### BLK-P1-02: AI-Generated Question Papers Trapped in Draft State
- **Files Affected:**
  - `frontend/app/dashboard/exams/page.tsx`
  - `backend/app/api/endpoints/academy.py`
- **Root Cause:** Generated exams default to `is_published=False`. The UI lacks an "Approve / Publish" action, while student live exams strictly query `is_published == True`.
- **Impact:** Question papers generated via AI never reach students.

---

### BLK-P1-03: Hardcoded Demo Report Card Fallback in Results Portal
- **Files Affected:** `frontend/app/dashboard/results/page.tsx` (Lines 140–160)
- **Root Cause:** Calls `/api/v1/results/progress-card/my-child`, fails with HTTP 422, catches exception, and renders static mock report card for "Talha Hussain" (GPA 5.0).
- **Impact:** Parents and students receive false academic results.

---

### BLK-P1-04: Desynchronized RoleRouteGuard Whitelists
- **Files Affected:** `frontend/components/RoleRouteGuard.tsx`
- **Root Cause:** Diverges from sidebar navigation in `layout.tsx`. Blocks teachers from academic routines and guardian lists, and blocks students from AI Doubt Solver.
- **Impact:** Legitimate users encounter "Access Denied" errors on valid navigation links.

---

### BLK-P1-05: Broken Academy Setup Wizard Runtime Method
- **Files Affected:**
  - `frontend/components/AcademySetupWizard.tsx` (Line 72)
  - `frontend/lib/workspaceContext.tsx`
- **Root Cause:** Wizard calls `enableAcademyModule()`, which is undefined on `WorkspaceContextType`.
- **Impact:** Unhandled runtime JavaScript crash when launching the academy onboarding wizard.

---

### BLK-P1-06: Unmounted Dead Subscriptions and AI Tutor Routers
- **Files Affected:**
  - `backend/app/api/endpoints/subscriptions.py`
  - `backend/app/api/endpoints/ai_tutor.py`
- **Root Cause:** Modules exist in the repository but are omitted from `app.include_router` in `backend/app/main.py`.
- **Impact:** Frontend AI chat requests to `/api/v1/ai-tutor/chat` return 404. Dead subscription logic diverges from active `billing.py`.

---

### BLK-P1-07: Broken PWA Offline Service Worker and Missing Assets
- **Files Affected:**
  - `frontend/public/sw.js`
  - `frontend/public/icons/`
- **Root Cause:** Service worker defines conflicting `fetch` listeners and attempts to pre-cache nonexistent icon files (`/icons/icon-192.png`).
- **Impact:** PWA installation fails in production; offline caching breaks.

---

### BLK-P1-08: Hardcoded Fallback Tenant UUIDs in Business Logic
- **Files Affected:**
  - `backend/app/api/endpoints/students.py` (Line 103)
  - `backend/app/api/endpoints/communication.py` (Line 86)
- **Root Cause:** Uses `"1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"` as a fallback when `current_user.tenant_id` is null.
- **Impact:** Unscoped operations write data into an arbitrary institutional tenant.

---

### BLK-P1-09: Broken Object Level Authorization (IDOR) on Student 360 & Grades
- **Files Affected:**
  - `backend/app/api/endpoints/students.py` (`profile-360`)
  - `backend/app/api/endpoints/results.py` (`progress-card`)
- **Root Cause:** Verifies user role without checking parent-child or teacher-student linkage.
- **Impact:** Guardians can access unauthorized student academic and financial records.

---

## 4. Priority-2 (P2) Major Defects

| Blocker ID | Affected Component | Description |
| :--- | :--- | :--- |
| **BLK-P2-01** | `frontend/app/dashboard/settings/page.tsx` | Calls `PUT /api/v1/tenants/current`, but backend only provides `/` and `/{id}`. Fails with 404. |
| **BLK-P2-02** | `backend/app/api/endpoints/academy.py` | `/omr-camera-scan` and `/dispatch-result-sms` return synthetic mock data without processing or sending. |
| **BLK-P2-03** | `frontend/components/VoiceLessonModal.tsx` | Simulates audio recording via `setTimeout`; no Web Audio or speech API integration. |
| **BLK-P2-04** | `backend/app/models/communication.py` | `tenant_id` is defined as `String(36)` instead of native `UUID`, breaking PostgreSQL RLS cast. |
| **BLK-P2-05** | `frontend/lib/workspaceContext.tsx` | `switchWorkspace: () => {}` is an empty no-op stub function. |
| **BLK-P2-06** | `backend/app/api/endpoints/communication.py` | WhatsApp webhook verification secret is hardcoded as `"educationos_webhook_secret_2026"`. |
| **BLK-P2-07** | `frontend/dashboard/page.tsx` | Teacher, Student, and Guardian dashboard views display static hardcoded metrics. |

---

## 5. Resolution Roadmap Summary

All P0 blockers must be resolved, verified, and regression-tested prior to tag creation and deployment of Release Candidate 1.

```
+-------------------------------------------------------------------------+
|                       RC1 REMEDIATION GATEWAY                           |
+-------------------------------------------------------------------------+
  [Step 1: P0 Startup & Deploy]
    -> Fix main.py import engine.connect() crash
    -> Fix workspaces.py model import
    -> Fix Alembic RLS migration DAG and table name
    -> Add lifespan=lifespan to FastAPI instantiation

  [Step 2: P0 Multi-Tenancy & Auth]
    -> Switch all routers from core.database.get_db to deps.get_db
    -> Enforce fail-closed check in tenant_guard.py
    -> Unify localStorage token key to 'access_token' in frontend
    -> Add superadmin auth & fix deleted_at on users.py & tenants.py

  [Step 3: P0 Commercial & Verification]
    -> Implement server-side verification on payment webhooks
    -> Strip hardcoded demo data fallbacks from results and dashboard
+-------------------------------------------------------------------------+
```

