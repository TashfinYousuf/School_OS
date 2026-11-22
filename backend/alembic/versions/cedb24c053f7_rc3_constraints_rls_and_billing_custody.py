"""rc3_constraints_rls_and_billing_custody

Revision ID: cedb24c053f7
Revises: d5e6f7a8b9c0
Create Date: 2026-11-12 03:43:18.796269
"""
from typing import Sequence, Union

from alembic import op, context
import sqlalchemy as sa

revision: str = "cedb24c053f7"
down_revision: Union[str, Sequence[str], None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RESTRICTIVE_MISSING_PERMISSIVE_TABLES = [
    "approval_tasks",
    "attendance_events",
    "audit_logs",
    "fee_payments",
]

TENANT_SCOPED_TABLES_TO_PROTECT = [
    "academic_programs",
    "academic_sessions",
    "academy_batches",
    "batch_enrollments",
    "class_routines",
    "classes",
    "daily_lesson_logs",
    "exam_results",
    "exam_submissions",
    "exams",
    "grade_levels",
    "guardian_students",
    "guardians",
    "institution_subscriptions",
    "live_exams",
    "messages",
    "notices",
    "question_papers",
    "refresh_token_sessions",
    "roles",
    "school_profiles",
    "student_guardians",
    "student_results",
    "subjects",
    "subscription_payments",
    "teachers",
    "users",
    "workspaces",
]


def _create_permissive_tenant_policy(table_name: str, policy_name: str = "tenant_isolation_policy") -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = '{table_name}'
                  AND policyname = '{policy_name}'
            ) THEN
                CREATE POLICY {policy_name} ON {table_name}
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


def upgrade() -> None:
    conn = op.get_bind()
    existing_tables = set()
    existing_cols = {}
    existing_indexes = {}
    existing_uqs = {}

    if not context.is_offline_mode():
        insp = sa.inspect(conn)
        existing_tables = set(insp.get_table_names())
        for tbl in ("subscription_payments", "users", "guardians", "student_guardians", "guardian_students"):
            if tbl in existing_tables:
                existing_cols[tbl] = {c["name"] for c in insp.get_columns(tbl)}
                existing_indexes[tbl] = {ix["name"] for ix in insp.get_indexes(tbl)}
                existing_uqs[tbl] = {uq["name"] for uq in insp.get_unique_constraints(tbl)}

    # 1. Dual-custody & review tracking columns on subscription_payments (nullable additive)
    if "subscription_payments" in existing_tables:
        sp_cols = existing_cols.get("subscription_payments", set())
        for col_name, col_type in (
            ("submitted_by", sa.String(64)),
            ("submitted_at", sa.DateTime(timezone=True)),
            ("reviewed_by", sa.String(64)),
            ("reviewed_at", sa.DateTime(timezone=True)),
            ("review_notes", sa.String(255)),
        ):
            if col_name not in sp_cols:
                op.add_column("subscription_payments", sa.Column(col_name, col_type, nullable=True))

    # 2. Partial unique indexes & pair uniqueness (safe zero-collision check already verified)
    if "users" in existing_tables:
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_username_active
            ON users (tenant_id, lower(username))
            WHERE username IS NOT NULL AND trim(username) <> '';
            """
        )
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_phone
            ON users (tenant_id, phone_number)
            WHERE phone_number IS NOT NULL AND trim(phone_number) <> '';
            """
        )

    if "guardians" in existing_tables:
        op.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_guardians_tenant_phone
            ON guardians (tenant_id, phone_number)
            WHERE phone_number IS NOT NULL AND trim(phone_number) <> '' AND phone_number <> 'N/A';
            """
        )

    if "student_guardians" in existing_tables:
        if "uq_student_guardian_pair" not in existing_uqs.get("student_guardians", set()):
            op.create_unique_constraint(
                "uq_student_guardian_pair",
                "student_guardians",
                ["tenant_id", "guardian_id", "student_id"],
            )

    # 3. Non-destructive relationship backfill from legacy guardian_students -> student_guardians
    if "guardian_students" in existing_tables and "student_guardians" in existing_tables:
        op.execute(
            """
            INSERT INTO student_guardians (
                id,
                tenant_id,
                guardian_id,
                student_id,
                relationship_type,
                is_primary,
                is_primary_contact,
                verification_status,
                verification_method,
                verified_at
            )
            SELECT
                gen_random_uuid(),
                gs.tenant_id::uuid,
                gs.guardian_id,
                gs.student_id,
                COALESCE(gs.relationship_type, 'FATHER'),
                true,
                true,
                'VERIFIED',
                'LEGACY_BACKFILL',
                now()
            FROM guardian_students gs
            WHERE gs.tenant_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM student_guardians sg
                  WHERE sg.tenant_id = gs.tenant_id::uuid
                    AND sg.guardian_id = gs.guardian_id
                    AND sg.student_id = gs.student_id
              )
            ON CONFLICT DO NOTHING;
            """
        )

    # 4. PostgreSQL RLS Hardening
    # 4a. Tables with RESTRICTIVE policies lacking a companion AS PERMISSIVE policy
    for tbl in RESTRICTIVE_MISSING_PERMISSIVE_TABLES:
        if tbl in existing_tables or context.is_offline_mode():
            op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
            _create_permissive_tenant_policy(tbl, f"tenant_{tbl}_permissive_base")

    # 4b. Uncovered tenant_id tables
    for tbl in TENANT_SCOPED_TABLES_TO_PROTECT:
        if tbl in existing_tables or context.is_offline_mode():
            op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
            _create_permissive_tenant_policy(tbl, "tenant_isolation_policy")

    # 4c. Special relational / global / system tables accessed under ROLE authenticated
    if "billing_invoice_line_items" in existing_tables or context.is_offline_mode():
        op.execute("ALTER TABLE billing_invoice_line_items ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE billing_invoice_line_items FORCE ROW LEVEL SECURITY;")
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public'
                      AND tablename = 'billing_invoice_line_items'
                      AND policyname = 'tenant_isolation_policy'
                ) THEN
                    CREATE POLICY tenant_isolation_policy ON billing_invoice_line_items
                    AS PERMISSIVE
                    FOR ALL
                    USING (
                        EXISTS (
                            SELECT 1 FROM billing_invoices bi
                            WHERE bi.id = billing_invoice_id
                              AND bi.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                        )
                    )
                    WITH CHECK (
                        EXISTS (
                            SELECT 1 FROM billing_invoices bi
                            WHERE bi.id = billing_invoice_id
                              AND bi.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                        )
                    );
                END IF;
            END $$;
            """
        )

    if "tenants" in existing_tables or context.is_offline_mode():
        op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY;")
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'tenants' AND policyname = 'tenant_self_isolation_policy'
                ) THEN
                    CREATE POLICY tenant_self_isolation_policy ON tenants
                    AS PERMISSIVE
                    FOR ALL
                    USING (id::text = NULLIF(current_setting('app.current_tenant_id', true), ''))
                    WITH CHECK (id::text = NULLIF(current_setting('app.current_tenant_id', true), ''));
                END IF;
            END $$;
            """
        )

    if "workspace_memberships" in existing_tables or context.is_offline_mode():
        op.execute("ALTER TABLE workspace_memberships ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE workspace_memberships FORCE ROW LEVEL SECURITY;")
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'workspace_memberships' AND policyname = 'tenant_workspace_membership_policy'
                ) THEN
                    CREATE POLICY tenant_workspace_membership_policy ON workspace_memberships
                    AS PERMISSIVE
                    FOR ALL
                    USING (
                        EXISTS (
                            SELECT 1 FROM workspaces w
                            WHERE w.id = workspace_id
                              AND w.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                        )
                    )
                    WITH CHECK (
                        EXISTS (
                            SELECT 1 FROM workspaces w
                            WHERE w.id = workspace_id
                              AND w.tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
                        )
                    );
                END IF;
            END $$;
            """
        )

    for catalog_tbl in ("subscription_plans", "plan_versions"):
        if catalog_tbl in existing_tables or context.is_offline_mode():
            op.execute(f"ALTER TABLE {catalog_tbl} ENABLE ROW LEVEL SECURITY;")
            op.execute(f"ALTER TABLE {catalog_tbl} FORCE ROW LEVEL SECURITY;")
            op.execute(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_policies
                        WHERE schemaname = 'public' AND tablename = '{catalog_tbl}' AND policyname = 'catalog_public_read_policy'
                    ) THEN
                        CREATE POLICY catalog_public_read_policy ON {catalog_tbl}
                        AS PERMISSIVE
                        FOR SELECT
                        USING (true);
                    END IF;
                END $$;
                """
            )

    if "revoked_token_records" in existing_tables or context.is_offline_mode():
        op.execute("ALTER TABLE revoked_token_records ENABLE ROW LEVEL SECURITY;")
        op.execute("ALTER TABLE revoked_token_records FORCE ROW LEVEL SECURITY;")
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_policies
                    WHERE schemaname = 'public' AND tablename = 'revoked_token_records' AND policyname = 'revoked_tokens_rw_policy'
                ) THEN
                    CREATE POLICY revoked_tokens_rw_policy ON revoked_token_records
                    AS PERMISSIVE
                    FOR ALL
                    USING (true)
                    WITH CHECK (true);
                END IF;
            END $$;
            """
        )

    # Ensure authenticated role can access public tables & sequences subject to RLS
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
                GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS revoked_tokens_rw_policy ON revoked_token_records;")
    op.execute("DROP POLICY IF EXISTS catalog_public_read_policy ON plan_versions;")
    op.execute("DROP POLICY IF EXISTS catalog_public_read_policy ON subscription_plans;")
    op.execute("DROP POLICY IF EXISTS tenant_workspace_membership_policy ON workspace_memberships;")
    op.execute("DROP POLICY IF EXISTS tenant_self_isolation_policy ON tenants;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON billing_invoice_line_items;")
    for tbl in TENANT_SCOPED_TABLES_TO_PROTECT:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
    for tbl in RESTRICTIVE_MISSING_PERMISSIVE_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_{tbl}_permissive_base ON {tbl};")

    op.drop_constraint("uq_student_guardian_pair", "student_guardians", type_="unique")
    op.execute("DROP INDEX IF EXISTS uq_guardians_tenant_phone;")
    op.execute("DROP INDEX IF EXISTS uq_users_tenant_phone;")
    op.execute("DROP INDEX IF EXISTS uq_users_tenant_username_active;")

    for col_name in ("review_notes", "reviewed_at", "reviewed_by", "submitted_at", "submitted_by"):
        op.drop_column("subscription_payments", col_name)
