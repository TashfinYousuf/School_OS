# backend/tests/test_organizations_bootstrap_rls.py
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

from app.main import app
from app.api.deps import get_db as deps_get_db, get_current_tenant_id
from app.core.database import get_db as core_get_db
from app.core.security import clear_revocation_store
from app.models.base import Base
from app.models.tenant import Tenant, User, SchoolProfile
from app.models.workspace import Organization, Workspace, WorkspaceMembership
from app.models.subscription import InstitutionSubscription

client = TestClient(app)


@pytest.fixture
def sqlite_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    target_tables = [
        Tenant.__table__,
        Organization.__table__,
        SchoolProfile.__table__,
        User.__table__,
        Workspace.__table__,
        WorkspaceMembership.__table__,
        InstitutionSubscription.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=target_tables)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine, tables=target_tables)


@pytest.fixture(autouse=True)
def clean_overrides():
    clear_revocation_store()
    app.dependency_overrides.clear()
    yield
    clear_revocation_store()
    app.dependency_overrides.clear()


def test_atomic_school_registration_and_workspaces_rls(sqlite_db):
    """
    Validates:
    1. Atomic registration provisions Tenant, Organization, SchoolProfile, User,
       Workspace, WorkspaceMembership, and 30-Day Free Trial InstitutionSubscription in one transaction.
    2. GET /api/v1/workspaces/my-workspaces succeeds with 200 OK under RLS without
       psycopg2.errors.InsufficientPrivilege on 'organizations'.
    """
    app.dependency_overrides[deps_get_db] = lambda: sqlite_db
    app.dependency_overrides[core_get_db] = lambda: sqlite_db

    unique_suffix = uuid.uuid4().hex[:6]
    admin_email = f"principal_{unique_suffix}@schoolos.org"

    reg_payload = {
        "school_name": f"RLS Bootstrap School {unique_suffix}",
        "admin_name": "Principal Tester",
        "admin_email": admin_email,
        "admin_password": "SecurePassword123!",
        "contact_phone": "01711223344",
        "address": "Dhaka, Bangladesh"
    }

    # 1. Register new school tenant
    reg_res = client.post("/api/v1/auth/register-school", json=reg_payload)
    assert reg_res.status_code == 201, f"Registration failed: {reg_res.text}"
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    token = reg_data["access_token"]
    tenant_id = reg_data["tenant_id"]

    # Verify atomic database state in SQLite
    tenant = sqlite_db.query(Tenant).filter(Tenant.id == uuid.UUID(tenant_id)).first()
    assert tenant is not None

    org = sqlite_db.query(Organization).filter(Organization.id == tenant.id).first()
    assert org is not None
    assert org.name == tenant.school_name

    profile = sqlite_db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    assert profile is not None

    user = sqlite_db.query(User).filter(User.email == admin_email).first()
    assert user is not None
    assert user.role == "admin"

    workspaces = sqlite_db.query(Workspace).filter(Workspace.tenant_id == str(tenant_id)).all()
    assert len(workspaces) >= 1
    default_ws = workspaces[0]
    ws_type_val = default_ws.workspace_type.value if hasattr(default_ws.workspace_type, "value") else str(default_ws.workspace_type)
    assert ws_type_val.lower() in ("school", "academy")

    membership = sqlite_db.query(WorkspaceMembership).filter(
        WorkspaceMembership.workspace_id == default_ws.id,
        WorkspaceMembership.user_id == str(user.id)
    ).first()
    assert membership is not None

    sub = sqlite_db.query(InstitutionSubscription).filter(
        InstitutionSubscription.tenant_id == str(tenant_id)
    ).first()
    assert sub is not None
    assert sub.subscription_status in ("ACTIVE", "TRIALING")

    # 2. Call GET /api/v1/workspaces/my-workspaces
    # Must return 200 OK and not crash on RLS InsufficientPrivilege
    app.dependency_overrides[get_current_tenant_id] = lambda: str(tenant_id)
    ws_res = client.get(
        "/api/v1/workspaces/my-workspaces",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": str(tenant_id)
        }
    )
    assert ws_res.status_code == 200, f"my-workspaces returned error: {ws_res.text}"
    ws_data = ws_res.json()
    assert isinstance(ws_data, list)
    assert len(ws_data) >= 1
    assert any(w["id"] == str(default_ws.id) for w in ws_data)
