"""admission_models_receipts_and_lifecycle

Revision ID: e7f8a9b0c1d2
Revises: 04834912199b
Create Date: 2026-11-16 11:35:00.000000

"""
from typing import Sequence, Union
from decimal import Decimal
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e7f8a9b0c1d2'
down_revision: Union[str, Sequence[str], None] = '04834912199b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    tenant_cols = []
    user_cols = []
    adm_app_cols = []
    existing_tables = set()
    try:
        insp = sa.inspect(bind)
        if insp:
            existing_tables = set(insp.get_table_names())
            if 'tenants' in existing_tables:
                tenant_cols = [c['name'] for c in insp.get_columns('tenants')]
            if 'users' in existing_tables:
                user_cols = [c['name'] for c in insp.get_columns('users')]
            if 'admission_applications' in existing_tables:
                adm_app_cols = [c['name'] for c in insp.get_columns('admission_applications')]
    except Exception:
        pass

    # 1. Add lifecycle columns to tenants and users (idempotent)
    with op.batch_alter_table('tenants') as batch_op:
        if 'is_active' not in tenant_cols:
            batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
        if 'deleted_at' not in tenant_cols:
            batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table('users') as batch_op:
        if 'deleted_at' not in user_cols:
            batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

    # 2. Create admission_sessions table
    if 'admission_sessions' not in existing_tables:
        op.create_table(
            'admission_sessions',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('academic_year', sa.String(length=20), server_default='2026', nullable=False),
            sa.Column('session_name', sa.String(length=100), nullable=False),
            sa.Column('admission_model', sa.String(length=20), server_default='MODEL_B', nullable=False),
            sa.Column('status', sa.String(length=20), server_default='OPEN', nullable=False),
            sa.Column('start_date', sa.Date(), nullable=True),
            sa.Column('end_date', sa.Date(), nullable=True),
            sa.Column('application_fee', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
            sa.Column('final_admission_fee', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
            sa.Column('class_fees', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('max_seats', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.Column('eligibility_criteria', sa.Text(), nullable=True),
            sa.Column('entrance_exam_date', sa.DateTime(timezone=True), nullable=True),
            sa.Column('entrance_exam_venue', sa.String(length=200), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('tenant_id', 'academic_year', 'session_name', name='uq_tenant_session_name')
        )
        op.create_index(op.f('ix_admission_sessions_id'), 'admission_sessions', ['id'], unique=False)
        op.create_index(op.f('ix_admission_sessions_tenant_id'), 'admission_sessions', ['tenant_id'], unique=False)
        op.create_index('ix_admission_sessions_tenant', 'admission_sessions', ['tenant_id', 'status'], unique=False)

    # 3. Add Model A & B columns to admission_applications
    with op.batch_alter_table('admission_applications') as batch_op:
        if 'session_id' not in adm_app_cols:
            batch_op.add_column(sa.Column('session_id', sa.UUID(), nullable=True))
            batch_op.create_index(op.f('ix_admission_applications_session_id'), ['session_id'], unique=False)
        if 'admission_model' not in adm_app_cols:
            batch_op.add_column(sa.Column('admission_model', sa.String(length=20), server_default='MODEL_B', nullable=False))
        if 'admit_card_number' not in adm_app_cols:
            batch_op.add_column(sa.Column('admit_card_number', sa.String(length=50), nullable=True))
        if 'entrance_exam_roll' not in adm_app_cols:
            batch_op.add_column(sa.Column('entrance_exam_roll', sa.String(length=50), nullable=True))
        if 'entrance_exam_score' not in adm_app_cols:
            batch_op.add_column(sa.Column('entrance_exam_score', sa.Numeric(precision=5, scale=2), nullable=True))
        if 'entrance_exam_details' not in adm_app_cols:
            batch_op.add_column(sa.Column('entrance_exam_details', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
        if 'selection_status' not in adm_app_cols:
            batch_op.add_column(sa.Column('selection_status', sa.String(length=32), server_default='PENDING', nullable=False))
        if 'final_admission_fee' not in adm_app_cols:
            batch_op.add_column(sa.Column('final_admission_fee', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False))
        if 'final_fee_payment_status' not in adm_app_cols:
            batch_op.add_column(sa.Column('final_fee_payment_status', sa.String(length=32), server_default='PENDING', nullable=False))
        if 'final_invoice_id' not in adm_app_cols:
            batch_op.add_column(sa.Column('final_invoice_id', sa.UUID(), nullable=True))

    # 4. Create admission_receipts table
    if 'admission_receipts' not in existing_tables:
        op.create_table(
            'admission_receipts',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('tenant_id', sa.String(length=64), nullable=False),
            sa.Column('receipt_number', sa.String(length=64), nullable=False),
            sa.Column('application_id', sa.UUID(), nullable=False),
            sa.Column('student_id', sa.UUID(), nullable=True),
            sa.Column('invoice_id', sa.UUID(), nullable=True),
            sa.Column('amount_paid', sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column('currency', sa.String(length=10), server_default='BDT', nullable=False),
            sa.Column('payment_method', sa.String(length=50), server_default='Cash Counter', nullable=False),
            sa.Column('transaction_reference', sa.String(length=100), nullable=False),
            sa.Column('fee_category', sa.String(length=50), server_default='APPLICATION_FEE', nullable=False),
            sa.Column('receipt_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column('issued_by_user_id', sa.String(length=64), nullable=True),
            sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['application_id'], ['admission_applications.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('tenant_id', 'receipt_number', name='uq_tenant_admission_receipt_number')
        )
        op.create_index(op.f('ix_admission_receipts_id'), 'admission_receipts', ['id'], unique=False)
        op.create_index(op.f('ix_admission_receipts_tenant_id'), 'admission_receipts', ['tenant_id'], unique=False)
        op.create_index(op.f('ix_admission_receipts_receipt_number'), 'admission_receipts', ['receipt_number'], unique=False)
        op.create_index('ix_receipts_tenant_application', 'admission_receipts', ['tenant_id', 'application_id'], unique=False)

    # 5. Enable Native PostgreSQL Row Level Security (RLS) on new tenant tables
    for tbl in ['admission_sessions', 'admission_receipts']:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation_policy ON {tbl}
            AS PERMISSIVE
            FOR ALL
            TO authenticated
            USING (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
            WITH CHECK (tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
            """
        )
        op.execute(f"GRANT ALL ON {tbl} TO authenticated;")


def downgrade() -> None:
    for tbl in ['admission_receipts', 'admission_sessions']:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

    op.drop_table('admission_receipts')
    
    with op.batch_alter_table('admission_applications') as batch_op:
        batch_op.drop_index(op.f('ix_admission_applications_session_id'))
        batch_op.drop_column('final_invoice_id')
        batch_op.drop_column('final_fee_payment_status')
        batch_op.drop_column('final_admission_fee')
        batch_op.drop_column('selection_status')
        batch_op.drop_column('entrance_exam_details')
        batch_op.drop_column('entrance_exam_score')
        batch_op.drop_column('entrance_exam_roll')
        batch_op.drop_column('admit_card_number')
        batch_op.drop_column('admission_model')
        batch_op.drop_column('session_id')

    op.drop_table('admission_sessions')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('deleted_at')

    with op.batch_alter_table('tenants') as batch_op:
        batch_op.drop_column('deleted_at')
        batch_op.drop_column('is_active')
