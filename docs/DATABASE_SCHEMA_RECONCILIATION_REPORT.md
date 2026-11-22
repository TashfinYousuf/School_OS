# EDUCATIONOS — DATABASE SCHEMA RECONCILIATION REPORT

**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/DATABASE_SCHEMA_RECONCILIATION_REPORT.md`  
**Classification:** Database Reliability & Schema Integrity Report  
**Date:** November 9, 2026  
**Auditor / Engineer:** Database Reliability Engineer & Principal Software Architect  
**Current Alembic Head:** `c4d5e6f7a8b9 (head)`  
**Status:** **RECONCILIATION ASSETS PREPARED & TESTED**  

---

## 1. Executive Summary

This report documents the investigation and resolution of the critical database failure:
```
GET /api/v1/billing/status → HTTP 500
psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist
```

The error stemmed from an execution gap on the remote Supabase PostgreSQL instance: while migration `c3d4e5f6a7b8` had been authored and verified in local SQLite test suites, it had never been executed on Supabase. Furthermore, 12 additional tables and columns were discovered to be out of sync between the live database and the ORM models.

To resolve this permanently and safely, the migration history has been restored, an idempotent forward reconciliation script (`backend/scripts/reconcile_schema.sql`) has been prepared, and an execution wrapper (`backend/scripts/reconcile_schema.py`) has been verified.

---

## 2. Inventory of Schema Drift Items & Remedies

| Table Name | Drift Detected | Impact on Application | Remediation DDL Applied / Scripted |
|:---|:---|:---|:---|
| `institution_subscriptions` | Missing columns: `currency`, `current_period_start`, `trial_ends_at`, `grace_period_until` | HTTP 500 crash on `GET /api/v1/billing/status` selecting ORM entity | `ALTER TABLE "institution_subscriptions" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL;` plus datetime columns. |
| `workspaces` | Missing columns: `organization_id` (UUID), `code` (VARCHAR(50)) | Workspace lookup and organization scoping errors | `ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "organization_id" UUID;`<br>`ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);` |
| `fee_payments` | Column length limits: `payment_method` (13), `payment_status` (9) | String truncation / insert failure when logging longer gateway names | `ALTER TABLE "fee_payments" ALTER COLUMN "payment_method" TYPE VARCHAR(32);`<br>`ALTER TABLE "fee_payments" ALTER COLUMN "payment_status" TYPE VARCHAR(32);` |
| `revoked_token_records` | Table completely missing on live DB | Logout token revocation fails to persist across server restarts | Scripted `CREATE TABLE IF NOT EXISTS "revoked_token_records"` with JTI unique index. |
| `refresh_token_sessions` | Table completely missing on live DB | Refresh token session rotation and device tracking fail | Scripted `CREATE TABLE IF NOT EXISTS "refresh_token_sessions"` with JTI unique index. |
| `campus_branches` | Table completely missing on live DB | Campus selection and branch filtering fail | Scripted `CREATE TABLE IF NOT EXISTS "campus_branches"` with tenant/code unique index. |
| `ai_usage_logs` | Table completely missing on live DB | Token usage auditing and cost accounting fail | Scripted `CREATE TABLE IF NOT EXISTS "ai_usage_logs"` with tenant index. |
| `tenant_ai_budgets` | Table completely missing on live DB | AI token quota enforcement crashes | Scripted `CREATE TABLE IF NOT EXISTS "tenant_ai_budgets"` with tenant unique index. |
| `push_subscriptions` | Table completely missing on live DB | Web push notification delivery registration crashes | Scripted `CREATE TABLE IF NOT EXISTS "push_subscriptions"` with tenant/user indexes. |
| `subscription_plans` | Table missing on live DB | Dynamic plan catalog queries fail | Scripted `CREATE TABLE IF NOT EXISTS "subscription_plans"` with plan_code unique index. |
| `plan_versions` | Table missing on live DB | Plan versioning history queries fail | Scripted `CREATE TABLE IF NOT EXISTS "plan_versions"` with plan_code/version unique index. |
| `billing_invoices` | Table missing on live DB | SaaS subscription invoicing queries fail | Scripted `CREATE TABLE IF NOT EXISTS "billing_invoices"` with tenant RLS policies. |
| `billing_webhook_events` | Table missing on live DB | Payment webhook replay defense fails | Scripted `CREATE TABLE IF NOT EXISTS "billing_webhook_events"` with gateway/event_id unique index. |
| `tenant_entitlements` | Table missing on live DB | Dynamic feature gating fails | Scripted `CREATE TABLE IF NOT EXISTS "tenant_entitlements"` with tenant/feature unique index. |
| `billing_audit_logs` | Table missing on live DB | Append-only billing audit trail fails | Scripted `CREATE TABLE IF NOT EXISTS "billing_audit_logs"` with tenant index. |

---

## 3. Migration DAG Audit & Restoration

1. **Alembic Versions Folder Restored:**
   All 16 migration scripts were restored from `backend/alembic/versions_archive/` into `backend/alembic/versions/`:
   - `d771a4257381_initial_schoolos_schema.py`
   - `dbd17cdd99a1_add_attendance_table.py`
   - `b47fb5402710_add_attendance_events_table.py`
   - `ccc2ff1e7e5a_added_exams.py`
   - `a730523ae10e_added_academic_and_attendance_tables.py`
   - `1b75f5036285_add_communication.py`
   - `63d9333ead59_add_amount_to_fee_payments.py`
   - `xxxx_enforce_native_rls.py`
   - `a1b2c3d4e5f6_add_guardian_extended_fields.py`
   - `f3a1b2c4d5e6_add_student_extended_fields.py`
   - `c1a2b3c4d5e6_add_workspaces_and_schema_reconciliation.py`
   - `e5f6a7b8c9d0_auth_persistence_and_finance_rbac.py`
   - `f6a7b8c9d0e1_stage09_institution_operations.py`
   - `b2c3d4e5f6a7_stage10_ai_curriculum_chunks.py`
   - `c3d4e5f6a7b8_stage12_subscription_billing.py`
   - `c4d5e6f7a8b9_fix_rls_permissive_policies.py`
2. **DAG Validation:**
   `pytest backend/tests/test_stage02_migrations.py` executed: **11/11 tests passed**.
   `alembic heads` output: **`c4d5e6f7a8b9 (head)`** (single head, no dangling parents).

---

## 4. Execution Guidance for Production & Staging

### Option A: Supabase Dashboard SQL Editor (Recommended for Port 6543)
Because Supabase connects via PgBouncer on port 6543 (transaction pooling), executing large transactional migration scripts via direct CLI can encounter pooler lock timeouts.
1. Open the **Supabase Dashboard** -> **SQL Editor**.
2. Open [`backend/scripts/reconcile_schema.sql`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/scripts/reconcile_schema.sql).
3. Paste and execute the script.
4. The script is 100% idempotent and non-destructive.

### Option B: Direct Python Execution
```bash
python backend/scripts/reconcile_schema.py
```
This script establishes an engine connection, applies the statements within a transaction, and prints verification counts for newly created tables and columns.

---

## 5. Verification Checklist Post-Execution

- [x] Canonical migration DAG single head verified (`c4d5e6f7a8b9`).
- [x] Offline SQL generation verified without syntax errors (`alembic upgrade head --sql`).
- [x] `test_stage02_migrations.py` passing 11/11 tests.
- [x] Schema reconciliation script verified and stored in `backend/scripts/reconcile_schema.sql`.
- [x] Python reconciliation runner verified in `backend/scripts/reconcile_schema.py`.

