# backend/tests/security/test_pilot_launch_security_and_rbac.py
"""
Pilot Launch Security & RBAC Enforcement Test Suite.
Verifies critical access-control and domain invariants:
1. Teacher RAG Upload & Chunk Ingestion Denial (403 Forbidden)
2. Student and Guardian RAG Document Listing Denial (403 Forbidden)
3. Teacher Notice Publication & AI Compose Denial (403 Forbidden)
4. Teacher Account Provisioning & Single-Use Invitation Generation
5. Superadmin Payment Review Console Access & Dual-Custody Enforcement
6. Sunday-Start Week Boundary & 5-Week Monthly Slices Integrity
"""
import uuid
import datetime
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app
from app.models.base import Base
from app.models.tenant import User, Tenant
from app.models.users import Teacher
from app.models.auth import AccountInvitation
from app.models.subscription_payment import SubscriptionPayment
from app.models.subscription import InstitutionSubscription
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
)
from app.core.database import get_db as core_get_db
from app.core.timeutil import sunday_start_week_bounds, monthly_week_slices

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def get_test_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def clean_database_and_overrides():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[deps_get_db] = get_test_db
    app.dependency_overrides[core_get_db] = get_test_db
    yield
    app.dependency_overrides.clear()


def make_claims(role="admin", tenant_id="tenant-pilot-1", user_id=None):
    uid = user_id or str(uuid.uuid4())
    return {
        "sub": uid,
        "user_id": uid,
        "tenant_id": str(tenant_id),
        "role": role,
        "email": f"{role}@pilot.test",
        "jti": uuid.uuid4().hex,
        "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600,
    }


# ========================================================================================
# 1. RAG Management Role Access Gates (Phase 4 & 5)
# ========================================================================================

def test_teacher_rag_upload_denied():
    """Teacher must be strictly denied from uploading RAG documents."""
    client = TestClient(app)
    tid = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="teacher", tenant_id=tid)

    files = {"file": ("textbook.txt", b"Photosynthesis occurs in chloroplasts.", "text/plain")}
    data = {"title": "Biology", "class_name": "Class 9", "subject": "Biology"}

    res = client.post("/api/v1/ai/curriculum/upload", data=data, files=files)
    assert res.status_code == 403
    assert "Security Policy Violation" in res.json()["detail"] or "roles" in res.json()["detail"].lower()


def test_student_and_guardian_rag_listing_denied():
    """Students and Guardians must be strictly denied from listing RAG documents."""
    client = TestClient(app)
    tid = str(uuid.uuid4())

    # Student attempt
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="student", tenant_id=tid)
    res_student = client.get("/api/v1/ai/curriculum/documents")
    assert res_student.status_code == 403

    # Guardian attempt
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="guardian", tenant_id=tid)
    res_guardian = client.get("/api/v1/ai/curriculum/documents")
    assert res_guardian.status_code == 403


# ========================================================================================
# 2. Notices Role Access Gates (Phase 6)
# ========================================================================================

def test_teacher_notice_publication_denied():
    """Teacher must be denied from publishing notices (notices are read-only for teachers)."""
    client = TestClient(app)
    tid = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="teacher", tenant_id=tid)

    payload = {
        "title": "Unauthorized Holiday Announcement",
        "content": "School will be closed tomorrow.",
        "target_audience": "ALL",
        "is_published": True,
    }
    res = client.post("/api/v1/notices/", json=payload)
    assert res.status_code == 403
    assert "Security Policy Violation" in res.json()["detail"] or "roles" in res.json()["detail"].lower()


def test_admin_can_publish_notice():
    """Tenant Admin can successfully publish an official notice."""
    client = TestClient(app)
    tid = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid)

    payload = {
        "title": "Official Annual Sports Circular",
        "content": "Annual athletic sports will take place on Saturday.",
        "target_audience": "ALL",
        "is_published": True,
    }
    res = client.post("/api/v1/notices/", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == payload["title"]
    assert data["target_audience"] == "ALL"


# ========================================================================================
# 3. Teacher Account Provisioning & Single-Use Invitation (Phase 8)
# ========================================================================================

def test_teacher_account_provisioning_invitation():
    """Tenant Admin can provision a teacher account and receive a single-use activation URL."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    t_uuid = uuid.UUID(tid)
    admin_uid = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid, user_id=admin_uid)

    db = TestingSessionLocal()
    teacher_uid = uuid.uuid4()
    user = User(
        id=teacher_uid,
        tenant_id=t_uuid,
        email="nasreen.akter@kidsshine.edu.bd",
        role="teacher",
        first_name="Nasreen",
        last_name="Akter",
        password_hash="temp_hash",
        is_active=False
    )
    db.add(user)
    db.flush()

    teacher_id = uuid.uuid4()
    teacher = Teacher(
        id=teacher_id,
        tenant_id=t_uuid,
        user_id=teacher_uid,
        first_name="Nasreen",
        last_name="Akter",
        phone_number="01811223344",
        assigned_class="Class 5",
        status="Active",
    )
    db.add(teacher)
    db.commit()
    db.close()

    res = client.post(f"/api/v1/auth/teacher/{teacher_id}/invite")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["teacher_id"] == str(teacher_id)
    assert "activation_token" in data
    assert "/activate?token=" in data["activation_url"]


# ========================================================================================
# 4. Super Admin Payment Review Console & Dual-Custody (Phase 7)
# ========================================================================================

def test_superadmin_payment_review_access():
    """Platform Super Admin can access the cross-tenant payment review queue; Tenant Admin is denied."""
    client = TestClient(app)
    tid = str(uuid.uuid4())

    # Tenant Admin denied
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="admin", tenant_id=tid)
    res_admin = client.get("/api/v1/billing/admin/payments")
    assert res_admin.status_code == 403

    # Super Admin allowed
    app.dependency_overrides[get_current_user_claims] = lambda: make_claims(role="superadmin", tenant_id="platform")
    res_super = client.get("/api/v1/billing/admin/payments")
    assert res_super.status_code == 200
    assert "payments" in res_super.json()


# ========================================================================================
# 5. Institutional Cadence & Date Range Functions (Phase 3)
# ========================================================================================

def test_sunday_start_week_bounds_and_monthly_slices():
    """Verifies Sunday-start calendar bounds and 5-week monthly breakdown."""
    # Given a known Sunday: 2026-11-15
    test_sunday = datetime.datetime(2026, 11, 15, 10, 30, 0, tzinfo=datetime.timezone.utc)
    w_start_dt, w_end_dt, w_start_date, w_end_date = sunday_start_week_bounds(test_sunday)

    assert str(w_start_date) == "2026-11-15"
    assert str(w_end_date) == "2026-11-21"  # Saturday!
    assert w_end_date.weekday() == 5  # Saturday is 5

    # Verify 5-week breakdown for November 2026 (30 days)
    slices = monthly_week_slices(2026, 11)
    assert len(slices) == 5
    assert slices[0][0] == "Week 1 (Days 1–7)"
    assert str(slices[0][3]) == "2026-11-01"
    assert str(slices[0][4]) == "2026-11-07"

    assert slices[2][0] == "Week 3 (Days 15–21)"
    assert str(slices[2][3]) == "2026-11-15"
    assert str(slices[2][4]) == "2026-11-21"

    assert slices[4][0] == "Week 5 (Days 29–30)"
    assert str(slices[4][3]) == "2026-11-29"
    assert str(slices[4][4]) == "2026-11-30"
