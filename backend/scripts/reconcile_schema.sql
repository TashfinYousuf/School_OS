-- ============================================================================
-- EDUCATIONOS: Production Schema Reconciliation & Migration Script
-- Version: Reconcile to alembic head c4d5e6f7a8b9
-- Safe, Idempotent, Non-destructive (Preserves all existing data)
-- ============================================================================

-- 1. EXTEND institution_subscriptions (Resolves UndefinedColumn: currency)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'institution_subscriptions' AND column_name = 'currency'
    ) THEN
        ALTER TABLE "institution_subscriptions" ADD COLUMN "currency" VARCHAR(3) DEFAULT 'BDT' NOT NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'institution_subscriptions' AND column_name = 'current_period_start'
    ) THEN
        ALTER TABLE "institution_subscriptions" ADD COLUMN "current_period_start" TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'institution_subscriptions' AND column_name = 'trial_ends_at'
    ) THEN
        ALTER TABLE "institution_subscriptions" ADD COLUMN "trial_ends_at" TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'institution_subscriptions' AND column_name = 'grace_period_until'
    ) THEN
        ALTER TABLE "institution_subscriptions" ADD COLUMN "grace_period_until" TIMESTAMPTZ;
    END IF;
END $$;

-- 2. WORKSPACES EXTENSIONS
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspaces' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE "workspaces" ADD COLUMN "organization_id" UUID;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'workspaces' AND column_name = 'code'
    ) THEN
        ALTER TABLE "workspaces" ADD COLUMN "code" VARCHAR(50);
    END IF;
END $$;

-- 3. EXPAND COLUMN LENGTHS ON fee_payments (Prevents gateway string truncation)
ALTER TABLE "fee_payments" ALTER COLUMN "payment_method" TYPE VARCHAR(32);
ALTER TABLE "fee_payments" ALTER COLUMN "payment_status" TYPE VARCHAR(32);

-- 4. AUTH TOKEN HARDENING TABLES (Required for Token Revocation persistence across restarts)
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

-- 5. CAMPUS BRANCHES TABLE
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

-- 6. AI USAGE LOGS & BUDGET TABLES
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

-- 7. PUSH NOTIFICATION SUBSCRIPTIONS
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

-- 8. SAAS SUBSCRIPTION & BILLING INFRASTRUCTURE
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

-- 9. STAMP ALEMBIC VERSION TO HEAD c4d5e6f7a8b9 IF APPLIED
CREATE TABLE IF NOT EXISTS "alembic_version" (
    "version_num" VARCHAR(32) PRIMARY KEY
);

INSERT INTO "alembic_version" ("version_num")
VALUES ('c4d5e6f7a8b9')
ON CONFLICT ("version_num") DO NOTHING;

