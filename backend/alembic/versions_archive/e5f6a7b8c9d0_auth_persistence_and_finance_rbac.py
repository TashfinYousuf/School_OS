"""auth_persistence_and_finance_rbac

Revision ID: e5f6a7b8c9d0
Revises: c1a2b3c4d5e6
Create Date: 2026-11-05 05:10:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e5f6a7b8c9d0'
down_revision = 'c1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Refresh Token Sessions
    op.create_table(
        'refresh_token_sessions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('jti', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('role', sa.String(length=32), server_default='student', nullable=False),
        sa.Column('parent_jti', sa.String(length=64), nullable=True),
        sa.Column('revoked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti')
    )
    op.create_index(op.f('ix_refresh_token_sessions_id'), 'refresh_token_sessions', ['id'], unique=False)
    op.create_index(op.f('ix_refresh_token_sessions_jti'), 'refresh_token_sessions', ['jti'], unique=True)
    op.create_index(op.f('ix_refresh_token_sessions_user_id'), 'refresh_token_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_refresh_token_sessions_tenant_id'), 'refresh_token_sessions', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_refresh_token_sessions_parent_jti'), 'refresh_token_sessions', ['parent_jti'], unique=False)
    op.create_index(op.f('ix_refresh_token_sessions_revoked'), 'refresh_token_sessions', ['revoked'], unique=False)
    op.create_index(op.f('ix_refresh_token_sessions_expires_at'), 'refresh_token_sessions', ['expires_at'], unique=False)

    # 2. Revoked Token Records
    op.create_table(
        'revoked_token_records',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('jti', sa.String(length=64), nullable=False),
        sa.Column('token_type', sa.String(length=32), server_default='access', nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('jti')
    )
    op.create_index(op.f('ix_revoked_token_records_id'), 'revoked_token_records', ['id'], unique=False)
    op.create_index(op.f('ix_revoked_token_records_jti'), 'revoked_token_records', ['jti'], unique=True)
    op.create_index(op.f('ix_revoked_token_records_expires_at'), 'revoked_token_records', ['expires_at'], unique=False)

    # 3. Invoices
    op.create_table(
        'invoices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('student_id', sa.String(length=64), nullable=False),
        sa.Column('invoice_number', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=150), server_default='Monthly Tuition Invoice', nullable=False),
        sa.Column('billing_month', sa.String(length=50), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('paid_amount', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='BDT', nullable=False),
        sa.Column('status', sa.String(length=32), server_default='ISSUED', nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'invoice_number', name='uq_invoices_tenant_number')
    )
    op.create_index(op.f('ix_invoices_id'), 'invoices', ['id'], unique=False)
    op.create_index(op.f('ix_invoices_tenant_id'), 'invoices', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_invoices_student_id'), 'invoices', ['student_id'], unique=False)
    op.create_index(op.f('ix_invoices_invoice_number'), 'invoices', ['invoice_number'], unique=False)
    op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'], unique=False)

    # 4. Invoice Line Items
    op.create_table(
        'invoice_line_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='1', nullable=False),
        sa.Column('unit_price', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_invoice_line_items_id'), 'invoice_line_items', ['id'], unique=False)
    op.create_index(op.f('ix_invoice_line_items_invoice_id'), 'invoice_line_items', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_invoice_line_items_tenant_id'), 'invoice_line_items', ['tenant_id'], unique=False)

    # 5. Add invoice_id to fee_payments
    op.add_column('fee_payments', sa.Column('invoice_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_fee_payments_invoice_id'), 'fee_payments', ['invoice_id'], unique=False)

    # 6. RLS for invoices and invoice_line_items
    op.execute("ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE invoices FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON invoices;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON invoices
        AS PERMISSIVE
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    """)

    op.execute("ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE invoice_line_items FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON invoice_line_items;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON invoice_line_items
        AS PERMISSIVE
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON invoice_line_items;")
    op.execute("ALTER TABLE invoice_line_items NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE invoice_line_items DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON invoices;")
    op.execute("ALTER TABLE invoices NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_fee_payments_invoice_id'), table_name='fee_payments')
    op.drop_column('fee_payments', 'invoice_id')

    op.drop_index(op.f('ix_invoice_line_items_tenant_id'), table_name='invoice_line_items')
    op.drop_index(op.f('ix_invoice_line_items_invoice_id'), table_name='invoice_line_items')
    op.drop_index(op.f('ix_invoice_line_items_id'), table_name='invoice_line_items')
    op.drop_table('invoice_line_items')

    op.drop_index(op.f('ix_invoices_status'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_invoice_number'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_student_id'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_tenant_id'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_id'), table_name='invoices')
    op.drop_table('invoices')

    op.drop_index(op.f('ix_revoked_token_records_expires_at'), table_name='revoked_token_records')
    op.drop_index(op.f('ix_revoked_token_records_jti'), table_name='revoked_token_records')
    op.drop_index(op.f('ix_revoked_token_records_id'), table_name='revoked_token_records')
    op.drop_table('revoked_token_records')

    op.drop_index(op.f('ix_refresh_token_sessions_expires_at'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_revoked'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_parent_jti'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_tenant_id'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_user_id'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_jti'), table_name='refresh_token_sessions')
    op.drop_index(op.f('ix_refresh_token_sessions_id'), table_name='refresh_token_sessions')
    op.drop_table('refresh_token_sessions')

