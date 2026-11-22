"""stage12_subscription_billing

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-08 04:00:00.000000
"""
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    tables = []
    columns_inst_subs = []
    is_offline = context.is_offline_mode()

    if not is_offline:
        insp = sa.inspect(conn)
        tables = insp.get_table_names()
        if "institution_subscriptions" in tables:
            columns_inst_subs = [c["name"] for c in insp.get_columns("institution_subscriptions")]

    # 1. Extend institution_subscriptions with lifecycle columns
    if is_offline or 'currency' not in columns_inst_subs:
        op.add_column('institution_subscriptions', sa.Column('currency', sa.String(length=3), server_default='BDT', nullable=False))
    if is_offline or 'current_period_start' not in columns_inst_subs:
        op.add_column('institution_subscriptions', sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True))
    if is_offline or 'trial_ends_at' not in columns_inst_subs:
        op.add_column('institution_subscriptions', sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True))
    if is_offline or 'grace_period_until' not in columns_inst_subs:
        op.add_column('institution_subscriptions', sa.Column('grace_period_until', sa.DateTime(timezone=True), nullable=True))

    # 2. subscription_plans
    if is_offline or 'subscription_plans' not in tables:
        op.create_table(
            'subscription_plans',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('plan_code', sa.String(length=64), nullable=False),
            sa.Column('name', sa.String(length=100), nullable=False),
            sa.Column('category', sa.String(length=32), nullable=False),
            sa.Column('price_bdt', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('currency', sa.String(length=3), server_default='BDT', nullable=False),
            sa.Column('billing_period', sa.String(length=16), server_default='month', nullable=False),
            sa.Column('max_students', sa.Integer(), server_default='100', nullable=False),
            sa.Column('ai_quota', sa.Integer(), server_default='50', nullable=False),
            sa.Column('features', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
            sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('version', sa.Integer(), server_default='1', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('plan_code', name='uq_subscription_plan_code')
        )
        op.create_index(op.f('ix_subscription_plans_id'), 'subscription_plans', ['id'], unique=False)
        op.create_index(op.f('ix_subscription_plans_plan_code'), 'subscription_plans', ['plan_code'], unique=True)

    # 3. plan_versions
    if is_offline or 'plan_versions' not in tables:
        op.create_table(
            'plan_versions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('plan_code', sa.String(length=64), nullable=False),
            sa.Column('version_number', sa.Integer(), nullable=False),
            sa.Column('price_bdt', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('currency', sa.String(length=3), server_default='BDT', nullable=False),
            sa.Column('features_snapshot', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
            sa.Column('effective_from', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('plan_code', 'version_number', name='uq_plan_version_number')
        )
        op.create_index(op.f('ix_plan_versions_id'), 'plan_versions', ['id'], unique=False)
        op.create_index(op.f('ix_plan_versions_plan_code'), 'plan_versions', ['plan_code'], unique=False)

    # 4. billing_invoices
    if is_offline or 'billing_invoices' not in tables:
        op.create_table(
            'billing_invoices',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('subscription_id', sa.UUID(), nullable=True),
            sa.Column('invoice_number', sa.String(length=64), nullable=False),
            sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('currency', sa.String(length=3), server_default='BDT', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='ISSUED', nullable=False),
            sa.Column('billing_cycle', sa.String(length=20), server_default='monthly', nullable=False),
            sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
            sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
            sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('invoice_number', name='uq_billing_invoice_number')
        )
        op.create_index(op.f('ix_billing_invoices_id'), 'billing_invoices', ['id'], unique=False)
        op.create_index(op.f('ix_billing_invoices_tenant_id'), 'billing_invoices', ['tenant_id'], unique=False)
        op.create_index('ix_billing_invoices_tenant_status', 'billing_invoices', ['tenant_id', 'status'], unique=False)

    # 5. billing_invoice_line_items
    if is_offline or 'billing_invoice_line_items' not in tables:
        op.create_table(
            'billing_invoice_line_items',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('billing_invoice_id', sa.UUID(), nullable=False),
            sa.Column('description', sa.String(length=255), nullable=False),
            sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
            sa.Column('unit_price', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('total_price', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['billing_invoice_id'], ['billing_invoices.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_billing_invoice_line_items_id'), 'billing_invoice_line_items', ['id'], unique=False)
        op.create_index(op.f('ix_billing_invoice_line_items_billing_invoice_id'), 'billing_invoice_line_items', ['billing_invoice_id'], unique=False)

    # 6. billing_webhook_events
    if is_offline or 'billing_webhook_events' not in tables:
        op.create_table(
            'billing_webhook_events',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('gateway', sa.String(length=32), nullable=False),
            sa.Column('event_id', sa.String(length=128), nullable=False),
            sa.Column('signature_hash', sa.String(length=256), nullable=False),
            sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column('processed', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('gateway', 'event_id', name='uq_billing_webhook_gateway_event')
        )
        op.create_index(op.f('ix_billing_webhook_events_id'), 'billing_webhook_events', ['id'], unique=False)
        op.create_index(op.f('ix_billing_webhook_events_event_id'), 'billing_webhook_events', ['event_id'], unique=False)

    # 7. tenant_entitlements
    if is_offline or 'tenant_entitlements' not in tables:
        op.create_table(
            'tenant_entitlements',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('feature_key', sa.String(length=64), nullable=False),
            sa.Column('is_enabled', sa.Boolean(), server_default='true', nullable=False),
            sa.Column('quota_limit', sa.Integer(), nullable=True),
            sa.Column('quota_used', sa.Integer(), server_default='0', nullable=False),
            sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
            sa.Column('metadata_payload', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('tenant_id', 'feature_key', name='uq_tenant_feature_entitlement')
        )
        op.create_index(op.f('ix_tenant_entitlements_id'), 'tenant_entitlements', ['id'], unique=False)
        op.create_index(op.f('ix_tenant_entitlements_tenant_id'), 'tenant_entitlements', ['tenant_id'], unique=False)
        op.create_index('ix_tenant_entitlements_lookup', 'tenant_entitlements', ['tenant_id', 'feature_key', 'is_enabled'], unique=False)

    # 8. billing_audit_logs
    if is_offline or 'billing_audit_logs' not in tables:
        op.create_table(
            'billing_audit_logs',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('actor_id', sa.String(length=64), nullable=False),
            sa.Column('action', sa.String(length=64), nullable=False),
            sa.Column('old_state', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
            sa.Column('new_state', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_billing_audit_logs_id'), 'billing_audit_logs', ['id'], unique=False)
        op.create_index(op.f('ix_billing_audit_logs_tenant_id'), 'billing_audit_logs', ['tenant_id'], unique=False)

    # 9. Row Level Security Policies on Tenant-Scoped Billing Tables
    for tbl in ['billing_invoices', 'tenant_entitlements', 'billing_audit_logs']:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = '{tbl}' AND policyname = 'tenant_{tbl}_isolation'
                ) THEN
                    CREATE POLICY tenant_{tbl}_isolation ON {tbl}
                    AS RESTRICTIVE
                    FOR ALL
                    USING (
                        tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                    );
                END IF;
            END $$;
            """
        )


def downgrade() -> None:
    # 1. Drop RLS
    for tbl in ['billing_audit_logs', 'tenant_entitlements', 'billing_invoices']:
        op.execute(f"DROP POLICY IF EXISTS tenant_{tbl}_isolation ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

    # 2. Drop tables in reverse dependency order
    op.drop_table('billing_audit_logs')
    op.drop_table('tenant_entitlements')
    op.drop_table('billing_webhook_events')
    op.drop_table('billing_invoice_line_items')
    op.drop_table('billing_invoices')
    op.drop_table('plan_versions')
    op.drop_table('subscription_plans')

    # 3. Drop columns from institution_subscriptions
    op.drop_column('institution_subscriptions', 'grace_period_until')
    op.drop_column('institution_subscriptions', 'trial_ends_at')
    op.drop_column('institution_subscriptions', 'current_period_start')
    op.drop_column('institution_subscriptions', 'currency')

