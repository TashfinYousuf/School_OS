"""enforce_native_postgresql_rls

Revision ID: b749d0e2e92b
Revises: 63d9333ead59
Create Date: 2026-09-11 02:00:00.000000
"""
from alembic import op

revision = 'b749d0e2e92b'
down_revision = '63d9333ead59'
branch_labels = None
depends_on = None

TABLES = [
    "students",
    "fee_payments",
    "approval_tasks",
    "attendance_events",
    "audit_logs"
]

def upgrade():
    for table in TABLES:
        # 1. Enable and Force RLS
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

        # 2. Drop existing policy if any
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_permissive_base ON {table};")

        # 3. Create canonical permissive isolation policy (fails closed if tenant context is missing)
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
            AS PERMISSIVE
            FOR ALL
            USING (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            )
            WITH CHECK (
                tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
            );
        """)

def downgrade():
    for table in TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_permissive_base ON {table};")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table};")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")