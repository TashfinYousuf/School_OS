-- ==============================================================================
-- EducationOS / EducationOS — Supabase Live Database Schema Reconciliation Script
-- Authoritative Alembic Target: e5f6a7b8c9d0 (Single Linear DAG Head)
-- Description: Non-destructive, idempotent reconciliation script to resolve all 
--              16 schema drift findings reported by backend/scripts/schema_drift.py.
-- Instructions: Copy and execute this script in Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. Ensure Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Alter Existing Columns: Widening & Missing Attributes (Zero Data Loss)
-- 2.1 Workspaces
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS code VARCHAR(50);
CREATE INDEX IF NOT EXISTS ix_workspaces_organization_id ON "workspaces" (organization_id);
CREATE INDEX IF NOT EXISTS ix_workspaces_code ON "workspaces" (code);

-- 2.2 Fee Payments Column Length Widening & Missing Reference
ALTER TABLE "fee_payments" ALTER COLUMN "payment_method" TYPE VARCHAR(32);
ALTER TABLE "fee_payments" ALTER COLUMN "payment_status" TYPE VARCHAR(32);
ALTER TABLE "fee_payments" ADD COLUMN IF NOT EXISTS invoice_id UUID;
CREATE INDEX IF NOT EXISTS ix_fee_payments_invoice_id ON "fee_payments" (invoice_id);

-- 2.3 Exam Results student_id Type Cast (text -> uuid)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'exam_results' AND column_name = 'student_id' AND data_type = 'text'
    ) THEN
        ALTER TABLE "exam_results" ALTER COLUMN "student_id" TYPE uuid USING "student_id"::uuid;
    END IF;
END $$;

-- 2.4 Student Guardians Relationship & Contact Defaults
DO $$
BEGIN
    -- Ensure relationship_type has default and not null
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_guardians' AND column_name = 'relationship_type'
    ) THEN
        UPDATE "student_guardians" SET "relationship_type" = 'Father' WHERE "relationship_type" IS NULL;
        ALTER TABLE "student_guardians" ALTER COLUMN "relationship_type" SET DEFAULT 'Father';
        ALTER TABLE "student_guardians" ALTER COLUMN "relationship_type" SET NOT NULL;
    END IF;

    -- Ensure is_primary_contact has default and not null
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'student_guardians' AND column_name = 'is_primary_contact'
    ) THEN
        UPDATE "student_guardians" SET "is_primary_contact" = 'Yes' WHERE "is_primary_contact" IS NULL;
        ALTER TABLE "student_guardians" ALTER COLUMN "is_primary_contact" SET DEFAULT 'Yes';
        ALTER TABLE "student_guardians" ALTER COLUMN "is_primary_contact" SET NOT NULL;
    END IF;
END $$;


-- 3. Create Missing Tables

-- 3.1 Authentication Session & Token Revocation Tables
CREATE TABLE IF NOT EXISTS "refresh_token_sessions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    role VARCHAR(32) DEFAULT 'student' NOT NULL,
    parent_jti VARCHAR(64),
    revoked BOOLEAN DEFAULT FALSE NOT NULL,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_id ON "refresh_token_sessions" (id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_jti ON "refresh_token_sessions" (jti);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_user_id ON "refresh_token_sessions" (user_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_tenant_id ON "refresh_token_sessions" (tenant_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_parent_jti ON "refresh_token_sessions" (parent_jti);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_revoked ON "refresh_token_sessions" (revoked);
CREATE INDEX IF NOT EXISTS ix_refresh_token_sessions_expires_at ON "refresh_token_sessions" (expires_at);

CREATE TABLE IF NOT EXISTS "revoked_token_records" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(64) UNIQUE NOT NULL,
    token_type VARCHAR(32) DEFAULT 'access' NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_revoked_token_records_id ON "revoked_token_records" (id);
CREATE INDEX IF NOT EXISTS ix_revoked_token_records_jti ON "revoked_token_records" (jti);
CREATE INDEX IF NOT EXISTS ix_revoked_token_records_expires_at ON "revoked_token_records" (expires_at);


-- 3.2 Finance: Invoices & Granular Line Items
CREATE TABLE IF NOT EXISTS "invoices" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    student_id VARCHAR(64) NOT NULL,
    invoice_number VARCHAR(64) NOT NULL,
    title VARCHAR(150) DEFAULT 'Monthly Tuition Invoice' NOT NULL,
    billing_month VARCHAR(50) NOT NULL,
    total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    paid_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    currency VARCHAR(3) DEFAULT 'BDT' NOT NULL,
    status VARCHAR(32) DEFAULT 'ISSUED' NOT NULL,
    due_date TIMESTAMPTZ,
    issued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_invoices_tenant_number UNIQUE (tenant_id, invoice_number)
);
CREATE INDEX IF NOT EXISTS ix_invoices_id ON "invoices" (id);
CREATE INDEX IF NOT EXISTS ix_invoices_tenant_id ON "invoices" (tenant_id);
CREATE INDEX IF NOT EXISTS ix_invoices_student_id ON "invoices" (student_id);
CREATE INDEX IF NOT EXISTS ix_invoices_invoice_number ON "invoices" (invoice_number);
CREATE INDEX IF NOT EXISTS ix_invoices_status ON "invoices" (status);
CREATE INDEX IF NOT EXISTS ix_invoices_tenant_student_status ON "invoices" (tenant_id, student_id, status);

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES "invoices"(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_invoice_line_items_id ON "invoice_line_items" (id);
CREATE INDEX IF NOT EXISTS ix_invoice_line_items_invoice_id ON "invoice_line_items" (invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_line_items_tenant_id ON "invoice_line_items" (tenant_id);


-- 3.3 AI Governance: Usage Logs & Tenant Budgets
CREATE TABLE IF NOT EXISTS "tenant_ai_budgets" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) UNIQUE NOT NULL,
    monthly_token_limit BIGINT DEFAULT 2000000 NOT NULL,
    used_tokens_current_cycle BIGINT DEFAULT 0 NOT NULL,
    monthly_budget_usd INTEGER DEFAULT 25 NOT NULL,
    is_hard_locked BOOLEAN DEFAULT FALSE NOT NULL,
    billing_cycle_start TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_tenant_ai_budgets_tenant_id ON "tenant_ai_budgets" (tenant_id);

CREATE TABLE IF NOT EXISTS "ai_usage_logs" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    model_name VARCHAR(64) DEFAULT 'gemini-2.5-flash' NOT NULL,
    feature VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0 NOT NULL,
    completion_tokens INTEGER DEFAULT 0 NOT NULL,
    total_tokens INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_id ON "ai_usage_logs" (id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_tenant_id ON "ai_usage_logs" (tenant_id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_user_id ON "ai_usage_logs" (user_id);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_feature ON "ai_usage_logs" (feature);
CREATE INDEX IF NOT EXISTS ix_ai_usage_logs_created_at ON "ai_usage_logs" (created_at);


-- 3.4 Multi-Campus & Notification Infrastructure
CREATE TABLE IF NOT EXISTS "campus_branches" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    branch_name VARCHAR(150) NOT NULL,
    branch_code VARCHAR(20) NOT NULL,
    address VARCHAR(255) DEFAULT 'Nazrul Avenue, Kandirpar, Cumilla-3500',
    phone VARCHAR(50) DEFAULT '+8801971122084',
    is_main_branch BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_campus_branches_id ON "campus_branches" (id);
CREATE INDEX IF NOT EXISTS ix_campus_branches_tenant_id ON "campus_branches" (tenant_id);

CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(30) DEFAULT 'teacher',
    subscription_data JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_id ON "push_subscriptions" (id);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_tenant_id ON "push_subscriptions" (tenant_id);
CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user_id ON "push_subscriptions" (user_id);


-- 4. Row-Level Security (RLS) Tenant Isolation Policies
-- Invoices
ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoices";
CREATE POLICY tenant_isolation_policy ON "invoices"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Invoice Line Items
ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_line_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "invoice_line_items";
CREATE POLICY tenant_isolation_policy ON "invoice_line_items"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Tenant AI Budgets
ALTER TABLE "tenant_ai_budgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_ai_budgets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "tenant_ai_budgets";
CREATE POLICY tenant_isolation_policy ON "tenant_ai_budgets"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- AI Usage Logs
ALTER TABLE "ai_usage_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "ai_usage_logs";
CREATE POLICY tenant_isolation_policy ON "ai_usage_logs"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Campus Branches
ALTER TABLE "campus_branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "campus_branches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "campus_branches";
CREATE POLICY tenant_isolation_policy ON "campus_branches"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

-- Push Subscriptions
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "push_subscriptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "push_subscriptions";
CREATE POLICY tenant_isolation_policy ON "push_subscriptions"
    AS PERMISSIVE FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));


-- 5. Authoritative Alembic Version Stamp
CREATE TABLE IF NOT EXISTS "alembic_version" (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
DELETE FROM "alembic_version";
INSERT INTO "alembic_version" (version_num) VALUES ('e5f6a7b8c9d0');

COMMIT;

