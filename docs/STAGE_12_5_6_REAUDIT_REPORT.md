# EDUCATIONOS — STAGE 12.5.6 RE-AUDIT REPORT
**Phase Zero Master Repository & System State Evaluation**  
**Classification Date:** 9 November 2026  
**Auditor:** Principal Software Architect, Application Security Engineer & QA Lead  
**Operating Standard:** Evidence-Driven Enterprise Readiness (Zero Unverified Claims)

---

## 1. Executive Summary & Audit Methodology

Following the non-negotiable governance principles of the **Master Product Reconstruction & Commercial Readiness Directive**, this Phase Zero re-audit inspects the active codebase across both backend (`FastAPI + SQLAlchemy`) and frontend (`Next.js 14 App Router`). 

Every architectural component, database model, API endpoint, and UI view has been classified into one of the eight mandated statuses:
1. `IMPLEMENTED_AND_VERIFIED` — Persisted, tested, and passing with active test assertions.
2. `IMPLEMENTED_BUT_UNVERIFIED` — Code exists in backend/frontend, but lacks automated test coverage.
3. `PARTIALLY_IMPLEMENTED` — Backend API exists or frontend exists, but end-to-end wiring is incomplete.
4. `UI_ONLY` — Hardcoded JSX or mock visual states without backing database persistence or API integration.
5. `API_ONLY` — Backend router implemented and functional, but missing frontend interfaces.
6. `MISSING` — Required by operational school workflows but not yet implemented.
7. `BLOCKED_BY_ENVIRONMENT` — Blocked by external resource constraints (e.g., disposable PostgreSQL).
8. `UNSAFE_OR_INCONSISTENT` — Incompatible abstractions, security gaps, IDOR vulnerabilities, or confusing UX.

---

## 2. Comprehensive Domain Audit & Status Matrix

| Domain & Feature | Current Technical State | Status | Risk / Gap Details |
|---|---|---|---|
| **Multi-Tenancy: Header Decoupling** | `X-Tenant-ID` (institution trust) vs `X-Workspace-ID` (campus/branch) separated in `deps.py` & `api-client.ts`. | `IMPLEMENTED_AND_VERIFIED` | 10/10 pytest passing in `test_stage12_5_1_tenant_workspace.py`. |
| **Multi-Tenancy: PostgreSQL RLS** | Migrations define row-level security policies (`app.current_tenant_id`). | `BLOCKED_BY_ENVIRONMENT` | SQLite test harnesses mock tenant scoping. Live PostgreSQL release gate remains blocked until disposable DB available. |
| **Workspace Selector (Switcher)** | `WorkspaceSwitcher.tsx` renders dropdown even when tenant has only 1 workspace. | `UNSAFE_OR_INCONSISTENT` | Single-campus schools (e.g. Kids Shine) see confusing workspace dropdown. Must auto-hide dropdown or show static campus badge when `count <= 1`. |
| **Auth: Staff Login** | `/api/v1/auth/staff` with email + bcrypt + rate-limiter. | `IMPLEMENTED_AND_VERIFIED` | Verified across Stages 03, 05, and 12.5.1. |
| **Auth: Student Login** | `/api/v1/auth/student` with admission ID + password. | `IMPLEMENTED_AND_VERIFIED` | Verified in Stage 03 tests. |
| **Auth: Guardian Login** | `/api/v1/auth/guardian` with admission ID + registered phone. | `PARTIALLY_IMPLEMENTED` | Returns JWT with `sub: guardian.id`. Endpoints using `get_current_user` look in `users` table instead of `guardians`, causing potential 404 for guardians. |
| **Attendance: Daily Roll Call Marking** | `POST /api/v1/attendance/sync-offline` and `POST /bulk-submit` with idempotency. | `IMPLEMENTED_AND_VERIFIED` | Verified in Stage 11 offline tests. |
| **Attendance: Offline Sync & Queue** | Client `localStorage` queue with retry logic and conflict detection. | `IMPLEMENTED_AND_VERIFIED` | Verified in `test_stage11_offline.test.ts`. |
| **Attendance: Daily & Monthly Summary** | `GET /api/v1/attendance/summary` computes present/absent/late counts & percentages. | `IMPLEMENTED_AND_VERIFIED` | Working in backend; wired into admin metrics. |
| **Attendance: Correction Workflows** | `POST /correction-request` & `POST /correction-approval/{task_id}` via `ApprovalTask`. | `IMPLEMENTED_AND_VERIFIED` | Implemented in Stage 09. |
| **Attendance: Historical Query & Filtering** | Query attendance records by class, section, date-range, student, and status. | `MISSING` | No `GET /api/v1/attendance/records` endpoint exists. Teachers and admins cannot view past class ledgers. |
| **Attendance: Student Attendance History** | Retrieve complete monthly/yearly calendar log for an individual student. | `MISSING` | No dedicated `GET /api/v1/attendance/student/{id}` endpoint with date breakdown. |
| **Attendance: Daily Absentee Calling List** | Query absent students for today with guardian phone numbers for WhatsApp/SMS follow-up. | `MISSING` | No `GET /api/v1/attendance/absent-list` endpoint exists. |
| **Attendance: Reporting & Exports** | Export attendance records to CSV, Excel XLSX, and printable HTML/PDF. | `MISSING` | Zero export endpoints or client triggers exist. |
| **Attendance UI: History & Review Tab** | UI for reviewing historical attendance, filtering by date/class, and generating reports. | `MISSING` | `attendance/page.tsx` only offers daily roll call marking. |
| **Guardian Portal: Linked Children API** | Retrieve authenticated guardian's enrolled children with live summary stats. | `MISSING` | Guardian must know child's UUID; no `GET /api/v1/guardians/me/children` endpoint exists. |
| **Guardian Portal: Dashboard View** | Guardian home dashboard cards (attendance, standing, fees). | `UI_ONLY` | `dashboard/page.tsx` lines 241–262 contain completely hardcoded JSX strings ("24 Days", "95.8%", "GPA 5.00"). |
| **Guardian Portal: Child Switcher** | Selector to toggle between multiple enrolled siblings. | `MISSING` | UI assumes single child; does not support multi-child households. |
| **Guardian Attendance View** | Date-wise attendance history for guardian's child. | `UI_ONLY` | `attendance/page.tsx` lines 219–242 render 5 static hardcoded rows from October 2026. |
| **Student Portal: Dashboard Home API** | Retrieve logged-in student's personal timetable, attendance stats, and exam marks. | `MISSING` | No dedicated `GET /api/v1/students/me/dashboard` endpoint exists. |
| **Student Portal: Dashboard View** | Student home dashboard cards (attendance rate, GPA, periods, AI companion). | `UI_ONLY` | `dashboard/page.tsx` lines 173–194 render hardcoded strings ("96.4%", "GPA 5.00 (A+)", "5 Classes"). |
| **Academic Routine & Timetable** | `/api/v1/academic/routines` and `/classes`. | `IMPLEMENTED_AND_VERIFIED` | Functional in Stage 09 tests. |
| **Examination & NCTB Results** | `/api/v1/results` with GPA calculation and grade sheets. | `IMPLEMENTED_AND_VERIFIED` | Functional in Stage 08 tests. |
| **Student 360 Profile** | `/api/v1/students/{id}/profile-360` with RBAC & BOLA guard. | `IMPLEMENTED_AND_VERIFIED` | Fully functional, but requires knowing `student_id`. |
| **Fee Collection & Billing** | `/api/v1/finance/payments` with BDT receipts. | `IMPLEMENTED_AND_VERIFIED` | Minor-unit integer BDT calculations verified. |
| **Commercial SaaS Pricing Engine** | Tiered vs usage-based pricing with active enrolled student bands. | `PARTIALLY_IMPLEMENTED` | Fixed tiers exist in `plans.ts` and `billing.py`; hybrid usage-based model scheduled for Stage 12.5.7. |
| **Public Website & Documentation** | 21 public routes, bilingual manuals, ROI calculator, SEO metadata. | `IMPLEMENTED_AND_VERIFIED` | 70/70 frontend tests passing in `test_stage12_5_public_website.test.ts`. |

---

## 3. Critical Gaps Requiring Immediate Remediation (Stage 12.5.6 Scope)

### Gap 1: Incomplete Attendance Lifecycle (P0)
The current attendance system can **write** records (`/bulk-submit`, `/sync-offline`) and produce an aggregate count (`/summary`), but it cannot **read historical logs**, **filter by date ranges**, or **export records**.
- **Missing Backend APIs**:
  1. `GET /api/v1/attendance/records` — Historical query with `class_name`, `start_date`, `end_date`, `student_id`, `status`.
  2. `GET /api/v1/attendance/student/{student_id}` — Student attendance log and percentage computation.
  3. `GET /api/v1/attendance/absent-list` — List of students absent on a given date with primary guardian contact numbers.
  4. `GET /api/v1/attendance/export` — Stream CSV or Excel-compatible format.
- **Missing Frontend Interfaces**:
  1. Tabbed attendance interface in `attendance/page.tsx`:
     - **Tab 1: Daily Roll Call** (existing fast 1-tap marking).
     - **Tab 2: Attendance History & Ledger** (filter by class, date range, status with table view).
     - **Tab 3: Absentee Follow-Up** (daily absent roster with guardian phone numbers for direct WhatsApp/phone contact).
     - **Tab 4: Export & Reports** (CSV and printable A4 report).

### Gap 2: Student & Guardian Persona Mock-State (P0)
Both the student and guardian dashboards display hardcoded JSX strings instead of real database values.
- **Missing Backend APIs**:
  1. `GET /api/v1/guardians/me/children` — Returns list of children linked via `student_guardians` for the authenticated parent, including their current class, roll number, attendance rate, GPA standing, and fee balance.
  2. `GET /api/v1/students/me/dashboard` — Returns authenticated student's profile, attendance rate, recent exam results, and today's class routine.
- **Frontend Reconstruction**:
  1. Replace hardcoded JSX in `dashboard/page.tsx` with dynamic components:
     - `GuardianPortalView` with linked child selector pill (switching child updates cards in real-time).
     - `StudentPortalView` with authentic student metrics from `/api/v1/students/me/dashboard`.
  2. Replace hardcoded logs in `attendance/page.tsx` for guardians with live API calls to child attendance records.

### Gap 3: Authentication & Token Identity Resolution for Guardians (P0)
When a guardian logs in via `/api/v1/auth/guardian`, their JWT contains `sub: str(guardian.id)`. Endpoints that depend on `get_current_user` look up `User.id == sub`, which causes a 404 error if the guardian profile has no associated `User` record or if `guardian.id != user.id`.
- **Remediation**:
  1. Ensure `deps.py` or guardian-specific endpoints resolve identity via `Guardian` table when `role == "guardian"`, matching `sub == Guardian.id`.
  2. Provide clean role-based routing and clear error feedback on `/login`.

### Gap 4: Workspace Selector Usability (P0)
- Single-school tenants currently see a dropdown arrow and dropdown list containing only 1 workspace.
- **Remediation**:
  1. If `availableWorkspaces.length <= 1`, render a compact institutional badge without dropdown interaction.
  2. If `userRole` is `student` or `guardian`, suppress workspace switching entirely (students and parents are enrolled in a specific institution).
  3. Invalidate API caches and trigger re-render upon switching when multiple workspaces exist.

---

## 4. Prioritized Execution Sequence

1. **Step 1: Attendance Subsystem Extension**
   - Implement backend endpoints in `backend/app/api/endpoints/attendance.py`.
   - Update frontend in `frontend/app/dashboard/attendance/page.tsx`.
   - Write comprehensive tests in `backend/tests/test_stage12_5_6_attendance.py` and `frontend/tests/test_stage12_5_6_attendance.test.ts`.
   - Produce `docs/STAGE_12_5_6_ATTENDANCE_ACCEPTANCE_MATRIX.md`.

2. **Step 2: Student & Guardian Experience Reconstruction**
   - Implement `GET /api/v1/guardians/me/children` and `GET /api/v1/students/me/dashboard`.
   - Wire `frontend/app/dashboard/page.tsx` and `frontend/app/dashboard/attendance/page.tsx` to authentic API data.
   - Support linked child selector for parents with multiple children.
   - Produce `docs/STAGE_12_5_6_STUDENT_PORTAL_SPEC.md` and `docs/STAGE_12_5_6_GUARDIAN_PORTAL_SPEC.md`.

3. **Step 3: Authentication & Workspace Switcher Polish**
   - Refactor `WorkspaceSwitcher.tsx` to handle single-workspace and student/guardian roles cleanly.
   - Produce `docs/STAGE_12_5_6_AUTHENTICATION_UX_SPEC.md` and `docs/STAGE_12_5_6_WORKSPACE_UX_DECISION.md`.

4. **Step 4: Stage 12.5.7 Commercial Pricing Architecture**
   - Prepare `docs/PRICING_STRATEGY_AND_UNIT_ECONOMICS.md`, `docs/PRICING_ENGINE_SPEC.md`, `docs/PRICING_MIGRATION_PLAN.md`, and `docs/PRICING_APPROVAL_REQUIRED.md`.

5. **Step 5: Stage 12.5.8 & 12.5.9 Verification & Acceptance**
   - Complete content truthfulness audit and 5-persona end-to-end acceptance.

