"""add_workspaces_and_schema_reconciliation

Revision ID: c1a2b3c4d5e6
Revises: b749d0e2e92b
Create Date: 2026-11-03 04:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = 'b749d0e2e92b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('institution_type', sa.String(length=50), server_default='school', nullable=True),
        sa.Column('enabled_modules', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('address', sa.String(length=255), server_default='Nazrul Avenue, Kandirpar, Cumilla-3500', nullable=True),
        sa.Column('contact_phone', sa.String(length=50), server_default='+8801971122084', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Workspaces
    op.create_table(
        'workspaces',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=True),
        sa.Column('workspace_type', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=True),
        sa.Column('enabled_modules', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'code', name='uq_workspaces_tenant_id_code')
    )
    op.create_index(op.f('ix_workspaces_id'), 'workspaces', ['id'], unique=False)
    op.create_index(op.f('ix_workspaces_tenant_id'), 'workspaces', ['tenant_id'], unique=False)

    # 3. Workspace Memberships
    op.create_table(
        'workspace_memberships',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('workspace_id', sa.UUID(), nullable=False),
        sa.Column('role', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workspace_memberships_user_id'), 'workspace_memberships', ['user_id'], unique=False)

    # 4. RLS for workspaces
    op.execute("ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE workspaces FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_permissive_base ON workspaces;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON workspaces;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON workspaces
        AS PERMISSIVE
        FOR ALL
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
        );
    """)

    # 5. Attendance Events: add idempotency_key
    op.add_column('attendance_events', sa.Column('idempotency_key', sa.String(length=128), nullable=True))
    op.create_index(op.f('ix_attendance_events_idempotency_key'), 'attendance_events', ['idempotency_key'], unique=False)

    # 6. School Profiles
    op.create_table(
        'school_profiles',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('school_name', sa.String(), server_default='Kids Shine International School', nullable=False),
        sa.Column('tagline', sa.String(), server_default='Towards a Bright Future', nullable=True),
        sa.Column('eiin_or_code', sa.String(), server_default='KS-091', nullable=True),
        sa.Column('address', sa.String(), server_default='Kandirpar, Cumilla, Bangladesh', nullable=True),
        sa.Column('contact_phone', sa.String(), server_default='+88017XXXXXXXX', nullable=True),
        sa.Column('contact_email', sa.String(), server_default='office@kidsshine.edu.bd', nullable=True),
        sa.Column('academic_year', sa.String(), server_default='2027', nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id')
    )
    op.create_index(op.f('ix_school_profiles_tenant_id'), 'school_profiles', ['tenant_id'], unique=True)

    # 7. Campus Branches
    op.create_table(
        'campus_branches',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('branch_name', sa.String(length=150), nullable=False),
        sa.Column('branch_code', sa.String(length=20), nullable=False),
        sa.Column('address', sa.String(length=255), server_default='Nazrul Avenue, Kandirpar, Cumilla-3500', nullable=True),
        sa.Column('phone', sa.String(length=50), server_default='+8801971122084', nullable=True),
        sa.Column('is_main_branch', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_campus_branches_tenant_id'), 'campus_branches', ['tenant_id'], unique=False)

    # 8. Academic Programs
    op.create_table(
        'academic_programs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('name', sa.String(length=150), nullable=False),
        sa.Column('target_exam', sa.String(length=100), nullable=False),
        sa.Column('course_fee', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('duration_months', sa.Integer(), server_default='6', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_academic_programs_id'), 'academic_programs', ['id'], unique=False)
    op.create_index(op.f('ix_academic_programs_tenant_id'), 'academic_programs', ['tenant_id'], unique=False)

    # 9. Academy Batches
    op.create_table(
        'academy_batches',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('program_id', sa.UUID(), nullable=False),
        sa.Column('batch_name', sa.String(length=100), nullable=False),
        sa.Column('shift_time', sa.String(length=50), nullable=False),
        sa.Column('days_schedule', sa.String(length=100), nullable=False),
        sa.Column('max_seat_capacity', sa.Integer(), server_default='60', nullable=True),
        sa.Column('enrolled_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('classroom_number', sa.String(length=50), server_default='Lecture Hall 1', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['program_id'], ['academic_programs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_academy_batches_id'), 'academy_batches', ['id'], unique=False)
    op.create_index(op.f('ix_academy_batches_tenant_id'), 'academy_batches', ['tenant_id'], unique=False)

    # 10. Batch Enrollments
    op.create_table(
        'batch_enrollments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=False),
        sa.Column('enrollment_roll', sa.String(length=50), nullable=True),
        sa.Column('payment_status', sa.String(length=30), server_default='PAID', nullable=True),
        sa.Column('enrolled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['batch_id'], ['academy_batches.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_batch_enrollments_tenant_id'), 'batch_enrollments', ['tenant_id'], unique=False)

    # 11. Class Routines
    op.create_table(
        'class_routines',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('class_name', sa.String(), nullable=False),
        sa.Column('day_of_week', sa.String(), nullable=False),
        sa.Column('period_number', sa.String(), nullable=False),
        sa.Column('start_time', sa.String(), nullable=False),
        sa.Column('end_time', sa.String(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('teacher_name', sa.String(), nullable=False),
        sa.Column('room_number', sa.String(), server_default='Room 101', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_class_routines_class_name'), 'class_routines', ['class_name'], unique=False)
    op.create_index(op.f('ix_class_routines_day_of_week'), 'class_routines', ['day_of_week'], unique=False)
    op.create_index(op.f('ix_class_routines_tenant_id'), 'class_routines', ['tenant_id'], unique=False)

    # 12. Live Exams
    op.create_table(
        'live_exams',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('program_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('total_marks', sa.Float(), server_default='25.0', nullable=True),
        sa.Column('duration_minutes', sa.Integer(), server_default='30', nullable=True),
        sa.Column('negative_marking_rate', sa.Float(), server_default='0.25', nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_published', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('questions_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['program_id'], ['academic_programs.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_live_exams_id'), 'live_exams', ['id'], unique=False)
    op.create_index(op.f('ix_live_exams_tenant_id'), 'live_exams', ['tenant_id'], unique=False)

    # 13. Exam Submissions
    op.create_table(
        'exam_submissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('exam_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('correct_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('wrong_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('unattempted_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('obtained_score', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('accuracy_percentage', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('assigned_rank', sa.Integer(), nullable=True),
        sa.Column('student_answers', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['exam_id'], ['live_exams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('exam_id', 'student_id', name='uq_one_attempt')
    )
    op.create_index(op.f('ix_exam_submissions_tenant_id'), 'exam_submissions', ['tenant_id'], unique=False)

    # 14. Tenant AI Budgets
    op.create_table(
        'tenant_ai_budgets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('monthly_token_limit', sa.BigInteger(), server_default='2000000', nullable=False),
        sa.Column('used_tokens_current_cycle', sa.BigInteger(), server_default='0', nullable=False),
        sa.Column('monthly_budget_usd', sa.Integer(), server_default='25', nullable=False),
        sa.Column('is_hard_locked', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('billing_cycle_start', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id')
    )
    op.create_index(op.f('ix_tenant_ai_budgets_tenant_id'), 'tenant_ai_budgets', ['tenant_id'], unique=True)

    # 15. AI Usage Logs
    op.create_table(
        'ai_usage_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('model_name', sa.String(), server_default='gemini-2.5-flash', nullable=False),
        sa.Column('feature', sa.String(), nullable=False),
        sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_usage_logs_created_at'), 'ai_usage_logs', ['created_at'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_feature'), 'ai_usage_logs', ['feature'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_tenant_id'), 'ai_usage_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_ai_usage_logs_user_id'), 'ai_usage_logs', ['user_id'], unique=False)

    # 16. Push Subscriptions
    op.create_table(
        'push_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=False),
        sa.Column('role', sa.String(length=30), server_default='teacher', nullable=True),
        sa.Column('subscription_data', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_push_subscriptions_tenant_id'), 'push_subscriptions', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_push_subscriptions_user_id'), 'push_subscriptions', ['user_id'], unique=False)

    # 17. Institution Subscriptions
    op.create_table(
        'institution_subscriptions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('plan_tier', sa.String(length=50), server_default='growth', nullable=False),
        sa.Column('workspace_scope', sa.String(length=50), server_default='unified', nullable=True),
        sa.Column('monthly_fee', sa.Float(), server_default='2490.0', nullable=True),
        sa.Column('billing_cycle', sa.String(length=20), server_default='monthly', nullable=True),
        sa.Column('ai_question_quota_monthly', sa.Integer(), server_default='100', nullable=True),
        sa.Column('ai_questions_used_this_month', sa.Integer(), server_default='0', nullable=True),
        sa.Column('max_active_students', sa.Integer(), server_default='500', nullable=True),
        sa.Column('subscription_status', sa.String(length=30), server_default='ACTIVE', nullable=True),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id')
    )
    op.create_index(op.f('ix_institution_subscriptions_tenant_id'), 'institution_subscriptions', ['tenant_id'], unique=True)

    # 18. Subscription Payments
    op.create_table(
        'subscription_payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('payment_reference', sa.String(length=64), nullable=False),
        sa.Column('plan_key', sa.String(length=64), nullable=False),
        sa.Column('billing_cycle', sa.String(length=16), nullable=False),
        sa.Column('gateway', sa.String(length=32), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(length=16), server_default='PENDING', nullable=False),
        sa.Column('transaction_id', sa.String(length=128), nullable=True),
        sa.Column('created_by', sa.String(length=64), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_reference')
    )
    op.create_index(op.f('ix_subscription_payments_payment_reference'), 'subscription_payments', ['payment_reference'], unique=True)
    op.create_index(op.f('ix_subscription_payments_tenant_id'), 'subscription_payments', ['tenant_id'], unique=False)
    op.create_index('uq_sub_payment_trx', 'subscription_payments', ['gateway', 'transaction_id'], unique=True, postgresql_where=sa.text('transaction_id IS NOT NULL'))

    # 19. Extended columns for ApprovalTask
    op.add_column('approval_tasks', sa.Column('task_type', sa.String(length=100), nullable=True))
    op.add_column('approval_tasks', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('approval_tasks', sa.Column('requested_by_user_id', sa.String(length=64), nullable=True))
    op.add_column('approval_tasks', sa.Column('reviewed_by_user_id', sa.String(length=64), nullable=True))
    op.add_column('approval_tasks', sa.Column('review_notes', sa.Text(), nullable=True))
    op.add_column('approval_tasks', sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('approval_tasks', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True))


def downgrade() -> None:
    op.drop_column('approval_tasks', 'updated_at')
    op.drop_column('approval_tasks', 'payload')
    op.drop_column('approval_tasks', 'review_notes')
    op.drop_column('approval_tasks', 'reviewed_by_user_id')
    op.drop_column('approval_tasks', 'requested_by_user_id')
    op.drop_column('approval_tasks', 'description')
    op.drop_column('approval_tasks', 'task_type')

    op.drop_index('uq_sub_payment_trx', table_name='subscription_payments', postgresql_where=sa.text('transaction_id IS NOT NULL'))
    op.drop_index(op.f('ix_subscription_payments_tenant_id'), table_name='subscription_payments')
    op.drop_index(op.f('ix_subscription_payments_payment_reference'), table_name='subscription_payments')
    op.drop_table('subscription_payments')

    op.drop_index(op.f('ix_institution_subscriptions_tenant_id'), table_name='institution_subscriptions')
    op.drop_table('institution_subscriptions')

    op.drop_index(op.f('ix_push_subscriptions_user_id'), table_name='push_subscriptions')
    op.drop_index(op.f('ix_push_subscriptions_tenant_id'), table_name='push_subscriptions')
    op.drop_table('push_subscriptions')

    op.drop_index(op.f('ix_ai_usage_logs_user_id'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_tenant_id'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_feature'), table_name='ai_usage_logs')
    op.drop_index(op.f('ix_ai_usage_logs_created_at'), table_name='ai_usage_logs')
    op.drop_table('ai_usage_logs')

    op.drop_index(op.f('ix_tenant_ai_budgets_tenant_id'), table_name='tenant_ai_budgets')
    op.drop_table('tenant_ai_budgets')

    op.drop_index(op.f('ix_exam_submissions_tenant_id'), table_name='exam_submissions')
    op.drop_table('exam_submissions')

    op.drop_index(op.f('ix_live_exams_tenant_id'), table_name='live_exams')
    op.drop_index(op.f('ix_live_exams_id'), table_name='live_exams')
    op.drop_table('live_exams')

    op.drop_index(op.f('ix_class_routines_tenant_id'), table_name='class_routines')
    op.drop_index(op.f('ix_class_routines_day_of_week'), table_name='class_routines')
    op.drop_index(op.f('ix_class_routines_class_name'), table_name='class_routines')
    op.drop_table('class_routines')

    op.drop_index(op.f('ix_batch_enrollments_tenant_id'), table_name='batch_enrollments')
    op.drop_table('batch_enrollments')

    op.drop_index(op.f('ix_academy_batches_tenant_id'), table_name='academy_batches')
    op.drop_index(op.f('ix_academy_batches_id'), table_name='academy_batches')
    op.drop_table('academy_batches')

    op.drop_index(op.f('ix_academic_programs_tenant_id'), table_name='academic_programs')
    op.drop_index(op.f('ix_academic_programs_id'), table_name='academic_programs')
    op.drop_table('academic_programs')

    op.drop_index(op.f('ix_campus_branches_tenant_id'), table_name='campus_branches')
    op.drop_table('campus_branches')

    op.drop_index(op.f('ix_school_profiles_tenant_id'), table_name='school_profiles')
    op.drop_table('school_profiles')

    op.drop_index(op.f('ix_attendance_events_idempotency_key'), table_name='attendance_events')
    op.drop_column('attendance_events', 'idempotency_key')

    op.execute("DROP POLICY IF EXISTS tenant_permissive_base ON workspaces;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON workspaces;")
    op.execute("ALTER TABLE workspaces NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_workspace_memberships_user_id'), table_name='workspace_memberships')
    op.drop_table('workspace_memberships')

    op.drop_index(op.f('ix_workspaces_tenant_id'), table_name='workspaces')
    op.drop_index(op.f('ix_workspaces_id'), table_name='workspaces')
    op.drop_table('workspaces')

    op.drop_table('organizations')

