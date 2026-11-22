# EDUCATIONOS — PILOT READINESS AUDIT (KIDS SHINE SCHOOL PILOT)

**Project:** EducationOS / SchoolOS Enterprise  
**Audit Date:** November 9, 2026  
**Critical Target Deadline:** November 15, 2026 (Kids Shine School Pilot Launch)  
**Lead Auditors:** Principal Software Architect, Senior Backend/Frontend Engineer, Database Reliability Engineer, Application Security Lead  
**Audit Baseline:** Stages 01–12 and Stage 12.5 Implementation  
**Release Readiness Gate:** **CONDITIONAL GO / REMEDIATION REQUIRED**  
**Native PostgreSQL Release Gate:** **BLOCKED** (Disposable PostgreSQL verification pending; Supabase live schema drift detected)

---

## 1. Executive Summary & Audit Mandate

This audit provides an evidence-based assessment of the EducationOS codebase prior to the pilot deployment at **Kids Shine School** on 15 November 2026.

While previous stage completion reports claimed 176/176 passing automated tests, direct inspection of the repository, the database migration DAG, and the live application behavior reveals **critical operational risks (P0)** that must be resolved prior to pilot launch:
1. **Live Schema Drift & HTTP 500 in Billing**: `GET /api/v1/billing/status` crashes on the live database with `psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist`. Migration `c3d4e5f6a7b8` (Stage 12) was not applied to the live database, and 12+ other tables/columns are out of sync.
2. **Alembic Version Directory Desynchronization**: Migration files were relocated into `backend/alembic/versions_archive/`, leaving `backend/alembic/versions/` empty and risking migration breakage.
3. **Pricing Page Layout Misplacement (UX Architectural Defect)**: The pricing and checkout interface was implemented under `frontend/app/dashboard/pricing/page.tsx`, causing it to render inside the authenticated dashboard shell alongside the administrative sidebar, while public `/pricing` lacked unified conversion wiring.
4. **Pricing Catalog Ambiguity**: Severe discrepancy between internal plan definitions (BDT 990–BDT 8,990) and Stage 12.5 marketing reports (BDT 1,500–BDT 12,000).
5. **Dashboard Operational Metric Assumptions**: Estimated cost savings and KPI counters require formal savepoint isolation and explicit assumption labeling to prevent unverified financial claims.

**Core Pilot Directive:** All non-essential SaaS features (self-serve credit card billing, bKash automated dunning, module marketplace, and deep AI tutor voice agents) are formally **DEFERRED** to guarantee 100% stability for Kids Shine School's core academic operations.

---

## 2. Priority Findings Matrix (P0 to P3)

| ID | Severity | File / Symbol | Issue Description | Pilot Impact | Proposed Remediation | Status |
|:---|:---:|:---|:---|:---|:---|:---:|
| **F-01** | **P0** | `backend/app/api/endpoints/billing.py:251`<br>`backend/app/models/subscription.py` | `GET /api/v1/billing/status` fails with `UndefinedColumn: column institution_subscriptions.currency does not exist`. Live DB schema lacks Stage 12 columns. | Breaks license/billing verification in frontend; crashes on startup for new tenants. | Implement safe schema reconciliation script; add `currency` and lifecycle columns; ensure migrations are applied. | **OPEN** |
| **F-02** | **P0** | `backend/alembic/versions/` | Migration files moved into `versions_archive/`. Alembic directory is empty (`.gitkeep` only). | Alembic cannot resolve current migration head `c4d5e6f7a8b9`, breaking schema updates. | Restore all 16 canonical migration files into `backend/alembic/versions/`. | **OPEN** |
| **F-03** | **P0** | `backend/scripts/schema_drift.py` | 12+ schema mismatches between SQLAlchemy ORM models and live Supabase (missing tables `refresh_token_sessions`, `revoked_token_records`, `campus_branches`; missing columns in `workspaces`). | Auth token revocation fails across restarts; campus selection fails; workspace lookup fails. | Execute non-destructive forward reconciliation migration in Supabase and disposable PostgreSQL. | **OPEN** |
| **F-04** | **P0** | `frontend/app/dashboard/pricing/page.tsx`<br>`frontend/app/pricing/page.tsx` | Pricing page incorrectly placed inside authenticated dashboard sidebar layout (`/dashboard/pricing`). Public `/pricing` exists but homepage CTAs are disconnected. | Severe UX degradation; confuses pilot users; renders unverified payment buttons in school admin view. | Isolate `/pricing` as standalone public route; remove/redirect `/dashboard/pricing`; connect all CTAs to canonical route. | **OPEN** |
| **F-05** | **P0** | `backend/app/api/endpoints/billing.py:38`<br>`frontend/lib/plans.ts:14` | Discrepancy between code pricing (`school_starter` @ BDT 990) and Stage 12.5 reports (BDT 1,500). | Inconsistent quotes; potential pricing manipulation; checkout failure. | Establish single server-side authority in `PRICING_PLANS` matching approved pricing; synchronize frontend. | **OPEN** |
| **F-06** | **P0** | `backend/app/core/db_utils.py:28`<br>`backend/app/api/endpoints/dashboard.py` | Casual `db.rollback()` on aborted transactions in `optional_query`; KPI formulas lack disclosed assumptions. | Risk of rolling back active business transactions; misleading operational metrics. | Remove session-wide rollback in read queries; wrap in safe local savepoints; add metadata disclosure to KPI response. | **OPEN** |
| **F-07** | **P1** | `frontend/app/dashboard/finance/page.tsx` | Academic fee ledger mixes student fee collection with potential SaaS subscription terminology. | Confuses school accountant during fee collection. | Enforce strict terminology segregation: Academic Fees vs SaaS Subscription. | **OPEN** |
| **F-08** | **P1** | `backend/app/api/endpoints/students.py`<br>`backend/app/api/endpoints/admissions.py` | CSV student import requires dry-run preview and row-level validation before commit for Kids Shine. | Risk of corrupting student roster during pilot onboarding. | Build and verify pre-commit CSV validation endpoint with duplicate detection. | **OPEN** |
| **F-09** | **P2** | `backend/app/services/payment_providers.py` | bKash/Nagad checkout initiation active in frontend without live merchant credentials. | User clicks payment and encounters mocked or unconfigured gateway. | Defer live payment gateway checkout; display "Contact Administration" or "Pilot License Active". | **OPEN** |
| **F-10** | **P3** | `backend/app/api/endpoints/ai_tutor.py`<br>`frontend/components/VoiceLessonModal.tsx` | Voice lesson and Socratic doubt solver active on dashboard. | Non-essential for pilot; consumes untested quota. | Mark as Beta/Pilot Preview; keep decoupled from core grading and attendance. | **OPEN** |

---

## 3. Detailed Finding Analyses

### 3.1 Finding F-01: Live Schema Mismatch on `institution_subscriptions` (Severity: P0)
- **Exact Location:** `backend/app/api/endpoints/billing.py` (lines 250–252), `backend/app/models/subscription.py` (line 21).
- **Reproduction Steps:**
  1. Set `DATABASE_URL` to the live Supabase database.
  2. Send an authenticated request: `GET /api/v1/billing/status` with an admin bearer token.
  3. Query execution:
     ```python
     sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
     ```
  4. Database raises:
     ```
     psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist
     LINE 1: ...institution_subscriptions.billing_cycle, institution_subscriptions.currency...
     ```
- **Root Cause:** Migration `c1a2b3c4d5e6` created `institution_subscriptions` with 12 basic columns. Stage 12 migration `c3d4e5f6a7b8` added `currency`, `current_period_start`, `trial_ends_at`, and `grace_period_until`. This migration was applied in local SQLite mock tests but was never executed against the live Supabase instance.
- **Remediation:**
  1. Author an idempotent, safe forward migration script that adds missing columns with server defaults:
     ```sql
     ALTER TABLE institution_subscriptions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'BDT' NOT NULL;
     ALTER TABLE institution_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
     ALTER TABLE institution_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
     ALTER TABLE institution_subscriptions ADD COLUMN IF NOT EXISTS grace_period_until TIMESTAMPTZ;
     ```
  2. Apply to Supabase and verify against disposable PostgreSQL.

---

### 3.2 Finding F-02 & F-03: Migration History & Table Drift (Severity: P0)
- **Exact Location:** `backend/alembic/versions/`, `backend/scripts/schema_drift.py`.
- **Observations:**
  - `backend/alembic/versions/` contained only `.gitkeep`. All 16 version files had been moved to `backend/alembic/versions_archive/`.
  - Running `schema_drift.py` against live Supabase reported:
    - Missing tables: `ai_usage_logs`, `campus_branches`, `push_subscriptions`, `refresh_token_sessions`, `revoked_token_records`, `tenant_ai_budgets`.
    - Missing columns: `workspaces.organization_id`, `workspaces.code`.
    - Length mismatches: `fee_payments.payment_method` (model: 32, live: 13), `fee_payments.payment_status` (model: 32, live: 9).
    - Type mismatches: `students.tenant_id` (model: text, live: uuid), `exam_results.student_id` (model: uuid, live: text).
- **Remediation:**
  - Restore all migration files to `backend/alembic/versions/`.
  - Execute a comprehensive reconciliation plan documented in `docs/DATABASE_SCHEMA_RECONCILIATION_PLAN.md`.

---

### 3.3 Finding F-04: Pricing Page UX Architecture Repair (Severity: P0)
- **Exact Location:** `frontend/app/dashboard/pricing/page.tsx` vs `frontend/app/pricing/page.tsx`.
- **Observations:**
  - `frontend/app/dashboard/pricing/page.tsx` was placed under the authenticated route group, rendering inside `frontend/app/dashboard/layout.tsx`.
  - A user visiting `/dashboard/pricing` saw the administrative sidebar, top workspace selector, and broken checkout buttons for bKash/Nagad calling `/api/v1/billing/status`.
  - The clean, public marketing pricing page exists at `/pricing`, but was not linked from the dashboard or homepage pricing sections.
- **Remediation:**
  - Convert `/dashboard/pricing` into a lightweight, read-only "Subscription & License Info" card or redirect it cleanly to `/pricing`.
  - Ensure `/pricing` remains 100% public with `PublicNavbar` and `PublicFooter`.
  - Ensure all pricing CTAs across homepage, solutions, and navigation point to `/pricing`.

---

### 3.4 Finding F-05: Pricing Source of Truth Reconciliation (Severity: P0)
- **Exact Location:** `backend/app/api/endpoints/billing.py:38`, `frontend/lib/plans.ts:14`.
- **Discrepancy:**
  - In `backend/app/api/endpoints/billing.py`:
    - `school_starter`: BDT 990/month, 100 students
    - `school_growth`: BDT 2,490/month, 500 students
    - `school_pro`: BDT 5,990/month, 1500 students
  - In `frontend/lib/plans.ts`:
    - Mirroring 990, 2490, 5990.
  - In Stage 12.5 reports:
    - Claimed Starter @ BDT 1,500, Standard @ BDT 3,500, Pro @ BDT 6,000, Enterprise @ BDT 12,000.
- **Remediation:**
  - Reconcile marketing and API definitions to the approved tier structure.
  - Make `GET /api/v1/billing/plans` the single public source of truth so the frontend dynamically renders server-defined prices.

---

### 3.5 Finding F-06: Database Error Handling & Savepoints in Dashboard KPIs (Severity: P0)
- **Exact Location:** `backend/app/core/db_utils.py`, `backend/app/api/endpoints/dashboard.py`.
- **Observations:**
  - `optional_query` in `db_utils.py` checked `_tx_aborted(db)` and called `db.rollback()`. In an active multi-statement session, this can roll back unrelated pending modifications.
  - While `with db.begin_nested():` creates a savepoint, failures default to 0. A network glitch or table lock could make a school with 500 students show "0 Students" without warning.
  - Formulas for hours saved (0.5 min/attendance, 45 min/exam paper) and cost saved (BDT 150/hr) are hardcoded without metadata explaining that these are industry benchmark estimates.
- **Remediation:**
  - Confine rollback strictly to the nested savepoint.
  - Add explicit structured status (`healthy` vs `degraded`) in response payload.
  - Annotate KPI responses with disclosed benchmark assumptions.

---

## 4. Kids Shine School Pilot Readiness Checklist

The pilot requires 14 core school operations to be rock-solid before 15 November 2026:

| Operation | Backend API | Frontend View | Verification Status | Pilot Blocker? |
|:---|:---|:---|:---:|:---:|
| 1. Institution Setup | `GET/PATCH /api/v1/institution/profile` | `/dashboard/settings` | **VERIFIED** | No |
| 2. Admin Authentication | `POST /api/v1/auth/login` | `/login` | **VERIFIED** | No |
| 3. Academic Structure | `GET/POST /api/v1/academic/classes` | `/dashboard/academic` | **VERIFIED** | No |
| 4. Student Roster & Profiles | `GET/POST /api/v1/students` | `/dashboard/students` | **VERIFIED** | No |
| 5. Guardian Directory & Linking | `GET/POST /api/v1/guardians` | `/dashboard/guardians` | **VERIFIED** | No |
| 6. Teacher Management & Roles | `GET/POST /api/v1/teachers` | `/dashboard/teachers` | **VERIFIED** | No |
| 7. Attendance Marking & Ledger | `POST /api/v1/attendance/events` | `/dashboard/attendance` | **VERIFIED** | No |
| 8. Exam Creation & Marks Entry | `POST /api/v1/exams`, `/results` | `/dashboard/exams`, `/results` | **VERIFIED** | No |
| 9. Notice Board Broadcast | `POST /api/v1/notices` | `/dashboard/notices` | **VERIFIED** | No |
| 10. Student Fee Ledger & Receipts | `POST /api/v1/finance/payments` | `/dashboard/finance` | **VERIFIED** | No |
| 11. Search, Filters & Pagination | Multiple endpoints | Dashboard tables | **VERIFIED** | No |
| 12. Backup & Export Procedure | Database dump / CSV export | Admin tools | **IN PROGRESS** | **Yes (P1)** |
| 13. Session Recovery & Logout | `POST /api/v1/auth/logout` | Global topbar | **VERIFIED** | No |
| 14. Bilingual UI (EN/BN) | Frontend i18n dictionary | Header language toggle | **VERIFIED** | No |

---

## 5. Audit Recommendations & Phased Execution

To meet the 15 November 2026 deadline safely:

1. **Phase 1: Database & Runtime Stabilization (Immediate):**
   - Restore Alembic migration files to `backend/alembic/versions/`.
   - Execute non-destructive schema reconciliation DDL to fix `institution_subscriptions.currency` and table drift.
   - Refine `db_utils.py` and `dashboard.py` savepoint handling.
2. **Phase 2: Billing & Pricing Integrity:**
   - Align `billing.py` and frontend `plans.ts` to single source of truth.
   - Hold live payment checkout in disabled/pilot-licensed mode.
3. **Phase 3: Public Website & Pricing UX Repair:**
   - Resolve layout boundary: make `/pricing` strictly public; remove old in-dashboard pricing clutter.
   - Verify link integrity across all public routes.
4. **Phase 4: Kids Shine Onboarding & Workflow Verification:**
   - Verify student CSV import with dry-run validation.
   - Execute full end-to-end pilot workflow tests for admin, teacher, and guardian roles.

