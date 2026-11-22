"""add_ai_learning_studio_conversations_and_messages

Revision ID: 04834912199b
Revises: a2b3c4d5e6f7
Create Date: 2026-11-15 04:19:59.918768

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '04834912199b'
down_revision: Union[str, Sequence[str], None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create ai_conversations table
    op.create_table(
        'ai_conversations',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.String(length=64), nullable=True),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('topic', sa.String(length=150), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('mode', sa.String(length=32), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_conversations_id'), 'ai_conversations', ['id'], unique=False)
    op.create_index(op.f('ix_ai_conversations_student_id'), 'ai_conversations', ['student_id'], unique=False)
    op.create_index(op.f('ix_ai_conversations_tenant_id'), 'ai_conversations', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_ai_conversations_user_id'), 'ai_conversations', ['user_id'], unique=False)

    # 2. Create ai_messages table
    op.create_table(
        'ai_messages',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('conversation_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=False),
        sa.Column('sender_role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('tokens_used', sa.Integer(), nullable=False),
        sa.Column('attachment_url', sa.String(length=500), nullable=True),
        sa.Column('attachment_type', sa.String(length=50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['ai_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ai_messages_conversation_id'), 'ai_messages', ['conversation_id'], unique=False)
    op.create_index(op.f('ix_ai_messages_id'), 'ai_messages', ['id'], unique=False)
    op.create_index(op.f('ix_ai_messages_tenant_id'), 'ai_messages', ['tenant_id'], unique=False)

    # 3. Enable Native PostgreSQL Row Level Security (RLS) on both tables
    for tbl in ['ai_conversations', 'ai_messages']:
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
    for tbl in ['ai_messages', 'ai_conversations']:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

    op.drop_index(op.f('ix_ai_messages_tenant_id'), table_name='ai_messages')
    op.drop_index(op.f('ix_ai_messages_id'), table_name='ai_messages')
    op.drop_index(op.f('ix_ai_messages_conversation_id'), table_name='ai_messages')
    op.drop_table('ai_messages')

    op.drop_index(op.f('ix_ai_conversations_user_id'), table_name='ai_conversations')
    op.drop_index(op.f('ix_ai_conversations_tenant_id'), table_name='ai_conversations')
    op.drop_index(op.f('ix_ai_conversations_student_id'), table_name='ai_conversations')
    op.drop_index(op.f('ix_ai_conversations_id'), table_name='ai_conversations')
    op.drop_table('ai_conversations')
