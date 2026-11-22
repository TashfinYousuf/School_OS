"""stage09_institution_operations

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-05 08:30:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Admission Applications Table
    op.create_table(
        'admission_applications',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('application_number', sa.String(length=64), nullable=False),
        sa.Column('status', sa.String(length=32), server_default='DRAFT', nullable=False),
        sa.Column('academic_year', sa.String(length=20), server_default='2026', nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('gender', sa.String(length=20), server_default='Male', nullable=False),
        sa.Column('blood_group', sa.String(length=10), nullable=True),
        sa.Column('previous_school', sa.String(length=150), nullable=True),
        sa.Column('guardian_name', sa.String(length=150), nullable=False),
        sa.Column('guardian_relationship', sa.String(length=50), server_default='Father', nullable=False),
        sa.Column('guardian_phone', sa.String(length=50), nullable=False),
        sa.Column('guardian_email', sa.String(length=100), nullable=True),
        sa.Column('guardian_nid', sa.String(length=50), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('review_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by_user_id', sa.String(length=64), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enrolled_student_id', sa.UUID(), nullable=True),
        sa.Column('application_fee', sa.Numeric(precision=12, scale=2), server_default='0.00', nullable=False),
        sa.Column('payment_status', sa.String(length=32), server_default='PENDING', nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=True),
        sa.Column('documents_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['enrolled_student_id'], ['students.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'application_number', name='uq_tenant_admission_number')
    )
    op.create_index(op.f('ix_admission_applications_id'), 'admission_applications', ['id'], unique=False)
    op.create_index(op.f('ix_admission_applications_tenant_id'), 'admission_applications', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_admission_applications_application_number'), 'admission_applications', ['application_number'], unique=False)
    op.create_index(op.f('ix_admission_applications_class_name'), 'admission_applications', ['class_name'], unique=False)
    op.create_index('ix_admissions_tenant_status', 'admission_applications', ['tenant_id', 'status'], unique=False)
    op.create_index('ix_admissions_tenant_phone', 'admission_applications', ['tenant_id', 'guardian_phone'], unique=False)

    # 2. Notice Acknowledgements Table
    op.create_table(
        'notice_acknowledgements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('notice_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['notice_id'], ['notices.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'notice_id', 'user_id', name='uq_notice_ack_user')
    )
    op.create_index(op.f('ix_notice_acknowledgements_id'), 'notice_acknowledgements', ['id'], unique=False)
    op.create_index(op.f('ix_notice_acknowledgements_tenant_id'), 'notice_acknowledgements', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_notice_acknowledgements_notice_id'), 'notice_acknowledgements', ['notice_id'], unique=False)
    op.create_index(op.f('ix_notice_acknowledgements_user_id'), 'notice_acknowledgements', ['user_id'], unique=False)

    # 3. Add Columns to Exams
    op.add_column('exams', sa.Column('status', sa.String(length=32), server_default='SCHEDULED', nullable=False))
    op.add_column('exams', sa.Column('academic_year', sa.String(length=20), server_default='2026', nullable=False))
    op.add_column('exams', sa.Column('class_name', sa.String(length=50), nullable=True))
    op.add_column('exams', sa.Column('subject', sa.String(length=100), server_default='General', nullable=False))
    op.add_column('exams', sa.Column('max_marks', sa.Float(), server_default='100.0', nullable=False))
    op.add_column('exams', sa.Column('pass_marks', sa.Float(), server_default='33.0', nullable=False))
    op.add_column('exams', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('exams', sa.Column('end_date', sa.Date(), nullable=True))
    op.add_column('exams', sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))
    op.create_index(op.f('ix_exams_status'), 'exams', ['status'], unique=False)
    op.create_index(op.f('ix_exams_class_name'), 'exams', ['class_name'], unique=False)

    # 4. Add Columns to Student Results
    op.add_column('student_results', sa.Column('is_published', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('student_results', sa.Column('grading_policy_version', sa.String(length=50), server_default='nctb_v2026', nullable=False))
    op.add_column('student_results', sa.Column('published_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f('ix_student_results_is_published'), 'student_results', ['is_published'], unique=False)

    # 5. Add Columns to Notices
    op.add_column('notices', sa.Column('content', sa.Text(), nullable=True))
    op.add_column('notices', sa.Column('target_audience', sa.String(length=50), server_default='ALL', nullable=False))
    op.add_column('notices', sa.Column('target_class', sa.String(length=50), nullable=True))
    op.add_column('notices', sa.Column('is_published', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('notices', sa.Column('expiry_date', sa.Date(), nullable=True))
    op.add_column('notices', sa.Column('created_by_user_id', sa.UUID(), nullable=True))
    op.add_column('notices', sa.Column('published_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))

    # 6. RLS Policies for New Tables (using audited tenant_id::text comparison)
    op.execute("ALTER TABLE admission_applications ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE admission_applications FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON admission_applications;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON admission_applications
        AS PERMISSIVE
        FOR ALL
        USING (
            tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    """)

    op.execute("ALTER TABLE notice_acknowledgements ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE notice_acknowledgements FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON notice_acknowledgements;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON notice_acknowledgements
        AS PERMISSIVE
        FOR ALL
        USING (
            tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON notice_acknowledgements;")
    op.execute("ALTER TABLE notice_acknowledgements NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE notice_acknowledgements DISABLE ROW LEVEL SECURITY;")

    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON admission_applications;")
    op.execute("ALTER TABLE admission_applications NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE admission_applications DISABLE ROW LEVEL SECURITY;")

    op.drop_column('notices', 'published_at')
    op.drop_column('notices', 'created_by_user_id')
    op.drop_column('notices', 'expiry_date')
    op.drop_column('notices', 'is_published')
    op.drop_column('notices', 'target_class')
    op.drop_column('notices', 'target_audience')
    op.drop_column('notices', 'content')

    op.drop_index(op.f('ix_student_results_is_published'), table_name='student_results')
    op.drop_column('student_results', 'published_at')
    op.drop_column('student_results', 'grading_policy_version')
    op.drop_column('student_results', 'is_published')

    op.drop_index(op.f('ix_exams_class_name'), table_name='exams')
    op.drop_index(op.f('ix_exams_status'), table_name='exams')
    op.drop_column('exams', 'created_at')
    op.drop_column('exams', 'end_date')
    op.drop_column('exams', 'start_date')
    op.drop_column('exams', 'pass_marks')
    op.drop_column('exams', 'max_marks')
    op.drop_column('exams', 'subject')
    op.drop_column('exams', 'class_name')
    op.drop_column('exams', 'academic_year')
    op.drop_column('exams', 'status')

    op.drop_index(op.f('ix_notice_acknowledgements_user_id'), table_name='notice_acknowledgements')
    op.drop_index(op.f('ix_notice_acknowledgements_notice_id'), table_name='notice_acknowledgements')
    op.drop_index(op.f('ix_notice_acknowledgements_tenant_id'), table_name='notice_acknowledgements')
    op.drop_index(op.f('ix_notice_acknowledgements_id'), table_name='notice_acknowledgements')
    op.drop_table('notice_acknowledgements')

    op.drop_index('ix_admissions_tenant_phone', table_name='admission_applications')
    op.drop_index('ix_admissions_tenant_status', table_name='admission_applications')
    op.drop_index(op.f('ix_admission_applications_class_name'), table_name='admission_applications')
    op.drop_index(op.f('ix_admission_applications_application_number'), table_name='admission_applications')
    op.drop_index(op.f('ix_admission_applications_tenant_id'), table_name='admission_applications')
    op.drop_index(op.f('ix_admission_applications_id'), table_name='admission_applications')
    op.drop_table('admission_applications')

