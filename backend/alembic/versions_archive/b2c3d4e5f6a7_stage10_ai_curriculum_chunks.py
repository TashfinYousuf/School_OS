"""stage10_ai_curriculum_chunks

Revision ID: b2c3d4e5f6a7
Revises: f6a7b8c9d0e1
Create Date: 2026-11-05 09:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'b2c3d4e5f6a7'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create curriculum_chunks table
    op.create_table(
        'curriculum_chunks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(length=64), nullable=True),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('class_name', sa.String(length=50), nullable=False),
        sa.Column('subject', sa.String(length=100), nullable=False),
        sa.Column('chapter', sa.String(length=100), nullable=True),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), server_default='0', nullable=False),
        sa.Column('is_global_curriculum', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('metadata_payload', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_curriculum_chunks_id'), 'curriculum_chunks', ['id'], unique=False)
    op.create_index(op.f('ix_curriculum_chunks_tenant_id'), 'curriculum_chunks', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_curriculum_chunks_class_name'), 'curriculum_chunks', ['class_name'], unique=False)
    op.create_index(op.f('ix_curriculum_chunks_subject'), 'curriculum_chunks', ['subject'], unique=False)
    op.create_index(op.f('ix_curriculum_chunks_is_global_curriculum'), 'curriculum_chunks', ['is_global_curriculum'], unique=False)
    op.create_index('ix_curriculum_chunks_tenant_lookup', 'curriculum_chunks', ['tenant_id', 'subject', 'class_name'], unique=False)
    op.create_index('ix_curriculum_chunks_global_lookup', 'curriculum_chunks', ['is_global_curriculum', 'subject', 'class_name'], unique=False)

    # 2. Row Level Security Policy (Global curriculum visible to all; institutional chunks tenant-isolated)
    op.execute("ALTER TABLE curriculum_chunks ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE curriculum_chunks FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'curriculum_chunks' AND policyname = 'tenant_curriculum_isolation'
            ) THEN
                CREATE POLICY tenant_curriculum_isolation ON curriculum_chunks
                AS RESTRICTIVE
                FOR ALL
                USING (
                    is_global_curriculum = true
                    OR tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                );
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_curriculum_isolation ON curriculum_chunks;")
    op.execute("ALTER TABLE curriculum_chunks NO FORCE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE curriculum_chunks DISABLE ROW LEVEL SECURITY;")

    op.drop_index('ix_curriculum_chunks_global_lookup', table_name='curriculum_chunks')
    op.drop_index('ix_curriculum_chunks_tenant_lookup', table_name='curriculum_chunks')
    op.drop_index(op.f('ix_curriculum_chunks_is_global_curriculum'), table_name='curriculum_chunks')
    op.drop_index(op.f('ix_curriculum_chunks_subject'), table_name='curriculum_chunks')
    op.drop_index(op.f('ix_curriculum_chunks_class_name'), table_name='curriculum_chunks')
    op.drop_index(op.f('ix_curriculum_chunks_tenant_id'), table_name='curriculum_chunks')
    op.drop_index(op.f('ix_curriculum_chunks_id'), table_name='curriculum_chunks')
    op.drop_table('curriculum_chunks')

