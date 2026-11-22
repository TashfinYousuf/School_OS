# EducationOS Backend API & Router Inventory

**Audit Date:** 2026-11-01  
**Auditor:** Principal Software Architect  
**Scope:** `backend/app/api/endpoints/`, `backend/app/main.py`, `backend/app/core/`, `backend/app/models/`  
**Application Target:** Release Candidate 1 (RC1)

---

## 1. Executive Summary & Architecture Overview

The EducationOS backend is built on **FastAPI (Python 3.11+)** using SQLAlchemy ORM (async/sync hybrid patterns) with PostgreSQL (Supabase/CockroachDB). Routing is structured around 28 endpoint modules located in `backend/app/api/endpoints/`.

### Systemic Architectural Defects Identified:
1. **Universal Multi-Tenant RLS Bypass via `get_db` Dependency Mismatch:**
   - Every single backend router in `backend/app/api/endpoints/` imports `get_db` from `app.core.database` instead of `app.api.deps`.
   - `backend/app/api/deps.py`: Extracts `X-Tenant-ID` or claims from the JWT, sets `db.info["tenant_id"]`, and executes `SET LOCAL app.current_tenant_id = :tenant_id` for PostgreSQL Row-Level Security (RLS).
   - `backend/app/core/database.py`: Yields a generic raw database session **without** setting `db.info["tenant_id"]` and **without** executing `SET LOCAL app.current_tenant_id`.
   - `backend/app/core/tenant_guard.py`: Contains a SQLAlchemy `do_orm_execute` event hook:
     ```python
     tenant_id = db_session.info.get("tenant_id")
     if not tenant_id:
         return  # SILENT BYPASS: NO TENANT FILTER APPLIED TO ORM QUERY!
     ```
   - **Critical Vulnerability:** Because routers import `core.database.get_db`, `db.info.get("tenant_id")` is always `None`. The ORM filter hook silently exits on every single query, and PostgreSQL native RLS receives no session variable. **Multi-tenant isolation is completely bypassed across all endpoints.**
2. **Double Prefix Routing Bug in Approvals:**
   - `backend/app/api/endpoints/approvals.py` line 14: `router = APIRouter(prefix="/approvals", tags=["approvals"])`
   - `backend/app/main.py` line 225: `app.include_router(approvals.router, prefix=f"{settings.API_V1_STR}/approvals", tags=["Approvals"])`
   - **Result:** Approvals endpoints are mounted at `/api/v1/approvals/approvals/...`. Frontend calls to `/api/v1/approvals/pending` produce HTTP `404 Not Found`.
3. **Broken Import Causing Workspace Router Crash and Permanent Deactivation:**
   - `backend/app/api/endpoints/workspaces.py` line 11:
     ```python
     from app.models.workspace import InstitutionalMembership  # DOES NOT EXIST! Model is WorkspaceMembership
     ```
   - In `backend/app/main.py` lines 270–274:
     ```python
     try:
         from app.api.endpoints import workspaces
         app.include_router(workspaces.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["Workspaces"])
     except ImportError as e:
         logger.warning(f"Workspaces router skipped: {e}")
     ```
   - **Result:** The import fails with `ImportError: cannot import name 'InstitutionalMembership' from 'app.models.workspace'`, which is silently caught and logged. The entire workspace switching and institutional membership system is completely disabled in production.
4. **Unmounted & Dead Router Duplication:**
   - `subscriptions.py` (548 lines) is **unmounted** in `main.py`, while `billing.py` (508 lines) is mounted. Both implement conflicting subscription models, checkout handlers, and plan quota tiers.
   - `ai_tutor.py` (190 lines) is **unmounted** in `main.py`, causing all frontend `/api/v1/ai-tutor/chat` requests to fail with `404 Not Found`.
5. **Unauthenticated Public Endpoints Crashing with Model Attribute Errors:**
   - `backend/app/api/endpoints/users.py`: `GET /` and `GET /{id}` have no authentication or RBAC dependencies and query `User.deleted_at.is_(None)`. The `User` model does not have a `deleted_at` column, throwing an unhandled `AttributeError: type object 'User' has no attribute 'deleted_at'` resulting in HTTP 500.
   - `backend/app/api/endpoints/tenants.py`: `GET /` and `GET /{id}` have no authentication and query `Tenant.deleted_at.is_(None)`. The `Tenant` model does not have a `deleted_at` column, throwing an unhandled 500 crash.
6. **Hardcoded Fallback Tenant UUIDs:**
   - `students.py` line 103 and `communication.py` line 86 fall back to:
     ```python
     tenant_id = current_user.tenant_id or "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"
     ```
   - If a superadmin or tenant-less user executes these endpoints, records are inadvertently read from or written to an arbitrary hardcoded tenant namespace.
7. **Top-Level Environment Variable Startup Crashes:**
   - 6 endpoint modules (`learning_studio.py`, `teacher_diary.py`, `academy.py`, `communication.py`, `notices.py`, `academic.py`) execute `settings.GEMINI_API_KEY.strip()` at top-level module import. If `GEMINI_API_KEY` is undefined or set to an empty string, the entire FastAPI application crashes on boot.

---

## 2. Comprehensive Endpoint Inventory

### Verification Key:
- **VERIFIED COMPLETE**: Endpoint fully implemented, authenticated, authorized, and data contract validated.
- **PARTIALLY IMPLEMENTED**: Endpoint exists and functions partially, but missing critical checks, edge case handling, or contains mock fallbacks.
- **IMPLEMENTED BUT UNVERIFIED**: Complete code implementation, but unverified by automated test suites or external sandbox.
- **NOT IMPLEMENTED**: Endpoint defined as a stub, returns dummy data, or feature is marked with TODO.
- **BROKEN**: Crashes on invocation, routing collision, missing import, or exposes critical security vulnerability.

---

### 2.1 Authentication & User Management (`auth.py`, `users.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/login` | `/api/v1/auth` | `core.database.get_db` | `User`, `Tenant` | **VERIFIED COMPLETE** | Validates bcrypt password, issues JWT access and refresh tokens. Does not enforce account lockout after failed attempts. |
| `POST` | `/refresh` | `/api/v1/auth` | `core.database.get_db` | `User` | **VERIFIED COMPLETE** | Decodes refresh token, issues new access token. |
| `GET` | `/me` | `/api/v1/auth` | `get_current_user` | `User` | **VERIFIED COMPLETE** | Returns current user profile, role, and active tenant context. |
| `GET` | `/` | `/api/v1/users` | `core.database.get_db` | `User` | **BROKEN** | **Zero Authentication.** Queries `User.deleted_at.is_(None)`. `User` lacks `deleted_at`. Throws unhandled HTTP 500 `AttributeError`. |
| `GET` | `/{user_id}` | `/api/v1/users` | `core.database.get_db` | `User` | **BROKEN** | **Zero Authentication.** Missing `deleted_at` column. Throws unhandled HTTP 500. Publicly exposes user PII if column existed. |
| `POST` | `/` | `/api/v1/users` | `core.database.get_db` | `User` | **PARTIALLY IMPLEMENTED** | Creates user without enforcing caller is superadmin. Lacks email domain validation. |

---

### 2.2 Student Lifecycle & Profile 360 (`students.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `/api/v1/students` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `Student` | **PARTIALLY IMPLEMENTED** | Queries students. Uses fallback hardcoded tenant UUID `"1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"` if `current_user.tenant_id` is None. |
| `POST` | `/` | `/api/v1/students` | `get_current_user`, `require_roles(['admin'])` | `Student`, `Guardian` | **IMPLEMENTED BUT UNVERIFIED** | Enrolls student with enrollment number generation and guardian linkage. |
| `GET` | `/{student_id}/profile-360`| `/api/v1/students` | `get_current_user` | `Student`, `AttendanceEvent`, `FeeInvoice` | **BROKEN** | **BOLA / IDOR:** Any user with role `guardian` can query ANY student's complete profile, attendance, and fee history across the tenant without verifying guardianship. |
| `PUT` | `/{student_id}` | `/api/v1/students` | `get_current_user`, `require_roles(['admin'])` | `Student` | **IMPLEMENTED BUT UNVERIFIED** | Updates student profile details. |
| `DELETE`| `/{student_id}` | `/api/v1/students` | `get_current_user`, `require_roles(['admin'])` | `Student` | **IMPLEMENTED BUT UNVERIFIED** | Soft deletes student record by updating `is_active=False`. |

---

### 2.3 Attendance Management (`attendance.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/today` | `/api/v1/attendance` | `get_current_user` | `AttendanceEvent` | **VERIFIED COMPLETE** | Retrieves daily attendance summary grouped by class and section. |
| `POST` | `/records` | `/api/v1/attendance` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `AttendanceEvent` | **PARTIALLY IMPLEMENTED** | Records individual attendance event. Uses raw SQL advisory lock formatted via string concatenation (`SELECT pg_advisory_xact_lock(...)`). |
| `POST` | `/bulk` | `/api/v1/attendance` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `AttendanceEvent` | **VERIFIED COMPLETE** | Processes offline attendance batch. Enforces idempotency via event UUIDs. |
| `GET` | `/analytics` | `/api/v1/attendance` | `get_current_user` | `AttendanceEvent` | **IMPLEMENTED BUT UNVERIFIED** | Computes monthly attendance percentage and chronic absenteeism trends. |

---

### 2.4 Financial Operations & Fee Management (`finance.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/overview` | `/api/v1/finance` | `get_current_user`, `require_roles(['admin', 'accountant'])` | `FeeInvoice`, `PaymentTransaction` | **VERIFIED COMPLETE** | Aggregates collected revenue, overdue balances, and recent payment logs. |
| `POST` | `/invoices` | `/api/v1/finance` | `get_current_user`, `require_roles(['admin', 'accountant'])` | `FeeInvoice`, `FeeStructure` | **IMPLEMENTED BUT UNVERIFIED** | Generates monthly recurring fee invoices for student cohorts. |
| `POST` | `/collect` | `/api/v1/finance` | `get_current_user`, `require_roles(['admin', 'accountant'])` | `FeeInvoice`, `PaymentTransaction` | **PARTIALLY IMPLEMENTED** | Records manual cash or cheque collection and marks invoice paid. Print receipt output is unversioned. |
| `POST` | `/webhook/bkash` | `/api/v1/finance` | None (Public Webhook) | `PaymentTransaction` | **BROKEN** | Does not verify bKash digital signature or HMAC token. Accepts client-provided transaction status directly. |

---

### 2.5 Academic & Timetable Management (`academic.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/classes` | `/api/v1/academic` | `get_current_user` | `ClassRoom`, `Subject` | **VERIFIED COMPLETE** | Lists classes, sections, and curriculum subject allocations. |
| `GET` | `/routines` | `/api/v1/academic` | `get_current_user` | `ClassRoutine` | **VERIFIED COMPLETE** | Fetches timetable schedules filtered by class, section, or teacher. |
| `POST` | `/routines` | `/api/v1/academic` | `get_current_user`, `require_roles(['admin'])` | `ClassRoutine` | **PARTIALLY IMPLEMENTED** | Creates class period slot. Conflict detection for overlapping teacher periods is basic. |

---

### 2.6 Examinations & Grading Pipeline (`exams.py`, `results.py`, `question_papers.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | `/api/v1/exams` | `get_current_user` | `Exam` | **VERIFIED COMPLETE** | Lists exams by term and academic year. |
| `POST` | `/` | `/api/v1/exams` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `Exam` | **VERIFIED COMPLETE** | Schedules new examination session. |
| `POST` | `/generate` | `/api/v1/question-papers` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `QuestionPaper`, `Exam` | **PARTIALLY IMPLEMENTED** | Invokes AI service to generate exam questions. Creates paper in `draft` state (`is_published=False`). UI lacks publish workflow. |
| `POST` | `/marks` | `/api/v1/results` | `get_current_user`, `require_roles(['admin', 'teacher'])` | `ExamResult` | **IMPLEMENTED BUT UNVERIFIED** | Records student scores per subject and calculates GPA. |
| `GET` | `/progress-card/{student_id}` | `/api/v1/results` | `get_current_user` | `ExamResult`, `Student` | **BROKEN** | **BOLA / IDOR:** Verifies user role is guardian, but does not verify guardian is linked to `student_id`. Allows guardians to view grades of any student. |

---

### 2.7 Coaching Academy Operations (`academy.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/batches` | `/api/v1/academy` | `get_current_user` | `AcademyBatch` | **VERIFIED COMPLETE** | Lists coaching batches, schedules, and capacity limits. |
| `POST` | `/batches` | `/api/v1/academy` | `get_current_user`, `require_roles(['admin'])` | `AcademyBatch` | **IMPLEMENTED BUT UNVERIFIED** | Creates coaching batch with seat count and fee rate. |
| `GET` | `/exams` | `/api/v1/academy` | `get_current_user` | `AcademyExam` | **PARTIALLY IMPLEMENTED** | Returns exams where `is_published == True`. AI-generated drafts are permanently excluded. |
| `POST` | `/omr-camera-scan`| `/api/v1/academy` | `get_current_user`, `require_roles(['teacher', 'admin'])` | `AcademyExamResult` | **BROKEN** | **Mock Implementation:** If OpenCV / Gemini vision extraction encounters low confidence or unconfigured model, falls back to hardcoded answers `{"q_0": "A", "q_1": "B", ...}`. |
| `POST` | `/dispatch-result-sms`| `/api/v1/academy` | `get_current_user`, `require_roles(['admin'])` | `NotificationLog` | **NOT IMPLEMENTED** | Constructs SMS message payload, logs to database, and returns mock HTTP 200 without dispatching to telecom gateway. |

---

### 2.8 Governance, Workflows & Approvals (`approvals.py`, `notices.py`, `communication.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/pending` | `/api/v1/approvals` | `get_current_user`, `require_roles(['admin', 'headmaster'])` | `ApprovalRequest` | **BROKEN** | **Double Prefix & State Desync:** Mounted at `/api/v1/approvals/approvals/pending`. Queries `status == "pending_review"`, while requests are created with `status = "Pending"`. |
| `POST` | `/{id}/action` | `/api/v1/approvals` | `get_current_user`, `require_roles(['admin', 'headmaster'])` | `ApprovalRequest` | **BROKEN** | Mounted at `/api/v1/approvals/approvals/{id}/action`. |
| `GET` | `/` | `/api/v1/notices` | `get_current_user` | `Notice` | **VERIFIED COMPLETE** | Lists published notices. |
| `POST` | `/` | `/api/v1/notices` | `get_current_user`, `require_roles(['admin'])` | `Notice` | **PARTIALLY IMPLEMENTED** | Creates notice. Emergency broadcast SMS checkbox triggers mock notification routine. |
| `POST` | `/messages` | `/api/v1/communication` | `get_current_user` | `MessageThread`, `Message` | **PARTIALLY IMPLEMENTED** | Sends inter-user message. Falls back to hardcoded tenant UUID if context header is absent. |
| `POST` | `/webhook/whatsapp` | `/api/v1/communication` | None (Public Webhook) | None | **BROKEN** | **Hardcoded Secret:** Compares query parameter `hub.verify_token` against hardcoded literal string `"educationos_webhook_secret_2026"`. |

---

### 2.9 Subscriptions & Commercial Billing (`billing.py`, `subscriptions.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/plans` | `/api/v1/billing` | None (Public) | None (Static Config) | **VERIFIED COMPLETE** | Returns subscription tiers (Basic, Standard, Pro, Enterprise). |
| `POST` | `/checkout` | `/api/v1/billing` | `get_current_user`, `require_roles(['superadmin', 'admin'])` | `Subscription`, `PaymentIntent` | **PARTIALLY IMPLEMENTED** | Creates checkout intent. Gateway integration relies on unverified provider wrappers. |
| `POST` | `/webhook/stripe` | `/api/v1/billing` | None (Public Webhook) | `Subscription` | **PARTIALLY IMPLEMENTED** | Verifies Stripe signature if `STRIPE_WEBHOOK_SECRET` is set, but lacks idempotent replay protection. |
| *All* | *All routes* | `/api/v1/subscriptions` | `get_current_user` | `Subscription` | **NOT IMPLEMENTED** | **Dead Code:** Entire `subscriptions.py` router (548 lines) is omitted from `main.py` routing table. |

---

### 2.10 AI Gateway & Learning Studio (`learning_studio.py`, `ai_tutor.py`, `teacher_diary.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/generate-lesson-plan` | `/api/v1/learning-studio` | `get_current_user` | None | **PARTIALLY IMPLEMENTED** | Generates lesson plan via Gemini 1.5 Pro. Crashes on startup if `GEMINI_API_KEY` is empty. Prompt injection protection is minimal. |
| `POST` | `/chat` | `/api/v1/ai-tutor` | `get_current_user` | `ChatSession` | **BROKEN** | **Unmounted Router:** `ai_tutor.py` router is never registered in `main.py`. Requests to `/api/v1/ai-tutor/chat` return HTTP 404. |
| `POST` | `/entry` | `/api/v1/teacher-diary` | `get_current_user`, `require_roles(['teacher'])` | `TeacherDiary` | **IMPLEMENTED BUT UNVERIFIED** | Logs teacher daily lesson coverage and student notes. |

---

### 2.11 Multi-Tenant Workspaces & Administration (`workspaces.py`, `tenants.py`)

| Method | Path | Router Prefix | Dependencies & Guards | Target Models | Status | Vulnerabilities & Architectural Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/my-workspaces` | `/api/v1/workspaces` | `get_current_user` | `WorkspaceMembership`, `Tenant` | **BROKEN** | **Crashed on Startup:** Attempts to import `InstitutionalMembership` from `app.models.workspace`. Router skipped in `main.py`. Returns 404. |
| `POST` | `/switch` | `/api/v1/workspaces` | `get_current_user` | `WorkspaceMembership` | **BROKEN** | Router skipped due to startup `ImportError`. |
| `GET` | `/` | `/api/v1/tenants` | `core.database.get_db` | `Tenant` | **BROKEN** | **Zero Authentication.** Queries `Tenant.deleted_at.is_(None)`. `Tenant` model lacks `deleted_at`. Throws unhandled HTTP 500 crash. |
| `GET` | `/{tenant_id}` | `/api/v1/tenants` | `core.database.get_db` | `Tenant` | **BROKEN** | **Zero Authentication.** Throws unhandled HTTP 500 due to nonexistent `deleted_at` attribute. |

---

## 3. Backend Remediation Roadmap

1. **Fix Multi-Tenant Session Injection (`deps.py` vs `database.py`):**
   - Refactor all 28 routers in `backend/app/api/endpoints/` to import `get_db` from `app.api.deps` rather than `app.core.database`.
   - Ensure `db.info["tenant_id"]` is populated and `SET LOCAL app.current_tenant_id` executes on every request.
2. **Resolve Import Crash in `workspaces.py`:**
   - Change `from app.models.workspace import InstitutionalMembership` to `from app.models.workspace import WorkspaceMembership`.
   - Enable `workspaces.router` in `backend/app/main.py`.
3. **Correct Approvals Routing Prefix & State Matching:**
   - In `backend/app/api/endpoints/approvals.py`, remove `prefix="/approvals"` from `APIRouter()` so it is mounted cleanly at `/api/v1/approvals`.
   - Standardize status string casing (`"pending_review"` vs `"Pending"`).
4. **Secure Public Endpoints in `users.py` and `tenants.py`:**
   - Enforce `get_current_user` and `require_roles(['superadmin'])` on all tenant and user listing endpoints.
   - Remove references to nonexistent `deleted_at` attribute or add a migration to define `deleted_at` on `User` and `Tenant` models.
5. **Close BOLA / IDOR Gaps:**
   - In `results.py` and `students.py`, implement explicit relationship verification:
     ```python
     if current_user.role == "guardian":
         verify_guardian_student_relationship(db, guardian_id=current_user.id, student_id=student_id)
     ```
6. **Eliminate Top-Level API Key Crashes:**
   - Wrap AI client initialization in lazy loading functions or instantiate within the lifespan context.
   - Do not call `settings.GEMINI_API_KEY.strip()` at root module evaluation time.

