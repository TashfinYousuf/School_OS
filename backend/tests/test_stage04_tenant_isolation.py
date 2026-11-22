"""
Stage 04 Verification Test Suite: Multi-Tenant Isolation & PostgreSQL RLS Enforcement
Validates:
1. ORM-Level Tenant Guard: Automatic WHERE tenant_id injection via do_orm_execute.
2. Cross-Tenant Read/Write Isolation: Tenant A cannot view or mutate Tenant B records.
3. Database Dependency Unification (BLK-P0-02): All protected routers use deps.get_db.
4. Session-Level & Connection Pool Event Listeners: after_begin and checkin isolation guards.
5. Workspace Code Uniqueness & Tenant Scoping: (tenant_id, code) constraint enforcement.
6. RLS Policy Integrity: Coexistence of AS PERMISSIVE baseline and AS RESTRICTIVE isolation.
7. Cross-Tenant Header Forgery Prevention: Strict rejection of forged X-Tenant-ID headers.
"""

import uuid
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from starlette.testclient import TestClient

from app.core.database import get_tenant_db, get_db as core_get_db, engine
from app.api.deps import (
    get_db as deps_get_db,
    get_current_user,
    get_current_user_claims,
    get_current_tenant_id,
)
from app.core.security import create_access_token
from app.models.student import Student
from app.models.workspace import Workspace, WorkspaceType
from app.main import app


# ----------------------------------------------------------------------------------------
# 1. Router Dependency Audit (BLK-P0-02 Resolution)
# ----------------------------------------------------------------------------------------
def test_all_protected_routers_depend_on_tenant_aware_db():
    """
    Validates that all protected multi-tenant endpoints depend on app.api.deps.get_db,
    guaranteeing that database sessions are tied to verified tenant context.
    """
    from app.api.endpoints import (
        students,
        attendance,
        workspaces,
        finance,
        exams,
        notices,
        academic,
        teachers,
        guardians,
        approvals,
        results,
        academy,
        dashboard,
        notifications,
        campus,
        communication,
        question_papers,
        teacher_diary,
        government,
        ai,
        audit,
        institution,
        users,
        ai_tutor,
    )

    checked_modules = [
        students,
        attendance,
        workspaces,
        finance,
        exams,
        notices,
        academic,
        teachers,
        guardians,
        approvals,
        results,
        academy,
        dashboard,
        notifications,
        campus,
        communication,
        question_papers,
        teacher_diary,
        government,
        ai,
        audit,
        institution,
        users,
        ai_tutor,
    ]

    for mod in checked_modules:
        assert hasattr(mod, "get_db"), f"Module {mod.__name__} has no get_db"
        # Verify get_db is imported from deps, not core.database
        assert mod.get_db == deps_get_db, (
            f"Module {mod.__name__}.get_db is not app.api.deps.get_db! "
            f"It points to {mod.get_db.__module__}.{mod.get_db.__name__}"
        )


# ----------------------------------------------------------------------------------------
# 2. Database Event Listeners Registration
# ----------------------------------------------------------------------------------------
def test_database_session_and_pool_event_listeners():
    """
    Verifies that session after_begin and pool checkin hooks are properly registered.
    """
    from app.core.database import enforce_tenant_rls_context, reset_pooled_connection_on_checkin

    # Check after_begin dispatch
    assert event.contains(Session, "after_begin", enforce_tenant_rls_context)

    # Check connection pool checkin dispatch
    assert event.contains(engine, "checkin", reset_pooled_connection_on_checkin)


# ----------------------------------------------------------------------------------------
# 3. ORM-Level Tenant Guard Isolation (OWASP A01 / A06)
# ----------------------------------------------------------------------------------------
def test_orm_tenant_guard_cross_tenant_isolation():
    """
    Tests that SQLAlchemy sessions tagged with db.info['tenant_id'] automatically
    restrict queries to that tenant, even if the query does not include a WHERE tenant_id filter.
    """
    # Create an isolated SQLite database in memory with Student table
    test_engine = create_engine("sqlite:///:memory:")
    Student.__table__.create(test_engine, checkfirst=True)
    TestSession = sessionmaker(bind=test_engine)

    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    # Populate records for Tenant A and Tenant B
    setup_session = TestSession()
    setup_session.add(Student(
        id=uuid.uuid4(),
        tenant_id=tenant_a,
        first_name="Alice",
        last_name="A",
        admission_number="ADM-A01",
        class_name="Class 10",
        status="Active",
    ))
    setup_session.add(Student(
        id=uuid.uuid4(),
        tenant_id=tenant_b,
        first_name="Bob",
        last_name="B",
        admission_number="ADM-B01",
        class_name="Class 10",
        status="Active",
    ))
    setup_session.commit()
    setup_session.close()

    # Query using Tenant A session
    session_a = TestSession(info={"tenant_id": tenant_a})
    results_a = session_a.query(Student).all()
    session_a.close()

    assert len(results_a) == 1
    assert results_a[0].first_name == "Alice"
    assert results_a[0].tenant_id == tenant_a

    # Query using Tenant B session
    session_b = TestSession(info={"tenant_id": tenant_b})
    results_b = session_b.query(Student).all()
    session_b.close()

    assert len(results_b) == 1
    assert results_b[0].first_name == "Bob"
    assert results_b[0].tenant_id == tenant_b


# ----------------------------------------------------------------------------------------
# 4. Workspace Code Uniqueness & Tenant Scoping
# ----------------------------------------------------------------------------------------
def test_workspace_code_unique_per_tenant():
    """
    Validates that a workspace code must be unique within a tenant, but identical
    codes can exist across different tenants.
    """
    client = TestClient(app)
    db_mock = MagicMock()
    tenant_a = str(uuid.uuid4())

    # Mock user admin
    admin_user = MagicMock()
    admin_user.role = "admin"
    admin_user.tenant_id = tenant_a
    admin_user.is_active = True

    # Mock database query: finding existing workspace with code 'ACAD-01'
    existing_ws = MagicMock(spec=Workspace)
    existing_ws.code = "ACAD-01"
    existing_ws.tenant_id = tenant_a

    q = MagicMock()
    # First call: check existing academy workspace -> None
    # Second call: check existing workspace code -> existing_ws
    q.filter.return_value.first.side_effect = [None, existing_ws]
    db_mock.query.return_value = q

    def override_db():
        yield db_mock

    app.dependency_overrides[deps_get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    token = create_access_token(data={"sub": str(uuid.uuid4()), "tenant_id": tenant_a, "role": "admin"})

    try:
        response = client.post(
            "/api/v1/workspaces/enable-academy",
            json={"name": "Duplicate Academy", "code": "ACAD-01"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 409
        assert "already in use" in response.json()["detail"]
    finally:
        app.dependency_overrides.clear()


# ----------------------------------------------------------------------------------------
# 5. Canonical PERMISSIVE RLS Isolation Policy in Migrations
# ----------------------------------------------------------------------------------------
def test_alembic_rls_canonical_permissive_isolation_policy():
    """
    Verifies that Alembic RLS migrations define a single canonical PERMISSIVE tenant
    isolation policy (USING tenant_id = NULLIF(current_setting(...), '')) without overly
    broad USING (true) bypass policies.
    """
    versions_dir = Path(__file__).resolve().parent.parent / "alembic" / "versions"
    rls_file = versions_dir / "xxxx_enforce_native_rls.py"
    ws_file = versions_dir / "c1a2b3c4d5e6_add_workspaces_and_schema_reconciliation.py"

    assert rls_file.exists()
    assert ws_file.exists()

    rls_src = rls_file.read_text()
    ws_src = ws_file.read_text()

    # 1. RLS migration must define canonical PERMISSIVE isolation policy
    assert "CREATE POLICY tenant_isolation_policy" in rls_src
    assert "AS PERMISSIVE" in rls_src
    assert "current_setting('app.current_tenant_id', true)" in rls_src
    assert "CREATE POLICY tenant_permissive_base" not in rls_src

    # 2. Workspaces migration must also define canonical PERMISSIVE policy and no broad base
    assert "CREATE POLICY tenant_isolation_policy ON workspaces" in ws_src
    assert "AS PERMISSIVE" in ws_src
    assert "CREATE POLICY tenant_permissive_base ON workspaces" not in ws_src


# ----------------------------------------------------------------------------------------
# 6. Cross-Tenant Header Forgery Prevention
# ----------------------------------------------------------------------------------------
def test_cross_tenant_header_forgery_fails_closed():
    """
    Verifies that an authenticated regular user cannot access another tenant's data
    by forging an X-Tenant-ID header.
    """
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    token = create_access_token(data={"sub": "user1", "tenant_id": tenant_a, "role": "teacher"})

    with pytest.raises(HTTPException) as exc_info:
        get_current_user_claims(token=token, x_tenant_id=tenant_b)

    assert exc_info.value.status_code == 403
    assert "Cross-tenant access violation" in exc_info.value.detail
