# backend/tests/test_stage12_5_1_tenant_workspace.py
import uuid
import pytest
from datetime import timedelta
from fastapi import FastAPI, Depends, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import (
    get_current_tenant_id,
    get_current_workspace_id,
    get_current_user_claims,
    get_db,
)
from app.core.security import create_access_token
from app.models.base import Base
from app.models.tenant import User, Tenant
from app.models.workspace import Workspace, WorkspaceMembership, WorkspaceType

# Isolated In-Memory SQLite Engine for Hermetic Fast Unit Tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Create minimal test app
test_app = FastAPI()

def override_get_db(tenant_id: str = Depends(get_current_tenant_id)):
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()

test_app.dependency_overrides[get_db] = override_get_db

@test_app.get("/api/v1/test/tenant-only")
def tenant_only_endpoint(tenant_id: str = Depends(get_current_tenant_id)):
    return {"tenant_id": tenant_id, "status": "authorized"}

@test_app.get("/api/v1/test/workspace-scoped")
def workspace_scoped_endpoint(
    tenant_id: str = Depends(get_current_tenant_id),
    workspace_id: str = Depends(get_current_workspace_id),
):
    return {"tenant_id": tenant_id, "workspace_id": workspace_id, "status": "authorized"}

@pytest.fixture(autouse=True)
def setup_test_db():
    tables = [WorkspaceMembership.__table__, Workspace.__table__, User.__table__]
    Base.metadata.create_all(bind=test_engine, tables=tables)
    db = TestSessionLocal()
    try:
        db.query(WorkspaceMembership).delete()
        db.query(Workspace).delete()
        db.query(User).delete()
        db.commit()

        # Tenant 1 (Kids Shine School)
        t1_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
        # Tenant 2 (Foreign School)
        t2_id = uuid.UUID("22222222-2222-2222-2222-222222222222")

        # Admin User for Tenant 1
        u1 = User(
            id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            email="admin@kidsshine.com",
            password_hash="test_hash",
            tenant_id=t1_id,
            role="admin",
            is_active=True,
        )
        # Teacher User for Tenant 1
        u2 = User(
            id=uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            email="teacher@kidsshine.com",
            password_hash="test_hash",
            tenant_id=t1_id,
            role="teacher",
            is_active=True,
        )

        # Workspaces under Tenant 1
        ws1_primary = Workspace(
            id=uuid.UUID("1a000000-0000-0000-0000-000000000001"),
            tenant_id=str(t1_id),
            name="Kids Shine Primary",
            workspace_type=WorkspaceType.SCHOOL,
            code="SCH-01",
            is_active=True,
        )
        ws2_academy = Workspace(
            id=uuid.UUID("2b000000-0000-0000-0000-000000000002"),
            tenant_id=str(t1_id),
            name="Kids Shine Academy",
            workspace_type=WorkspaceType.ACADEMY,
            code="ACAD-01",
            is_active=True,
        )
        # Inactive Workspace under Tenant 1
        ws3_inactive = Workspace(
            id=uuid.UUID("3c000000-0000-0000-0000-000000000003"),
            tenant_id=str(t1_id),
            name="Inactive Campus",
            workspace_type=WorkspaceType.SCHOOL,
            code="INACT-01",
            is_active=False,
        )

        # Workspace under Foreign Tenant 2
        ws_foreign = Workspace(
            id=uuid.UUID("4d000000-0000-0000-0000-000000000001"),
            tenant_id=str(t2_id),
            name="Foreign School Workspace",
            workspace_type=WorkspaceType.SCHOOL,
            code="FOR-01",
            is_active=True,
        )

        # Teacher membership only in ws1_primary
        m1 = WorkspaceMembership(
            id=uuid.uuid4(),
            user_id=str(u2.id),
            workspace_id=ws1_primary.id,
            role="teacher",
            is_active=True,
        )

        db.add_all([u1, u2, ws1_primary, ws2_academy, ws3_inactive, ws_foreign, m1])
        db.commit()
    finally:
        db.close()
    yield
    db_clean = TestSessionLocal()
    try:
        db_clean.query(WorkspaceMembership).delete()
        db_clean.query(Workspace).delete()
        db_clean.query(User).delete()
        db_clean.commit()
    finally:
        db_clean.close()
    Base.metadata.drop_all(bind=test_engine, tables=tables)


def make_token(user_id: str, tenant_id: str, role: str = "admin") -> str:
    data = {
        "sub": user_id,
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": role,
    }
    return create_access_token(data=data, subject=user_id, expires_delta=timedelta(hours=1))


client = TestClient(test_app)

T1_ID = "11111111-1111-1111-1111-111111111111"
T2_ID = "22222222-2222-2222-2222-222222222222"
U1_ADMIN = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
U2_TEACHER = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
WS1_PRIMARY = "1a000000-0000-0000-0000-000000000001"
WS2_ACADEMY = "2b000000-0000-0000-0000-000000000002"
WS3_INACTIVE = "3c000000-0000-0000-0000-000000000003"
WS_FOREIGN = "4d000000-0000-0000-0000-000000000001"


# 1. Correct Tenant + Correct Workspace
def test_correct_tenant_and_correct_workspace():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS1_PRIMARY,
        },
    )
    assert res.status_code == 200
    assert res.json() == {"tenant_id": T1_ID, "workspace_id": WS1_PRIMARY, "status": "authorized"}


# 2. Correct Tenant + Different Authorized Workspace
def test_correct_tenant_different_authorized_workspace():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS2_ACADEMY,
        },
    )
    assert res.status_code == 200
    assert res.json() == {"tenant_id": T1_ID, "workspace_id": WS2_ACADEMY, "status": "authorized"}


# 3. Foreign Tenant ID (Header Spoofing Prevention)
def test_foreign_tenant_id_rejected():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    # Client sends foreign tenant ID header
    res = client.get(
        "/api/v1/test/tenant-only",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T2_ID,
        },
    )
    assert res.status_code == 403
    assert "Cross-tenant access violation" in res.json()["detail"]


# 4. Foreign Workspace ID (Non-existent UUID)
def test_foreign_workspace_id_rejected():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    fake_ws = str(uuid.uuid4())
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": fake_ws,
        },
    )
    assert res.status_code == 403
    assert "Cross-tenant access violation" in res.json()["detail"]


# 5. Workspace Belonging to Another Tenant
def test_workspace_belonging_to_another_tenant_rejected():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    # Trying to access Tenant 2's workspace while authenticated as Tenant 1
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS_FOREIGN,
        },
    )
    assert res.status_code == 403
    assert "Cross-tenant access violation" in res.json()["detail"]


# 6. Inactive Workspace Rejected
def test_inactive_workspace_rejected():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS3_INACTIVE,
        },
    )
    assert res.status_code == 403


# 7. Non-Admin Role Restricted to Assigned Workspaces
def test_teacher_blocked_from_unassigned_workspace():
    teacher_token = make_token(U2_TEACHER, T1_ID, "teacher")
    # Teacher is assigned to ws1_primary, but NOT ws2_academy
    res_allowed = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {teacher_token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS1_PRIMARY,
        },
    )
    assert res_allowed.status_code == 200

    res_blocked = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {teacher_token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": WS2_ACADEMY,
        },
    )
    assert res_blocked.status_code == 403
    assert "Unauthorized workspace" in res_blocked.json()["detail"]


# 8. Malformed Workspace UUID Format
def test_malformed_workspace_id_fails_closed():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
            "X-Workspace-ID": "invalid-non-uuid-string",
        },
    )
    assert res.status_code == 400
    assert "Invalid workspace ID format" in res.json()["detail"]


# 9. API Calls Without Explicit Workspace (Workspace Optional)
def test_api_calls_without_workspace_header():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    res = client.get(
        "/api/v1/test/tenant-only",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": T1_ID,
        },
    )
    assert res.status_code == 200
    assert res.json() == {"tenant_id": T1_ID, "status": "authorized"}


# 10. Workspace Header Injected Without X-Tenant-ID Uses Token Tenant
def test_workspace_header_without_tenant_header_resolves():
    token = make_token(U1_ADMIN, T1_ID, "admin")
    # Header X-Tenant-ID omitted; verified token's tenant_id is used
    res = client.get(
        "/api/v1/test/workspace-scoped",
        headers={
            "Authorization": f"Bearer {token}",
            "X-Workspace-ID": WS1_PRIMARY,
        },
    )
    assert res.status_code == 200
    assert res.json() == {"tenant_id": T1_ID, "workspace_id": WS1_PRIMARY, "status": "authorized"}
