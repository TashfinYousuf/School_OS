"""fix_rls_permissive_policies

Revision ID: c4d5e6f7a8b9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-08 05:30:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None

BILLING_TABLES = [
    'billing_invoices',
    'tenant_entitlements',
    'billing_audit_logs',
]

def upgrade() -> None:
    # 1. Add PERMISSIVE policy on curriculum_chunks
    # PostgreSQL RLS semantics require at least one PERMISSIVE policy to evaluate to true
    # before RESTRICTIVE policies are applied. Without a PERMISSIVE policy, all queries fail-closed (0 rows).
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE tablename = 'curriculum_chunks' AND policyname = 'tenant_curriculum_permissive_base'
            ) THEN
                CREATE POLICY tenant_curriculum_permissive_base ON curriculum_chunks
                AS PERMISSIVE
                FOR ALL
                USING (
                    is_global_curriculum = true
                    OR tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                )
                WITH CHECK (
                    tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                );
            END IF;
        END $$;
        """
    )

    # 2. Add PERMISSIVE base policies on tenant-scoped billing tables
    for tbl in BILLING_TABLES:
        op.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE tablename = '{tbl}' AND policyname = 'tenant_{tbl}_permissive_base'
                ) THEN
                    CREATE POLICY tenant_{tbl}_permissive_base ON {tbl}
                    AS PERMISSIVE
                    FOR ALL
                    USING (
                        tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                    )
                    WITH CHECK (
                        tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                    );
                END IF;
            END $$;
            """
        )

def downgrade() -> None:
    for tbl in BILLING_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_{tbl}_permissive_base ON {tbl};")

    op.execute("DROP POLICY IF EXISTS tenant_curriculum_permissive_base ON curriculum_chunks;")

