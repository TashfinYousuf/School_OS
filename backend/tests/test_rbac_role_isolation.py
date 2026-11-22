# backend/tests/test_rbac_role_isolation.py
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
from app.core.security import get_password_hash, create_access_token, clear_revocation_store
from app.models.base import Base
from app.models.tenant import Tenant, User
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.academic import ClassRoutine
from app.models.notice import Notice
from app.models.communication import Message
from app.models.learning import AIConversation, AIMessage

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
        User.__table__,
        Student.__table__,
        Guardian.__table__,
        GuardianStudentLink.__table__,
        ClassRoutine.__table__,
        Notice.__table__,
        Message.__table__,
        AIConversation.__table__,
        AIMessage.__table__,
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


@pytest.fixture
def rbac_isolation_fixture(sqlite_db):
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    tenant = Tenant(
        id=tenant_uuid,
        school_name="RBAC Isolation Test Academy",
        domain=f"rbac-{uuid.uuid4().hex[:6]}.edu.bd",
        address="Dhaka, Bangladesh"
    )
    sqlite_db.add(tenant)

    # 1. Admin User
    admin_id = uuid.uuid4()
    admin = User(
        id=admin_id,
        tenant_id=tenant_uuid,
        email=f"admin-{uuid.uuid4().hex[:6]}@rbac.edu.bd",
        password_hash=get_password_hash("AdminPass123!"),
        role="admin",
        is_active=True,
        first_name="Admin",
        last_name="User"
    )
    sqlite_db.add(admin)

    # 2. Student User & Student Record
    student_user_id = uuid.uuid4()
    student_user = User(
        id=student_user_id,
        tenant_id=tenant_uuid,
        email=f"student-{uuid.uuid4().hex[:6]}@rbac.edu.bd",
        password_hash=get_password_hash("StudentPass123!"),
        role="student",
        is_active=True,
        first_name="Student",
        last_name="Learner"
    )
    sqlite_db.add(student_user)

    student_rec = Student(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        user_id=student_user_id,
        first_name="Student",
        last_name="Learner",
        admission_number=f"ADM-RBAC-{uuid.uuid4().hex[:4].upper()}",
        class_name="Class 8",
        section="A",
        roll_number="12",
        status="Active"
    )
    sqlite_db.add(student_rec)

    # 3. Guardian User & Guardian Record
    guardian_user_id = uuid.uuid4()
    guardian_user = User(
        id=guardian_user_id,
        tenant_id=tenant_uuid,
        email=f"guardian-{uuid.uuid4().hex[:6]}@rbac.edu.bd",
        password_hash=get_password_hash("GuardianPass123!"),
        role="guardian",
        is_active=True,
        first_name="Guardian",
        last_name="Parent"
    )
    sqlite_db.add(guardian_user)

    guardian_rec = Guardian(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        first_name="Guardian",
        last_name="Parent",
        phone_number="01711223344",
        email=guardian_user.email
    )
    sqlite_db.add(guardian_rec)

    link = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian_rec.id,
        student_id=student_rec.id,
        relationship_type=GuardianRelationship.FATHER,
        verification_status="VERIFIED",
        is_primary=True,
        is_primary_contact=True
    )
    sqlite_db.add(link)
    sqlite_db.commit()

    # Apply dependency overrides for in-memory SQLite session
    app.dependency_overrides[deps_get_db] = lambda: sqlite_db
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id

    admin_token = create_access_token(data={"sub": str(admin_id), "user_id": str(admin_id), "tenant_id": tenant_id, "role": "admin"})
    student_token = create_access_token(data={"sub": str(student_user_id), "user_id": str(student_user_id), "tenant_id": tenant_id, "role": "student"})
    guardian_token = create_access_token(data={"sub": str(guardian_user_id), "user_id": str(guardian_user_id), "tenant_id": tenant_id, "role": "guardian"})

    return {
        "tenant_id": tenant_id,
        "admin_token": admin_token,
        "student_token": student_token,
        "guardian_token": guardian_token,
        "student_rec_id": str(student_rec.id),
        "guardian_rec_id": str(guardian_rec.id),
    }


def test_student_blocked_from_admin_mutations(rbac_isolation_fixture):
    data = rbac_isolation_fixture
    headers = {
        "Authorization": f"Bearer {data['student_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Blocked from routine creation
    res1 = client.post(
        "/api/v1/academic/routine",
        headers=headers,
        json={
            "day": "Sunday",
            "class_name": "Class 8",
            "section": "A",
            "subject": "Mathematics",
            "start_time": "09:00",
            "end_time": "09:45"
        }
    )
    assert res1.status_code == 403

    # 2. Blocked from publishing notice
    res2 = client.post(
        "/api/v1/notices/",
        headers=headers,
        json={
            "title": "Unauthorized Notice",
            "content": "This notice should fail.",
            "target_audience": "ALL"
        }
    )
    assert res2.status_code == 403

    # 3. Blocked from admin WhatsApp/communication triage inbox
    res3 = client.get(
        "/api/v1/communication/inbox",
        headers=headers
    )
    assert res3.status_code == 403


def test_guardian_blocked_from_admin_mutations(rbac_isolation_fixture):
    data = rbac_isolation_fixture
    headers = {
        "Authorization": f"Bearer {data['guardian_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Blocked from routine creation
    res1 = client.post(
        "/api/v1/academic/routine",
        headers=headers,
        json={
            "day": "Monday",
            "class_name": "Class 8",
            "section": "A",
            "subject": "Physics",
            "start_time": "10:00",
            "end_time": "10:45"
        }
    )
    assert res1.status_code == 403

    # 2. Blocked from publishing notice
    res2 = client.post(
        "/api/v1/notices/",
        headers=headers,
        json={
            "title": "Unauthorized Guardian Notice",
            "content": "Should not be allowed.",
            "target_audience": "ALL"
        }
    )
    assert res2.status_code == 403

    # 3. Blocked from admin communication triage inbox
    res3 = client.get(
        "/api/v1/communication/inbox",
        headers=headers
    )
    assert res3.status_code == 403


def test_student_permitted_read_and_learning_endpoints(rbac_isolation_fixture):
    data = rbac_isolation_fixture
    headers = {
        "Authorization": f"Bearer {data['student_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Allowed to view class routine
    res1 = client.get("/api/v1/academic/routine", headers=headers)
    assert res1.status_code == 200

    # 2. Allowed to view circulars/notices
    res2 = client.get("/api/v1/notices/", headers=headers)
    assert res2.status_code == 200

    # 3. Allowed to view personal inquiries
    res3 = client.get("/api/v1/communication/my-inquiries", headers=headers)
    assert res3.status_code == 200
    assert isinstance(res3.json(), list)

    # 4. Allowed to view and create Socratic Learning conversations
    res4 = client.get("/api/v1/learning-os/conversations", headers=headers)
    assert res4.status_code == 200

    res5 = client.post(
        "/api/v1/learning-os/conversations",
        headers=headers,
        json={
            "subject": "Mathematics",
            "topic": "Quadratic Equations",
            "title": "Math Help: Step 1",
            "mode": "socratic_tutor"
        }
    )
    assert res5.status_code == 201
    assert res5.json()["subject"] == "Mathematics"


def test_guardian_permitted_endpoints(rbac_isolation_fixture):
    data = rbac_isolation_fixture
    headers = {
        "Authorization": f"Bearer {data['guardian_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Allowed to view class routine
    res1 = client.get("/api/v1/academic/routine", headers=headers)
    assert res1.status_code == 200

    # 2. Allowed to view notices
    res2 = client.get("/api/v1/notices/", headers=headers)
    assert res2.status_code == 200

    # 3. Allowed to submit helpdesk inquiry
    res3 = client.post(
        "/api/v1/communication/submit-inquiry",
        headers=headers,
        json={
            "content": "When will the March tuition receipt be ready?",
            "category": "Fee Receipts"
        }
    )
    assert res3.status_code == 201
    assert res3.json()["status"] == "submitted"


def test_admin_full_access(rbac_isolation_fixture):
    data = rbac_isolation_fixture
    headers = {
        "Authorization": f"Bearer {data['admin_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # Admin access to communication inbox
    res = client.get("/api/v1/communication/inbox", headers=headers)
    assert res.status_code == 200
