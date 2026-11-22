# RC3 Row-Level Security & Database Integrity Report

**Active Alembic Head:** `cedb24c053f7 (head)` | **Schema Drift Status:** `0 issue(s). Schema mile gache.`

## 1. Migration & Schema Hardening (`cedb24c053f7`)
File: [`backend/alembic/versions/cedb24c053f7_rc3_constraints_rls_and_billing_custody.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/alembic/versions/cedb24c053f7_rc3_constraints_rls_and_billing_custody.py) (revises `d5e6f7a8b9c0`)

- **Dual-Custody Billing Columns (`subscription_payments`):** Added `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, and `review_notes`.
- **Identity & Relationship Uniqueness Constraints:**
  - Partial unique index `uq_users_tenant_username_active` on `(tenant_id, lower(username))` and `uq_users_tenant_phone` on `(tenant_id, phone_number)` in [`backend/app/models/tenant.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/models/tenant.py) (matching SQLite and Postgres definitions without duplicating `ix_users_username` / `ix_users_phone`).
  - Unique constraint `uq_student_guardian_pair` on `student_guardians (tenant_id, guardian_id, student_id)` and partial unique index `uq_guardians_tenant_phone` in [`backend/app/models/guardian.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/models/guardian.py).
- **Non-Destructive Legacy Backfill:** Backfilled missing legacy `guardian_students` link (`Taki Hussain -> Talha Hussain`) into `student_guardians` without destructive drops.
- **Complete Public Table RLS Coverage:**
  - Added `AS PERMISSIVE` policies on the 4 previously `RESTRICTIVE`-only tables (`approval_tasks`, `attendance_events`, `audit_logs`, `fee_payments`) plus 28 previously uncovered tenant tables, `billing_invoice_line_items`, `tenants`, `workspace_memberships`, `subscription_plans`, `plan_versions`, and `revoked_token_records`.
  - Granted privileges to database role `authenticated`.

## 2. Runtime RLS Enforcement
- [`backend/app/core/database.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/core/database.py): Wired `SET LOCAL ROLE authenticated` inside SQLAlchemy `after_begin` and `get_tenant_db` (gated by `DB_ENFORCE_RLS_ROLE=true`) so application transactions execute under the `authenticated` PostgreSQL role rather than bypassing RLS.

## 3. Financial Pricing SSOT & Custody Integrity
- [`backend/app/services/pricing_engine.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/services/pricing_engine.py): Refactored monetary calculations (`calculate_student_charge_decimal`, `calculate_quote`) to fixed-precision `Decimal` (`ROUND_HALF_UP`, `0.01`), preserving `IS_OWNER_APPROVED = False` pending owner rate card approval.
- [`backend/app/api/endpoints/subscriptions.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/subscriptions.py): Removed duplicate `PRICING_PLANS` definition in favor of importing from [`backend/app/api/endpoints/billing.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/billing.py).
- [`backend/app/api/endpoints/billing.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/billing.py): Restricted `/admin/reconcile-payment` to `superadmin` with dual-custody check (`submitted_by != operator_id` -> HTTP `403`), duplicate `statement_reference` conflict check (`409`), safe dynamic plan name lookup, and added `/admin/reject-payment` and `/admin/reverse-payment`.

## 4. Database & Integrity Gate Evidence
- `cd backend && ../venv/bin/alembic current`: `cedb24c053f7 (head)` (Exit `0`)
- `bash backend/scripts/check.sh` (Steps 1–5 including `schema_drift.py`): Exit `0` (`0 issue(s).  Schema mile gache.`)
- `cd backend && PYTHONPATH=. ../venv/bin/pytest tests/test_rls_negative_db.py -vv`: Passed against Supabase PostgreSQL under `SET LOCAL ROLE authenticated`, asserting `0` rows returned across 10 protected tables (`users`, `guardians`, `student_guardians`, `student_results`, `fee_payments`, `audit_logs`, `attendance_events`, `approval_tasks`, `subscription_payments`, `tenants`) when `app.current_tenant_id` is empty or switched to an unowned tenant UUID.
- `PYTHONPATH=backend venv/bin/python backend/scripts/owner_approved_db_remediation.py`: Exit `0` (`Dry-run complete. No rows modified.`), confirming exact primary keys for the 3 role-polluted Kids Shine accounts and 6 orphan `Reconstruction Test Academy` tenants awaiting owner approval to execute cleanup.

## 5. Gaps & Limitations
- Local PostgreSQL server and Docker daemon are unavailable in this workstation environment; all live Postgres DDL/RLS checks ran directly against Supabase PostgreSQL, and local offline unit suites ran on SQLite via SQLAlchemy.
- Supabase Point-in-Time Recovery / automated backup restore drill remains an operational procedure documented in [`docs/RC3_BACKUP_RESTORE_DRILL.md`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/RC3_BACKUP_RESTORE_DRILL.md) rather than a restored snapshot run.

