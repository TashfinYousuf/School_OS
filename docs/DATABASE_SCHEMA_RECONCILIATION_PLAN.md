# EDUCATIONOS — DATABASE SCHEMA RECONCILIATION PLAN

**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/DATABASE_SCHEMA_RECONCILIATION_PLAN.md`  
**Classification:** P0 DATABASE RELIABILITY & INTEGRITY  
**Date:** November 9, 2026  
**Lead Authors:** Database Reliability Engineer, Principal Software Architect, Application Security Lead  
**Target Environments:** Supabase Production Database & Disposable Native PostgreSQL  

---

## 1. Problem Statement & Incident Description

During live verification of the EducationOS backend, the following critical database exception was observed:

```
GET /api/v1/billing/status → HTTP 500
psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist
```

### Exact Call Sequence:
1. Client issues `GET /api/v1/billing/status` with an authenticated administrator token.
2. FastAPI invokes `get_subscription_status(db, tenant_id)` in `backend/app/api/endpoints/billing.py:251`.
3. SQLAlchemy compiles an ORM select query for entity `InstitutionSubscription`:
   ```sql
   SELECT institution_subscriptions.id, 
          institution_subscriptions.tenant_id, 
          institution_subscriptions.plan_tier, 
          institution_subscriptions.workspace_scope, 
          institution_subscriptions.monthly_fee, 
          institution_subscriptions.billing_cycle, 
          institution_subscriptions.currency, 
          institution_subscriptions.ai_question_quota_monthly, 
          institution_subscriptions.ai_questions_used_this_month, 
          institution_subscriptions.max_active_students, 
          institution_subscriptions.subscription_status, 
          institution_subscriptions.current_period_start, 
          institution_subscriptions.valid_until, 
          institution_subscriptions.trial_ends_at, 
          institution_subscriptions.grace_period_until, 
          institution_subscriptions.created_at 
   FROM institution_subscriptions 
   WHERE institution_subscriptions.tenant_id = %(tenant_id_1)s 
   LIMIT 1;
   ```
4. PostgreSQL engine aborts the transaction with `psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist`.

---

## 2. Root Cause Analysis: Schema Drift & Migration Desynchronization

Inspection of the migration history reveals how this drift occurred:
1. **Initial Table Creation:** Migration `c1a2b3c4d5e6` (`add_workspaces_and_schema_reconciliation`) created `institution_subscriptions` with 12 baseline columns (excluding `currency`, `current_period_start`, `trial_ends_at`, `grace_period_until`).
2. **Stage 12 Migration Added:** Migration `c3d4e5f6a7b8` (`stage12_subscription_billing`) was authored to add the 4 lifecycle columns and create SaaS billing tables (`subscription_plans`, `plan_versions`, `billing_invoices`, etc.).
3. **Execution Gap on Production:**
   - The live Supabase instance is connected via PgBouncer on port 6543 (transaction pooling mode).
   - In transaction pooling mode, prepared statements and DDL migration commands requiring session locks can fail or hang.
   - Consequently, migration `c3d4e5f6a7b8` was executed only in local in-memory/test SQLite suites, but **was never applied to the live Supabase PostgreSQL database**.
4. **Additional Schema Drift (`backend/scripts/schema_drift.py`):**
   A comprehensive read-only scan against the live database detected 12 additional drift items:
   - **Missing Tables:** `ai_usage_logs`, `campus_branches`, `push_subscriptions`, `refresh_token_sessions`, `revoked_token_records`, `tenant_ai_budgets`.
   - **Missing Columns:** `workspaces.organization_id` (UUID), `workspaces.code` (VARCHAR(50)).
   - **Column Length Discrepancies:** `fee_payments.payment_method` (model: 32 chars, live: 13 chars), `fee_payments.payment_status` (model: 32 chars, live: 9 chars).
   - **Type Discrepancies:** `students.tenant_id` (model: VARCHAR, live: UUID), `exam_results.student_id` (model: UUID, live: VARCHAR).

---

## 3. Migration Safety Principles & Policy

1. **Zero Data Loss:** Existing student, teacher, fee payment, and exam records must be preserved with 100% integrity.
2. **Safe Expand → Backfill → Constrain:** Never add `NOT NULL` without a `DEFAULT` on existing tables.
3. **Idempotency:** All DDL statements must utilize `IF NOT EXISTS` / `IF EXISTS` blocks to allow safe re-execution.
4. **Single Alembic DAG Head:** Maintain a single canonical DAG head (`c4d5e6f7a8b9`) in `backend/alembic/versions/`.
5. **No Destructive Drops:** Do not drop tables or truncate live data.
6. **Preserve RLS Policies:** Ensure Row-Level Security policies on tenant-scoped tables remain active and enforced.

---

## 4. Itemized Schema Reconciliation Specification

### 4.1 `institution_subscriptions` Table Reconciliation
```sql
-- 1. Add missing lifecycle columns to institution_subscriptions
ALTER TABLE "institution_subscriptions" 
ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL;

ALTER TABLE "institution_subscriptions" 
ADD COLUMN IF NOT EXISTS "current_period_start" TIMESTAMPTZ;

ALTER TABLE "institution_subscriptions" 
ADD COLUMN IF NOT EXISTS "trial_ends_at" TIMESTAMPTZ;

ALTER TABLE "institution_subscriptions" 
ADD COLUMN IF NOT EXISTS "grace_period_until" TIMESTAMPTZ;
```

---

### 4.2 Missing Security & Multi-Tenancy Tables

#### A. Token Revocation & Session Persistence (Auth Hardening)
```sql
CREATE TABLE IF NOT EXISTS "revoked_token_records" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "token_jti" VARCHAR(255) NOT NULL UNIQUE,
    "user_id" VARCHAR(64) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "token_type" VARCHAR(32) DEFAULT 'access' NOT NULL,
    "revocation_reason" VARCHAR(255),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_revoked_token_records_jti" ON "revoked_token_records" ("token_jti");
CREATE INDEX IF NOT EXISTS "ix_revoked_token_records_tenant" ON "revoked_token_records" ("tenant_id");

CREATE TABLE IF NOT EXISTS "refresh_token_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "refresh_jti" VARCHAR(255) NOT NULL UNIQUE,
    "user_id" VARCHAR(64) NOT NULL,
    "tenant_id" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "device_info" VARCHAR(255),
    "ip_address" VARCHAR(64),
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "ix_refresh_token_sessions_jti" ON "refresh_token_sessions" ("refresh_jti");
CREATE INDEX IF NOT EXISTS "ix_refresh_token_sessions_user" ON "refresh_token_sessions" ("user_id");
```

#### B. Campus Branches & Organization Hierarchy
```sql
CREATE TABLE IF NOT EXISTS "campus_branches" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "address" TEXT,
    "contact_phone" VARCHAR(32),
    "contact_email" VARCHAR(128),
    "is_main_campus" BOOLEAN DEFAULT false NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT "uq_campus_branches_code" UNIQUE ("tenant_id", "code")
);
CREATE INDEX IF NOT EXISTS "ix_campus_branches_tenant_id" ON "campus_branches" ("tenant_id");
```

#### C. AI Usage Logs & Tenant Budgets
```sql
CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64),
    "feature_name" VARCHAR(64) NOT NULL,
    "prompt_tokens" INTEGER DEFAULT 0 NOT NULL,
    "completion_tokens" INTEGER DEFAULT 0 NOT NULL,
    "total_tokens" INTEGER DEFAULT 0 NOT NULL,
    "cost_bdt" NUMERIC(10, 4) DEFAULT 0.0000 NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_ai_usage_logs_tenant_id" ON "ai_usage_logs" ("tenant_id");

CREATE TABLE IF NOT EXISTS "tenant_ai_budgets" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL UNIQUE,
    "monthly_token_quota" INTEGER DEFAULT 100000 NOT NULL,
    "tokens_consumed_this_month" INTEGER DEFAULT 0 NOT NULL,
    "hard_limit_enabled" BOOLEAN DEFAULT true NOT NULL,
    "reset_day_of_month" INTEGER DEFAULT 1 NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "updated_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_tenant_ai_budgets_tenant_id" ON "tenant_ai_budgets" ("tenant_id");
```

#### D. Push Notification Subscriptions
```sql
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "user_id" VARCHAR(64) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_push_subscriptions_tenant_id" ON "push_subscriptions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "ix_push_subscriptions_user_id" ON "push_subscriptions" ("user_id");
```

---

### 4.3 Missing Columns in Existing Tables

```sql
-- Workspaces extensions
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50);

-- Column length expansions to avoid truncation on payment gateways
ALTER TABLE "fee_payments" ALTER COLUMN "payment_method" TYPE VARCHAR(32);
ALTER TABLE "fee_payments" ALTER COLUMN "payment_status" TYPE VARCHAR(32);
```

---

### 4.4 SaaS Billing Infrastructure Tables (from Stage 12 `c3d4e5f6a7b8`)

```sql
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "plan_code" VARCHAR(64) NOT NULL UNIQUE,
    "name" VARCHAR(100) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "price_bdt" NUMERIC(12, 2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL,
    "billing_period" VARCHAR(16) DEFAULT 'month' NOT NULL,
    "max_students" INTEGER DEFAULT 100 NOT NULL,
    "ai_quota" INTEGER DEFAULT 50 NOT NULL,
    "features" JSONB DEFAULT '[]'::jsonb NOT NULL,
    "is_active" BOOLEAN DEFAULT true NOT NULL,
    "version" INTEGER DEFAULT 1 NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plan_versions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "plan_code" VARCHAR(64) NOT NULL,
    "version_number" INTEGER NOT NULL,
    "price_bdt" NUMERIC(12, 2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL,
    "features_snapshot" JSONB DEFAULT '{}'::jsonb NOT NULL,
    "effective_from" TIMESTAMPTZ DEFAULT now() NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT "uq_plan_version_number" UNIQUE ("plan_code", "version_number")
);

CREATE TABLE IF NOT EXISTS "billing_invoices" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "invoice_number" VARCHAR(64) NOT NULL UNIQUE,
    "billing_cycle" VARCHAR(16) NOT NULL,
    "subtotal_amount" NUMERIC(12, 2) NOT NULL,
    "discount_amount" NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    "tax_amount" NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    "total_amount" NUMERIC(12, 2) NOT NULL,
    "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL,
    "status" VARCHAR(20) DEFAULT 'DRAFT' NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "due_date" TIMESTAMPTZ NOT NULL,
    "paid_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_billing_invoices_tenant_id" ON "billing_invoices" ("tenant_id");

CREATE TABLE IF NOT EXISTS "billing_invoice_line_items" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "billing_invoice_id" UUID NOT NULL REFERENCES "billing_invoices"("id") ON DELETE CASCADE,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER DEFAULT 1 NOT NULL,
    "unit_price" NUMERIC(12, 2) NOT NULL,
    "total_price" NUMERIC(12, 2) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "billing_webhook_events" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "gateway" VARCHAR(32) NOT NULL,
    "event_id" VARCHAR(128) NOT NULL,
    "signature_hash" VARCHAR(256) NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN DEFAULT false NOT NULL,
    "processed_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT "uq_billing_webhook_gateway_event" UNIQUE ("gateway", "event_id")
);

CREATE TABLE IF NOT EXISTS "tenant_entitlements" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "feature_key" VARCHAR(64) NOT NULL,
    "is_enabled" BOOLEAN DEFAULT true NOT NULL,
    "quota_limit" INTEGER,
    "quota_used" INTEGER DEFAULT 0 NOT NULL,
    "valid_until" TIMESTAMPTZ,
    "metadata_payload" JSONB DEFAULT '{}'::jsonb NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT "uq_tenant_feature_entitlement" UNIQUE ("tenant_id", "feature_key")
);
CREATE INDEX IF NOT EXISTS "ix_tenant_entitlements_tenant_id" ON "tenant_entitlements" ("tenant_id");

CREATE TABLE IF NOT EXISTS "billing_audit_logs" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(64) NOT NULL,
    "actor_user_id" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "resource_type" VARCHAR(64) NOT NULL,
    "resource_id" VARCHAR(128) NOT NULL,
    "changes" JSONB DEFAULT '{}'::jsonb NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ix_billing_audit_logs_tenant_id" ON "billing_audit_logs" ("tenant_id");
```

---

## 5. Step-by-Step Rollout & Verification Procedure

1. **Restore Migration Files:** Copy all canonical version scripts from `backend/alembic/versions_archive/` into `backend/alembic/versions/`.
2. **Offline Verification:** Run `python -m alembic upgrade head --sql` to verify clean syntax and zero dangling parents in the migration chain.
3. **Pre-Migration Backup:** Verify that a database backup exists before executing any DDL.
4. **Execution on Supabase:**
   - Execute the non-destructive reconciliation script via the Supabase Dashboard SQL Editor (which uses direct session mode, bypassing transaction pooler limits).
5. **Post-Migration Verification:**
   - Run `python backend/scripts/schema_drift.py` to confirm zero remaining missing tables or columns.
   - Run `pytest backend/tests/test_stage02_migrations.py` to confirm Alembic DAG health.
   - Execute test query against `InstitutionSubscription` to verify `currency` selects without error.

