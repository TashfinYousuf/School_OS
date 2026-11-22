"""student_guardian_iam_and_learning_studio

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-11-11 05:30:00.000000
"""
from alembic import op, context
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    existing_tables = set()
    existing_columns = {}
    
    if not context.is_offline_mode():
        insp = sa.inspect(conn)
        existing_tables = set(insp.get_table_names())
        for tbl in ['users', 'student_guardians']:
            if tbl in existing_tables:
                existing_columns[tbl] = {c['name'] for c in insp.get_columns(tbl)}

    # 1. Additive columns on users table
    if 'users' in existing_tables:
        cols = existing_columns.get('users', set())
        if 'username' not in cols:
            op.add_column('users', sa.Column('username', sa.String(100), nullable=True))
            op.create_index('ix_users_username', 'users', ['tenant_id', 'username'])
        if 'phone_number' not in cols:
            op.add_column('users', sa.Column('phone_number', sa.String(32), nullable=True))
            op.create_index('ix_users_phone', 'users', ['tenant_id', 'phone_number'])
        if 'must_change_password' not in cols:
            op.add_column('users', sa.Column('must_change_password', sa.Boolean(), server_default='false', nullable=False))

    # 2. Additive columns on student_guardians table
    if 'student_guardians' in existing_tables:
        cols = existing_columns.get('student_guardians', set())
        if 'verification_status' not in cols:
            op.add_column('student_guardians', sa.Column('verification_status', sa.String(32), server_default='VERIFIED', nullable=False))
        if 'verification_method' not in cols:
            op.add_column('student_guardians', sa.Column('verification_method', sa.String(64), server_default='ADMISSION_RECORD', nullable=True))
        if 'verified_at' not in cols:
            op.add_column('student_guardians', sa.Column('verified_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True))
        if 'verified_by' not in cols:
            op.add_column('student_guardians', sa.Column('verified_by', sa.String(64), nullable=True))
        if 'revoked_at' not in cols:
            op.add_column('student_guardians', sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True))

    # 3. Create account_invitations table
    if 'account_invitations' not in existing_tables:
        op.create_table(
            'account_invitations',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('tenant_id', sa.String(64), nullable=False, index=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
            sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
            sa.Column('guardian_id', postgresql.UUID(as_uuid=True), nullable=True, index=True),
            sa.Column('target_role', sa.String(32), server_default='student', nullable=False),
            sa.Column('identifier', sa.String(120), nullable=True),
            sa.Column('token_hash', sa.String(64), unique=True, nullable=False, index=True),
            sa.Column('is_consumed', sa.Boolean(), server_default='false', nullable=False, index=True),
            sa.Column('consumed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False, index=True),
            sa.Column('created_by_user_id', sa.String(64), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 4. Create Learning Studio tables: study_sessions, study_flashcards, practice_attempts
    if 'study_sessions' not in existing_tables:
        op.create_table(
            'study_sessions',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('tenant_id', sa.String(64), nullable=False, index=True),
            sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('subject', sa.String(100), nullable=False),
            sa.Column('topic', sa.String(150), nullable=True),
            sa.Column('mode', sa.String(32), server_default='study_room', nullable=False),
            sa.Column('duration_seconds', sa.Integer(), server_default='0', nullable=False),
            sa.Column('goals', sa.Text(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'study_flashcards' not in existing_tables:
        op.create_table(
            'study_flashcards',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('tenant_id', sa.String(64), nullable=False, index=True),
            sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('subject', sa.String(100), nullable=False),
            sa.Column('topic', sa.String(150), nullable=True),
            sa.Column('front_text', sa.Text(), nullable=False),
            sa.Column('back_text', sa.Text(), nullable=False),
            sa.Column('mastery_level', sa.Integer(), server_default='0', nullable=False),
            sa.Column('review_due_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    if 'practice_attempts' not in existing_tables:
        op.create_table(
            'practice_attempts',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
            sa.Column('tenant_id', sa.String(64), nullable=False, index=True),
            sa.Column('student_id', postgresql.UUID(as_uuid=True), nullable=False, index=True),
            sa.Column('subject', sa.String(100), nullable=False),
            sa.Column('topic', sa.String(150), nullable=True),
            sa.Column('question_type', sa.String(32), server_default='mcq', nullable=False),
            sa.Column('question_data', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
            sa.Column('student_answer', sa.Text(), nullable=True),
            sa.Column('is_correct', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('score', sa.Numeric(5, 2), server_default='0.0', nullable=False),
            sa.Column('feedback', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # 5. Enable Row Level Security (RLS) on new tables
    rls_tables = ['account_invitations', 'study_sessions', 'study_flashcards', 'practice_attempts']
    for tbl in rls_tables:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"DROP POLICY IF EXISTS tenant_permissive_base ON {tbl};")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {tbl}
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
    pass

