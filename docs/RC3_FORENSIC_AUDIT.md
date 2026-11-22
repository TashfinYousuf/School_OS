# RC3 Forensic Audit Report

**Audit Stage:** Phase 0 — Repository & Live Database Forensics  
**Scope:** Full-Stack Backend (`backend/`), Frontend (`frontend/`), Alembic Migrations, CI/Deployment, Live Supabase PostgreSQL State  
**Rule of Evidence:** Every finding below is backed by direct file inspection, empirical CLI/linter/test execution, or read-only SQL introspection on the configured database.

---

## 1. Empirical Baseline Measurements

| Check | Command / Source | Observed Result |
|---|---|---|
| Alembic Head & Live DB Sync | `cd backend && ../venv/bin/alembic heads && ../venv/bin/alembic current` | Single canonical head `d5e6f7a8b9c0 (head)` matching live Supabase; parent chain `c4d5e6f7a8b9` -> `c3d4e5f6a7b8` -> `b2c3d4e5f6a7` -> `f6a7b8c9d0e1`. |
| Backend Ruff Lint (real binary) | `venv/bin/ruff check backend/app backend/scripts --select E9,F63,F7,F82 --no-cache` | **FAIL (exit 1)** — `F821 Undefined name 'func'` at `backend/app/api/endpoints/guardians.py:564:9`. (`backend/scripts/check.sh` previously bypassed ruff via `command -v ruff`). |
| Backend Test Suite (pre-RC3) | `cd backend && pytest -q` / `test_student_guardian_reconstruction.py` | Pre-RC3 baseline: `170 passed` (`6 passed` in reconstruction test). Note: `test_rls_isolation` and finance webhook tests ran against hardcoded fallback webhook secrets / bypassrls `postgres` role. |
| Frontend Jest Tests | `cd frontend && npm test` | **PASS** — `79 passed`, `24 suites`, `0 failed`. |
| Frontend Production Build | `cd frontend && npm run build` | **PASS** — exit 0 (`50/50` routes). |
| Frontend ESLint | `cd frontend && npm run lint` | **FAIL (exit 1)** — `355 problems (178 errors, 177 warnings)`. |
| Live DB Role & RLS Introspection | Read-only SQL on `aws-1-ap-south-1.pooler.supabase.com:6543` | Runtime DB user `postgres` has `rolbypassrls = True`. 58 `public` tables inspected: 4 tables lack an `AS PERMISSIVE` policy; 31 tables have `relrowsecurity=True, policies=0`. |
| Local Postgres / Docker | Host check | `libpq` 18.6 (`psql`, `initdb`, `pg_ctl`) present; **no local `postgres` server binary or Docker installed**. |
| Provider Credentials Audit | `backend/.env` inspection | `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `PAYMENT_WEBHOOK_SECRET`, `PAYMENT_CHECKOUT_BASE_URL`, `PROJECT_NAME`, `DATABASE_URL`, `SECRET_KEY` present. **Zero** `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, `SMS_*`, `SMTP_*`, or `VAPID_*` credentials configured. |

---

## 2. Prioritized Forensic Findings Catalog

### F-RC3-01 — Runtime `NameError` (`F821 Undefined name 'func'`) & Silent Lint Bypass
- **Severity:** P0 (Runtime Crash + Broken Quality Gate)
- **Location:** `backend/app/api/endpoints/guardians.py:564`; `backend/scripts/check.sh`
- **Root Cause:** `verify_guardian_link` (L564) calls `func.upper(Student.admission_number)` without importing `func` from `sqlalchemy`. `backend/scripts/check.sh` checked `command -v ruff` on system `$PATH`, missing `venv/bin/ruff` and reporting false `ALL OK`.
- **Reproduction:** Execute `venv/bin/ruff check backend/app backend/scripts --select E9,F63,F7,F82 --no-cache` or hit the affected link lookup branch in `guardians.py:564`.
- **Status:** OPEN (Targeted in Phase 1).

### F-RC3-02 — Privilege Escalation via `User.role` Default `"admin"` & Polluted Live DB Rows
- **Severity:** P0 (Critical Privilege Escalation)
- **Location:** `backend/app/models/tenant.py:59`; `backend/app/api/endpoints/guardians.py:79-83`
- **Root Cause:** `User.role` SQLAlchemy column defaults to `"admin"`. `create_guardian()` in `guardians.py:79-83` instantiates `User(...)` without passing `role="guardian"`, silently promoting newly created guardian accounts to `"admin"`.
- **Live DB Evidence:** Live Supabase `users` table contains 3 non-staff accounts (`student1@kidsshine.com`, `father@kidsshine.com`, `student2@kidsshine.com`) stored with `role='admin'`.
- **Status:** OPEN (Code fix in Phase 1; DB remediation requires owner-approved data fix script).

### F-RC3-03 — PostgreSQL RLS Bypassed in Runtime & Incomplete Policy Coverage Across 35 Tables
- **Severity:** P0 (Multi-Tenant Isolation Failure at DB Layer)
- **Location:** `backend/app/core/database.py`; `backend/alembic/versions/*rls*`
- **Root Cause:**
  1. Runtime database role `postgres` has `rolbypassrls = True`. `get_tenant_db()` / `after_begin` sets `set_config('app.current_tenant_id', ..., true)` but never executes `SET LOCAL ROLE authenticated`.
  2. Of 58 `public` tables in Supabase: 4 tables (`approval_tasks`, `attendance_events`, `audit_logs`, `fee_payments`) have `RESTRICTIVE` policies without a companion `AS PERMISSIVE` policy; **31 tables** (including `guardians`, `student_guardians`, `student_results`, `teachers`, `notices`, `users`, `tenants`, `workspaces`, `institution_subscriptions`, `subscription_payments`, `exams`, `live_exams`, `messages`) have `relrowsecurity = True, relforcerowsecurity = False, policies = 0`, which fails closed (0 rows) whenever queried under a non-bypass role like `authenticated`.
- **Status:** OPEN (Targeted in Phase 1/2 migration + DB session role switch investigation).

### F-RC3-04 — BOLA / IDOR Default-Allow Fallbacks, Phone-Match Bypass & Broken Student/Guardian Resolution
- **Severity:** P0 (Cross-Account Data Exposure & Functional Denial)
- **Locations & Defects:**
  - `backend/app/core/security_guard.py:101`: `verify_student_scope` ends with `return True` for any unrecognized role (default-allow).
  - `backend/app/api/endpoints/guardians.py:26-45,250,355,427,488`: `_resolve_guardian` falls back to matching `Guardian.phone_number`; endpoints allow `(GuardianStudentLink.verification_status == "VERIFIED") | (GuardianStudentLink.verification_status == None)`. Also swallowed exception at L295.
  - `backend/app/api/endpoints/students.py:421-453`: Guardian branch falls back to `Guardian.phone_number` and omits `verification_status == "VERIFIED"`.
  - `backend/app/api/endpoints/results.py:178-193`: Compares `student_id != user_id` (where `user_id` is `User.id`, not `Student.id`) and `GuardianStudentLink.guardian_id == user_id` (not `Guardian.id`), AND omits `verification_status == "VERIFIED"` — breaking valid Student & Guardian report card views with HTTP 403 while violating relationship state checks.
  - `backend/app/api/endpoints/attendance.py:643-658`: Omits `verification_status == "VERIFIED"` and allows phone-number fallback in student/guardian attendance history checks.
  - `backend/app/api/endpoints/finance.py:653-688`: Omits `verification_status == "VERIFIED"` and uses phone fallback on guardian fee checks.
  - `backend/app/api/endpoints/communication.py:88,161`: Lacks `VERIFIED` guardian link enforcement.
- **Status:** OPEN (Targeted in Phase 1 & Phase 2).

### F-RC3-05 — Broken Student Token Refresh & Unchecked Guardian Status on Refresh + Unsafe Guardian Auto-Linking
- **Severity:** P0 (IAM Session Integrity)
- **Location:** `backend/app/api/endpoints/auth.py:458-466,759-782`
- **Root Cause:**
  - `refresh_token_endpoint` (L776) checks `Student.id == user_id` instead of `Student.user_id == user_id` (causing HTTP 401 on valid student refresh) and skips checking active status for `guardian` users.
  - `login_guardian` (L458-466) performs automatic Guardian account linking by email / `clean_phone` at login time without invitation/verification proof.
- **Status:** OPEN (Targeted in Phase 1 & Phase 2).

### F-RC3-06 — Notifications IDOR, Unprivileged Dispatch & Dishonest "DISPATCHED" Status Flags
- **Severity:** P0 (Unauthorized Notification Trigger + Fabricated Delivery Status)
- **Locations:** `backend/app/api/endpoints/notifications.py:22-78`; `backend/app/api/endpoints/academy.py:724-755`
- **Root Cause:**
  - `/notifications/subscribe` trusts client-supplied `user_id` instead of authenticated caller ID.
  - `/notifications/dispatch-reminder` lacks strict role enforcement (`["admin", "teacher"]`) and returns `"status": "DISPATCHED"` even though `pywebpush` is commented out and nothing is transmitted.
  - `academy.py:724` (`/dispatch-result-sms`) similarly returns `"DISPATCHED"` without an SMS provider.
- **Status:** OPEN (Targeted in Phase 1 & Phase 6).

### F-RC3-07 — Hardcoded Webhook Secrets, Hardcoded Tenant/Token Fallbacks & Simulated OMR Fallback
- **Severity:** P0 (Signature Forgery + Fabricated Grading Output)
- **Locations:**
  - `backend/app/services/payment_providers.py:153,215,266`: Default secrets `"bkash-webhook-secret-salt-2026"`, `"nagad-webhook-secret-salt-2026"`, `"sslcommerz-secret-2026"`.
  - `backend/app/api/endpoints/finance.py:474`: Falls back to `"default-webhook-secret-salt-2026"`.
  - `backend/app/api/endpoints/communication.py:46,83`: Hardcodes WhatsApp verify token and fallback Kids Shine tenant UUID.
  - `backend/app/api/endpoints/academy.py:663-665`: Falls back to simulated OMR answers when scan/parsing fails.
- **Status:** OPEN (Targeted in Phase 1 & Phase 5).

### F-RC3-08 — Learning Studio Disconnected End-to-End & Bypassing AI Gateway
- **Severity:** P0 (Broken Core Student Feature + Unmetered AI Surface)
- **Locations:** `backend/app/api/endpoints/learning_studio.py`; `frontend/app/dashboard/learning/page.tsx`; `frontend/components/RoleRouteGuard.tsx:66-73`
- **Root Cause:**
  - Backend mounts routes under `/api/v1/learning-os/...` while `frontend/app/dashboard/learning/page.tsx` calls `/api/v1/learning-studio/...` with mismatched request/response payloads.
  - `RoleRouteGuard.tsx:66-73` omits `/dashboard/learning`, `/dashboard/attendance`, and `/dashboard/profile` from student/guardian allowlists.
  - `learning_studio.py` invokes AI directly instead of routing through `MultiModelAIGateway` (`app/services/ai_gateway.py` budget/prompt-injection controls).
- **Status:** OPEN (Targeted in Phase 3).

### F-RC3-09 — Fragmented Pricing Engines, Float Money Arithmetic & Client-Side Price Calculation
- **Severity:** P1 (Commercial & Financial Integrity)
- **Locations:** `backend/app/services/pricing_engine.py`; `backend/app/api/endpoints/billing.py`; `backend/app/api/endpoints/subscriptions.py` (unmounted); `frontend/components/public/DynamicPricingCalculator.tsx`; `frontend/app/onboard/page.tsx`
- **Root Cause:**
  - Three separate pricing definitions exist (`pricing_engine.py` dynamic float-based progressive 12/10/8 BDT tiers with `IS_OWNER_APPROVED = False`, `billing.py:PRICING_PLANS`, and unmounted `subscriptions.py:PRICING_PLANS`).
  - `pricing_engine.py` uses Python `float` rather than `Decimal` currency rounding.
  - Frontend calculator and onboarding page compute prices locally rather than calling authoritative backend `POST /api/v1/billing/calculate-quote`.
- **Status:** OPEN (Targeted in Phase 4).

### F-RC3-10 — SaaS Payment Reconciliation Governance & Missing Dual-Custody Ledger
- **Severity:** P1 (Self-Approval Risk & Audit Trail Gap)
- **Location:** `backend/app/api/endpoints/billing.py:669`; `backend/app/models/subscription_payment.py`
- **Root Cause:** `billing.py:669` permits tenant `"admin"` users to call `/admin/reconcile-payment` (self-approving SaaS subscription payments instead of requiring platform `superadmin` / dual-custody verification), lacks immutable ledger reversal/dispute records, and lacks unique active transaction reference enforcement against duplicate claims.
- **Status:** OPEN (Targeted in Phase 5).

### F-RC3-11 — Absence of Live Gateway, SMS, Email, and WebPush Provider Credentials
- **Severity:** P1 (External Commercial Readiness Blocker)
- **Location:** `backend/.env`; `backend/app/services/payment_providers.py`
- **Evidence:** Zero `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, `SMS_*`, `SMTP_*`, or `VAPID_*` keys exist in environment. Live gateway delivery is **NOT LIVE / SANDBOX-CODE-ONLY**.
- **Status:** BLOCKED ON CREDENTIALS (Must be explicitly documented in Payment Readiness Matrix and Final Release Verdict).

### F-RC3-12 — Legacy Relationship Table Split, Missing Unique Constraints, Test Pollution & Absent CI Pipeline
- **Severity:** P1 (Schema Drift / Data Integrity / DevOps)
- **Evidence:**
  - Live DB has 1 orphan student-guardian row in legacy `guardian_students` (`Taki Hussain -> Talha Hussain`) absent from `student_guardians`.
  - `student_guardians` PK `(student_id, guardian_id, id)` allows duplicate `(tenant_id, guardian_id, student_id)` rows.
  - `users` lacks partial unique indexes on `(tenant_id, username)` and `(tenant_id, phone_number)`.
  - 6 orphan `'Reconstruction Test Academy'` tenants left in live Supabase DB.
  - `.github/workflows/` contains only `keep-alive.yaml` (zero test/lint/typecheck CI workflow).
- **Status:** OPEN (Targeted in Phase 1, Phase 7 & Phase 11).

### F-RC3-13 — Hardcoded School Branding, Fabricated Dashboard Defaults, Portal Navigation Gaps & 355 ESLint Errors
- **Severity:** P1 (UX Honesty, White-Label Compliance & Frontend Code Quality)
- **Locations:**
  - `frontend/app/dashboard/guardians/page.tsx` (hardcoded `কিডস শাইন...`).
  - `frontend/app/dashboard/profile/page.tsx` (hardcoded `Kids Shine International School` and `user@kidsshine.edu.bd`).
  - `frontend/app/dashboard/page.tsx` (displays `"100%"` and `"Present"` fallback strings when data/child is missing).
  - `frontend/app/dashboard/finance/page.tsx` (redirects `finance_officer`/`accountant`/guardians/students instead of providing role-appropriate billing/fee receipt view).
  - `frontend/components/RoleRouteGuard.tsx` & `frontend/app/dashboard/layout.tsx` (incomplete Student/Guardian portal routes).
  - `frontend/` ESLint baseline: 178 errors + 177 warnings.
- **Status:** OPEN (Targeted in Phase 3 & Phase 11).

