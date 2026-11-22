"""enforce_rls_for_organizations_and_tenant_tables

Revision ID: a2b3c4d5e6f7
Revises: 407a7716be83
Create Date: 2026-11-14 08:40:00.000000

"""
from typing import Sequence, Union
from alembic import op, context
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, Sequence[str], None] = '407a7716be83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations table RLS and Grant
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE organizations FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_organization_isolation_policy ON organizations;")
    op.execute("DROP POLICY IF EXISTS tenant_organization_permissive_base ON organizations;")
    op.execute(
        """
        CREATE POLICY tenant_organization_isolation_policy ON organizations
        AS PERMISSIVE
        FOR ALL
        TO authenticated
        USING (
            id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
            OR EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.organization_id = organizations.id
                  AND w.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
            )
        )
        WITH CHECK (
            id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
            OR EXISTS (
                SELECT 1 FROM workspaces w
                WHERE w.organization_id = organizations.id
                  AND w.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
            )
        );
        """
    )
    op.execute("GRANT ALL ON organizations TO authenticated;")

    # 2. Additional tenant-scoped tables missing RLS policies
    tenant_tables = [
        "campus_branches",
        "tenant_ai_budgets",
        "ai_usage_logs",
        "push_subscriptions"
    ]

    for tbl in tenant_tables:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"DROP POLICY IF EXISTS tenant_permissive_base ON {tbl};")
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
    tenant_tables = [
        "campus_branches",
        "tenant_ai_budgets",
        "ai_usage_logs",
        "push_subscriptions",
        "organizations"
    ]

    for tbl in tenant_tables:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"DROP POLICY IF EXISTS tenant_organization_isolation_policy ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")

