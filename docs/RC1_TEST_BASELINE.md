# EducationOS RC1 — Phase 0: Test & System Baseline Report

**Document Reference:** `RC1-BASE-20261103`  
**Evaluation Date:** 2026-11-03  
**Auditor / Security Engineer:** Principal Software Architect & Security Engineer  
**Classification:** HIGH-ASSURANCE BASELINE AUDIT — PHASE 0  
**Scope:** Git state, Backend test suite, Frontend build/type-check, Alembic DAG, Database connectivity, Docker and Environment baseline  
**Execution Mode:** Strictly Non-Destructive Inspection  

---

## 1. Git Working Tree & Source Baseline

### 1.1 Branch & Commit Identification
- **Current Branch:** `main`
- **Tracking Branch:** `origin/main` (Up to date)
- **Head Commit:** `3179bbf` — *"Updated exams page, fixed bugs and security updates"*
- **Preceding Commits:**
  - `3d683f1` — *"Updated live exams & exams sections"*
  - `7b0b43c` — *"Backend & Frontend updated for Pilot Project"*

### 1.2 Unstaged Modifications
The working tree contains **44 modified files** (2,233 insertions, 1,093 deletions) representing uncommitted work from previous sprints:
- **Backend Core & Config:**
  - `backend/app/main.py`
  - `backend/app/core/config.py`
  - `backend/app/core/database.py`
  - `backend/app/core/security.py`
  - `backend/app/api/deps.py`
- **Backend Endpoints:**
  - `academy.py`, `ai.py`, `attendance.py`, `audit.py`, `auth.py`, `communication.py`, `dashboard.py`, `finance.py`, `question_papers.py`, `students.py`, `teacher_diary.py`, `teachers.py`, `tenants.py`
- **Backend Models & Schemas:**
  - `approval.py`, `attendance.py`, `audit.py`, `live_exam.py`, `student.py`, `workspace.py`, `schemas/attendance.py`, `schemas/teacher.py`
- **Frontend Pages & State:**
  - `app/layout.tsx`, `app/page.tsx`, `app/login/page.tsx`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/attendance/page.tsx`, `app/dashboard/notices/page.tsx`, `app/dashboard/results/page.tsx`, `components/CommandMenu.tsx`, `lib/apiClient.ts`, `lib/workspaceContext.tsx`, `next.config.ts`, `public/sw.js`

### 1.3 Untracked Files
Untracked infrastructure, reports, and new modules:
- Audit documentation (`EDUCATIONOS_RC1_AUDIT.md`, `FRONTEND_ROUTE_INVENTORY.md`, `BACKEND_API_INVENTORY.md`, `DATABASE_SCHEMA_AUDIT.md`, `SECURITY_GAP_REPORT.md`, `PRODUCTION_BLOCKERS.md`, `EducationOS_OWASP_Top10_2025_Security_Remediation_Report.pdf`)
- Deployment specifications (`Dockerfile` for backend & frontend, `docker-compose.prod.yml`, `nginx/`, `deploy.sh`)
- Unmounted or new endpoints (`billing.py`, `notifications.py`, `subscriptions.py`, `workspaces.py`)
- New models (`notification.py`, `subscription.py`, `subscription_payment.py`)
- New frontend components (`pricing/`, `AcademySetupWizard.tsx`, `PWAInstallPrompt.tsx`, `RoleRouteGuard.tsx`, `pushNotification.ts`, `manifest.json`)
- Backend test files (`test_owasp_top10_audit.py`, `test_production_blueprint.py`)

---

## 2. Backend Test Collection & Execution Baseline

### 2.1 Invocation from Project Root
- **Command:** `./venv/bin/pytest backend/tests --collect-only`
- **Result:** **FAILED (Exit Code: 2)**
- **Failure Output:**
  ```
  pydantic_core._pydantic_core.ValidationError: 2 validation errors for Settings
  DATABASE_URL: Field required
  SECRET_KEY: Field required
  ==================== no tests collected, 6 errors in 1.32s =====================
  ```
- **Analysis:** `backend/app/core/config.py` specifies `SettingsConfigDict(env_file=".env")`. When invoked from the workspace root, Pydantic searches for `./.env` instead of `backend/.env`, causing settings initialization to fail.

### 2.2 Invocation from `backend/` Directory
- **Command:** `cd backend && ../venv/bin/pytest tests --collect-only`
- **Result:** **FAILED (Exit Code: 3 — Internal Crash)**
- **Failure Output:**
  ```
  INTERNALERROR> psycopg2.OperationalError: could not translate host name "aws-1-ap-south-1.pooler.supabase.com" to address: nodename nor servname provided, or not known
  INTERNALERROR>   File ".../backend/app/main.py", line 43, in <module>
  INTERNALERROR>     raise SystemExit(1)
  INTERNALERROR> SystemExit: 1
  mainloop: caught unexpected SystemExit!
  ========================= no tests collected in 0.97s ==========================
  ```
- **Analysis:** `backend/app/main.py` lines 35–43 executes a synchronous database probe on module import (`from app.main import app`). When external DNS resolution is unavailable or the remote Supabase database cannot be reached, the process exits with `SystemExit(1)`. Pytest cannot collect any test cases.

### 2.3 Existing Test Inventory in `backend/tests/`
| Test File | Intended Target | Status |
| :--- | :--- | :--- |
| `test_owasp_top10_audit.py` | OWASP security controls & injections | Blocked at collection by `app.main` crash |
| `test_p1_5_p2.py` | Priority 1.5 & Priority 2 issue regression | Blocked at collection |
| `test_production_blueprint.py` | Endpoint status codes & blueprint conformance | Blocked at collection |
| `test_rls_isolation.py` | Tenant RLS boundary tests | Blocked at collection |
| `test_sprint2_security_audit.py`| Token tampering & expired signature handling | Blocked at collection |
| `test_sprint3_data_integrity.py`| Concurrent payment & fee idempotency | Blocked at collection |

---

## 3. Frontend Build & Type-Check Baseline

### 3.1 Type-Check Execution
- **Command:** `cd frontend && npx tsc --noEmit`
- **Result:** **FAILED (Exit Code: 2)**
- **Compiler Output:**
  ```
  components/AcademySetupWizard.tsx:9:29 - error TS2339: Property 'enableAcademyModule' does not exist on type 'WorkspaceContextType'.

  9   const { currentWorkspace, enableAcademyModule } = useWorkspace();
                                ~~~~~~~~~~~~~~~~~~~
  Found 1 error in components/AcademySetupWizard.tsx:9
  ```
- **Analysis:** `frontend/lib/workspaceContext.tsx` defines `WorkspaceContextType` without `enableAcademyModule`. The TypeScript compiler strictly rejects this type mismatch.

### 3.2 Production Build Execution
- **Command:** `cd frontend && npm run build`
- **Result:** **FAILED (Exit Code: 1)**
- **Failure Output:**
  1. **Compilation Error:** TS2339 in `components/AcademySetupWizard.tsx:9:29`.
  2. **Font Resolution Error:** Turbopack failed to fetch `Geist` and `Geist Mono` from Google Fonts in sandbox/offline mode without local font fallbacks.

### 3.3 Frontend Test Runner Status
- **Status:** **NOT IMPLEMENTED**
- `frontend/package.json` contains no test runner configuration (no Jest, Vitest, Cypress, or Playwright dependencies or test scripts).

---

## 4. Alembic Migration Graph Baseline

### 4.1 Migration Files & Revisions
Inspection of `backend/alembic/versions/` reveals 10 revision scripts:

```
[d771a4257381] Initial EducationOS schema (down: None)
      │
      ▼
[a730523ae10e] Added academic and attendance tables (down: d771a4257381)
      │
      ▼
[b47fb5402710] Add attendance events table (down: a730523ae10e)
      │
      ▼
[ccc2ff1e7e5a] Added exams (down: b47fb5402710)
      │
      ▼
[dbd17cdd99a1] Add attendance table (down: ccc2ff1e7e5a)
      │
      ▼
[1b75f5036285] Add communication (down: dbd17cdd99a1)
      │
      ▼
[f3a1b2c4d5e6] Add student extended fields (down: 1b75f5036285)
      │
      ▼
[a1b2c3d4e5f6] Add guardian extended fields (down: f3a1b2c4d5e6)
      │
      ▼
[63d9333ead59] Add amount to fee payments (down: a1b2c3d4e5f6)
      │
      ▼
[b749d0e2e92b] enforce_native_postgresql_rls (down: a829f0c2e91a) <--- SEVERED DAG!
```

### 4.2 Alembic Command Execution
- **Command:** `./venv/bin/alembic -c backend/alembic.ini heads`
- **Result:** **FAILED (Exit Code: 1)**
- **Output:**
  ```
  UserWarning: Revision a829f0c2e91a referenced from a829f0c2e91a -> b749d0e2e92b (head), enforce_native_postgresql_rls is not present
  KeyError: 'a829f0c2e91a'
  ```
- **Analysis:** `b749d0e2e92b` references an invalid revision `a829f0c2e91a` instead of `63d9333ead59`. Alembic cannot calculate migration heads or upgrade the database.

---

## 5. Database Connectivity & Schema Synchronization Baseline

### 5.1 Remote Database Connectivity
- `backend/.env` points to a Supabase PostgreSQL pooler instance (`aws-1-ap-south-1.pooler.supabase.com:6543/postgres`).
- In isolated local sandbox environments or offline CI runners, DNS resolution for Supabase fails, triggering immediate failure of `backend/app/main.py:43`.

### 5.2 Schema Mismatches
1. **Attendance Events Table:**
   - Declarative model (`backend/app/models/attendance.py`): `__tablename__ = "attendance_events"`.
   - Migration `xxxx_enforce_native_rls.py`: references `attendance_records`.
2. **Missing `deleted_at` Columns:**
   - Queried in `endpoints/users.py:73` and `endpoints/tenants.py:46`.
   - Neither `User` nor `Tenant` model declares `deleted_at`.
3. **Missing Lifespan DDL Execution:**
   - `main.py:88-125` implements DDL patches (`idempotency_key`, `payment_date`, `first_name`, `last_name`), but the lifespan hook is never executed because `FastAPI(..., lifespan=lifespan)` was omitted.

---

## 6. Docker & Container Configuration Baseline

### 6.1 `docker-compose.prod.yml`
- Defines three services: `backend`, `frontend`, `nginx`.
- `backend`: Exposes 8000 on network `educationos_net`.
- `frontend`: Exposes 3000 on network `educationos_net`.
- `nginx`: Binds ports 80 and 443; mounts `nginx.conf` and Certbot SSL volumes.

### 6.2 Dockerfiles
- **`backend/Dockerfile`**: Two-stage Python 3.12-slim build with non-root user (`appuser:appgroup`).
  - *Risk:* `HEALTHCHECK CMD curl -f http://localhost:8000/healthz` will fail if `main.py` crashes on boot.
- **`frontend/Dockerfile`**: Three-stage Node 20-alpine build with Next.js standalone output.
  - *Current Status:* Fails at Stage 2 (`RUN npm run build`) due to TypeScript error in `AcademySetupWizard.tsx`.

### 6.3 `nginx/nginx.conf`
- Configured with HTTP->HTTPS redirect, TLSv1.2/1.3, rate limiting (`api_limit: 20r/s`), and reverse proxies for `/api/` (backend) and `/` (frontend).

---

## 7. Environment Configuration Baseline (Sanitized)

| Variable Key | Location | Status / Requirement |
| :--- | :--- | :--- |
| `PROJECT_NAME` | `backend/.env` | Configured |
| `ENVIRONMENT` | `backend/.env` | Configured |
| `API_V1_STR` | `backend/app/core/config.py` | Defaults to `/api/v1` |
| `DATABASE_URL` | `backend/.env` | Configured (Remote Supabase Pooler) |
| `SECRET_KEY` | `backend/.env` | Configured (Passes 32-char validator) |
| `JWT_ALGORITHM` | `backend/app/core/config.py` | Defaults to `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `backend/app/core/config.py` | Defaults to `11520` (8 days) |
| `CORS_ORIGINS` | `backend/app/core/config.py` | `["http://localhost:3000", "http://127.0.0.1:3000", "https://schoolos.app"]` |
| `GEMINI_API_KEY` | `backend/.env` | Configured |
| `OPENROUTER_API_KEY` | `backend/.env` | Configured |
| `GROQ_API_KEY` | `backend/.env` | Configured |
| `PAYMENT_WEBHOOK_SECRET` | `backend/.env` | Configured |
| `PAYMENT_CHECKOUT_BASE_URL` | `backend/.env` | Configured |
| `NEXT_PUBLIC_API_URL` | `frontend/` | Missing in frontend env; falls back to `http://localhost:8000` |

---

## 8. Baseline Summary Matrix

```
+-----------------------------------------------------------------------------------------+
|                               SYSTEM BASELINE STATUS                                    |
+-----------------------------------------------------------------------------------------+
| Component                | Status   | Primary Failure Point                             |
+--------------------------+----------+---------------------------------------------------+
| Git Working Tree         | Dirty    | 44 modified files, 22 untracked items             |
| Backend Tests            | FAILING  | SystemExit(1) on import main.py                   |
| Frontend Type-Check      | FAILING  | TS2339 in AcademySetupWizard.tsx:9:29            |
| Frontend Build           | FAILING  | Blocked by TS2339 & Google Fonts fetch            |
| Alembic Migration DAG    | BROKEN   | KeyError: 'a829f0c2e91a'                          |
| Multi-Tenant RLS         | BYPASSED | All routers import core.database.get_db           |
| Workspaces Router        | CRASHED  | ImportError: InstitutionalMembership              |
| Docker Production Build  | BLOCKED  | Blocked by frontend TypeScript failure            |
+-----------------------------------------------------------------------------------------+
```

