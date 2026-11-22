import pytest
import os
import sys
import subprocess
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import alembic.config
import alembic.script
from app.models import Base
from app.models.workspace import Workspace, Organization, WorkspaceMembership
from app.models.attendance import AttendanceEvent
from app.models.approval import ApprovalTask
from app.models.guardian import GuardianStudentLink
from app.models.tenant import User, Tenant, Role, SchoolProfile


def test_alembic_dag_single_head():
    """Verify that Alembic has exactly one head revision."""
    config = alembic.config.Config(str(backend_dir / "alembic.ini"))
    script = alembic.script.ScriptDirectory.from_config(config)
    heads = script.get_heads()
    assert len(heads) == 1, f"Expected exactly 1 head, found {heads}"
    assert heads[0] in ("c1a2b3c4d5e6", "e5f6a7b8c9d0", "f6a7b8c9d0e1", "b2c3d4e5f6a7", "c3d4e5f6a7b8", "c4d5e6f7a8b9", "d5e6f7a8b9c0", "cedb24c053f7", "407a7716be83", "a2b3c4d5e6f7", "04834912199b", "e7f8a9b0c1d2", "f8a9b0c1d2e3"), f"Expected head to be known valid head, got {heads[0]}"


def test_alembic_dag_no_dangling_parents():
    """Verify that all revisions resolve to valid parent revisions with no missing dependencies."""
    config = alembic.config.Config(str(backend_dir / "alembic.ini"))
    script = alembic.script.ScriptDirectory.from_config(config)
    
    revisions = list(script.walk_revisions())
    assert len(revisions) >= 10, f"Expected at least 10 revisions, got {len(revisions)}"
    
    rev_ids = {r.revision for r in revisions}
    for r in revisions:
        if r.down_revision is not None:
            if isinstance(r.down_revision, tuple):
                for down in r.down_revision:
                    assert down in rev_ids, f"Revision {r.revision} references nonexistent down_revision {down}"
            else:
                assert r.down_revision in rev_ids, f"Revision {r.revision} references nonexistent down_revision {r.down_revision}"


def test_alembic_rls_migration_references_attendance_events():
    """Verify that the RLS migration b749d0e2e92b targets attendance_events, not attendance_records."""
    rls_mig = backend_dir / "alembic" / "versions" / "xxxx_enforce_native_rls.py"
    assert rls_mig.exists()
    content = rls_mig.read_text()
    
    assert "attendance_records" not in content, "Found stale reference to 'attendance_records' in RLS migration!"
    assert '"attendance_events"' in content, "Missing reference to 'attendance_events' in RLS migration!"
    assert "down_revision = '63d9333ead59'" in content or 'down_revision = "63d9333ead59"' in content


def test_alembic_offline_sql_upgrade():
    """Verify that alembic upgrade head --sql generates valid transactional PostgreSQL DDL without errors."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    res = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(backend_dir / "alembic.ini"), "upgrade", "head", "--sql"],
        capture_output=True,
        text=True,
        cwd=str(backend_dir.parent),
        env=env,
    )
    assert res.returncode == 0, f"Alembic upgrade head --sql failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}"
    sql = res.stdout
    assert "CREATE TABLE workspaces" in sql
    assert "ALTER TABLE attendance_events ENABLE ROW LEVEL SECURITY" in sql
    assert "CREATE POLICY tenant_isolation_policy ON attendance_events" in sql
    assert "CREATE POLICY tenant_isolation_policy ON workspaces" in sql
    assert "version_num='c1a2b3c4d5e6'" in sql


def test_alembic_offline_sql_downgrade():
    """Verify that alembic downgrade generates valid reverse SQL."""
    env = os.environ.copy()
    env["PYTHONPATH"] = str(backend_dir)
    res = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(backend_dir / "alembic.ini"), "downgrade", "c1a2b3c4d5e6:b749d0e2e92b", "--sql"],
        capture_output=True,
        text=True,
        cwd=str(backend_dir.parent),
        env=env,
    )
    assert res.returncode == 0, f"Alembic downgrade --sql failed:\nSTDOUT: {res.stdout}\nSTDERR: {res.stderr}"
    sql = res.stdout
    assert "DROP TABLE workspaces" in sql
    assert "DROP TABLE organizations" in sql
    assert "version_num='b749d0e2e92b'" in sql


def test_sqlalchemy_model_table_names():
    """Verify critical model table names match PostgreSQL schema."""
    assert AttendanceEvent.__tablename__ == "attendance_events"
    assert Workspace.__tablename__ == "workspaces"
    assert Organization.__tablename__ == "organizations"
    assert WorkspaceMembership.__tablename__ == "workspace_memberships"
    assert GuardianStudentLink.__tablename__ == "student_guardians"
    assert ApprovalTask.__tablename__ == "approval_tasks"
    assert User.__tablename__ == "users"
    assert Tenant.__tablename__ == "tenants"


def test_workspace_model_stage01_compatibility():
    """Verify Workspace model contains code and organization_id columns."""
    assert hasattr(Workspace, "code")
    assert hasattr(Workspace, "organization_id")
    assert hasattr(Workspace, "workspace_type")
    assert hasattr(Workspace, "tenant_id")


def test_attendance_event_idempotency_key():
    """Verify AttendanceEvent model has idempotency_key for offline sync."""
    assert hasattr(AttendanceEvent, "idempotency_key")
    col = AttendanceEvent.__table__.columns.get("idempotency_key")
    assert col is not None


def test_approval_task_backward_compatibility():
    """Verify ApprovalTask model supports both legacy and extended fields."""
    assert hasattr(ApprovalTask, "action_type")
    assert hasattr(ApprovalTask, "payload_content")
    assert hasattr(ApprovalTask, "risk_level")
    assert hasattr(ApprovalTask, "task_type")
    assert hasattr(ApprovalTask, "payload")


def test_base_metadata_completeness():
    """Verify that Base.metadata contains all essential domain tables."""
    expected_tables = {
        "tenants",
        "users",
        "roles",
        "school_profiles",
        "teachers",
        "students",
        "guardians",
        "student_guardians",
        "attendance_events",
        "academic_sessions",
        "classes",
        "grade_levels",
        "subjects",
        "class_routines",
        "daily_lesson_logs",
        "organizations",
        "workspaces",
        "workspace_memberships",
        "approval_tasks",
        "audit_logs",
        "fee_payments",
        "exams",
        "exam_results",
        "student_results",
        "question_papers",
        "notices",
        "messages",
        "campus_branches",
        "academic_programs",
        "academy_batches",
        "batch_enrollments",
        "live_exams",
        "exam_submissions",
        "tenant_ai_budgets",
        "ai_usage_logs",
        "push_subscriptions",
        "institution_subscriptions",
        "subscription_payments",
    }
    registered = set(Base.metadata.tables.keys())
    missing = expected_tables - registered
    assert not missing, f"Missing tables in Base.metadata: {missing}"


def test_rls_permissive_policies_defined():
    """Verify that migration c4d5e6f7a8b9 defines PERMISSIVE policies to prevent fail-closed RLS lockup."""
    config = alembic.config.Config(str(backend_dir / "alembic.ini"))
    script = alembic.script.ScriptDirectory.from_config(config)
    rev = script.get_revision("c4d5e6f7a8b9")
    assert rev is not None, "Revision c4d5e6f7a8b9 not found"
    
    # Read the file content and assert AS PERMISSIVE is used
    migration_file = Path(rev.path)
    content = migration_file.read_text()
    assert "AS PERMISSIVE" in content
    assert "tenant_curriculum_permissive_base" in content
    assert "billing_invoices" in content
    assert "tenant_entitlements" in content
    assert "billing_audit_logs" in content

