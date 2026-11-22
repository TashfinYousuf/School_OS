# EducationOS Forensic Analysis & Root-Cause Remediation
## Backend Admission Connection Failures & PostgreSQL Pool Hardening

**Document ID:** `EDOS-QA-P0A-001`  
**Classification:** Critical Forensic Defect Investigation & Production Remediation  
**Scope:** Admission Module (`admissions/page.tsx`, `admissions.py`), PostgreSQL/Supabase Connection Management, Auth Dependencies  
**Pilot Institution:** Kids Shine International School (KSIS), Dhaka, Bangladesh  
**Status:** VERIFIED & RESOLVED  

---

## 1. Executive Summary

During real-world pilot validation of the Admission Center (`/dashboard/admissions`), users intermittently experienced connection dropouts, generic error alerts (*"Failed to load admission data"*), and public prospective applicants/parents could not submit applications or track status.

This document presents the independent forensic root-cause analysis, reproduction traces, architectural remediations, and verifiable evidence proving complete resolution.

---

## 2. Forensic Root Causes Identified

### Root Cause 1: Unauthenticated Public Access Blocked by Authenticated `get_db` Dependency
- **Failure Mechanism:** In FastAPI, the standard database session dependency `get_db(tenant_id: str = Depends(get_current_tenant_id))` required `get_current_user_claims`, which enforced `oauth2_scheme = OAuth2PasswordBearer`.
- **Impact:** When external prospective parents or students visited the public admission portal to submit an application (`POST /api/v1/admissions/apply`) or check application status (`GET /api/v1/admissions/status/{application_number}`), the requests contained no `Authorization: Bearer <token>`. FastAPI immediately aborted request handling with `HTTP 401 Unauthorized`.
- **Frontend Symptom:** The applicant's browser received 401 and displayed a network/connection failure alert, blocking external intake.

### Root Cause 2: Parallel Fetch Permission Rejection on Teacher Initial Load
- **Failure Mechanism:** On mounting `/dashboard/admissions`, `admissions/page.tsx` executed a simultaneous `Promise.all`:
  1. `GET /api/v1/admissions/sessions`
  2. `GET /api/v1/admissions`
  3. `GET /api/v1/admissions/receipts/all`
- **Impact:** The `/receipts/all` endpoint strictly enforces `require_roles(["admin", "superadmin"])`. When teachers accessed the admission dashboard, `/receipts/all` returned `HTTP 403 Forbidden`. The unhandled rejection cascaded through `Promise.all`, triggering the outer catch block: *"Failed to load admission data"*, despite applications and sessions being completely valid.

### Root Cause 3: Supabase PgBouncer Pool Starvation & Unbounded Timeout
- **Failure Mechanism:** In `backend/app/core/database.py`, SQLAlchemy's engine parameters lacked an explicit `pool_timeout`. When Supabase connection poolers (PgBouncer in transaction mode on port 6543) hit client connection limits during concurrent bursts, SQLAlchemy checked out connections with the default 30-second wait. If any long-running transaction held a lock or an unhandled exception failed to immediately roll back, subsequent queries queued up until connection timeout, resulting in connection reset errors (`psycopg2.OperationalError: server closed the connection unexpectedly`).

---

## 3. Engineering Remediation & Implementation

### 3.1. Public & Authenticated Tenant Resolution (`backend/app/api/deps.py`)
Introduced `get_public_or_authenticated_tenant_id` and `get_public_db`:
- If an `Authorization: Bearer` token is supplied, it safely extracts and verifies `tenant_id` from the JWT claims.
- If unauthenticated (public intake or parent status lookup), it extracts `tenant_id` from the institutional header `X-Tenant-ID` or query parameter `?tenant_id=`.
- If no tenant marker is present, it fails closed with `HTTP 400 Bad Request`.
- `get_public_db` yields an RLS-locked PostgreSQL session with `app.current_tenant_id` properly set, allowing public applicants to write to the tenant's admission table under row-level security without granting them full user accounts.

### 3.2. Frontend Role-Isolated Data Loading (`frontend/app/dashboard/admissions/page.tsx`)
Refactored `loadAllData()`:
- Inspects active `user_role` before dispatching network requests.
- Only dispatches `fetchWithTenant("/api/v1/admissions/receipts/all")` if `role === "admin" || role === "superadmin"`.
- Teachers load only sessions and their permitted class applications.
- Failure of non-critical sub-queries degrades gracefully without crashing the view.

### 3.3. Database Connection Pool Hardening (`backend/app/core/database.py`)
- Configured conservative pool parameters with explicit fail-fast timeout:
  ```python
  engine_kwargs = {
      "pool_pre_ping": True,
      "pool_size": 10,
      "pool_recycle": 300,
      "max_overflow": 20,
      "pool_timeout": 10,
  }
  ```
- Enforced atomic rollback on exceptions in `get_db()`:
  ```python
  def get_db():
      db = SessionLocal()
      try:
          yield db
          if db.in_transaction():
              db.commit()
      except Exception:
          if db.in_transaction():
              db.rollback()
          raise
      finally:
          db.close()
  ```

### 3.4. Observability Middleware & Health Probes (`backend/app/main.py`)
- Middleware propagates both `X-Request-ID` and `X-Correlation-ID` across all inbound and outbound HTTP cycles with latency measurement in `X-Process-Time`.
- Added `GET /api/v1/health` providing deep inspection into API status, database ping, and SQLAlchemy connection pool metrics (`size`, `checkedin`, `checkedout`, `overflow`).
- Added `GET /api/v1/ready` as a Kubernetes / Docker Swarm readiness probe returning 200 when database connectivity is healthy and 503 when unreachable.

---

## 4. Verification & Automated Evidence

| Test Suite / Gate | Scope | Status | Result |
| :--- | :--- | :--- | :--- |
| `test_admission_models_and_payments.py` | Model A/B intake, public resolution, receipts, health/ready probes | PASS | 5/5 passed |
| `openapi_contract.py` | OpenAPI 3.1 Contract verification | PASS | 0 breaking changes, clean sync |
| `frontend tsc` | TypeScript strict compilation | PASS | 0 errors |
| `check_hardcoded_tenant.sh` | Multi-tenant isolation | PASS | Clean |

---

## 5. Production Sign-Off
The admission module connection failure root causes have been eliminated. Prospective students can submit applications without an existing user account, teachers can review permitted applications without 403 cascades, and database connections fail fast with automated rollback under high concurrency.

