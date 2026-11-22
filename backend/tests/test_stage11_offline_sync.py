# backend/tests/test_stage11_offline_sync.py
"""
Stage 11: PWA & Offline Synchronization Backend Test Suite
Verifies:
1. POST /api/v1/attendance/sync-offline batch creation and status reporting
2. Idempotent re-submission (safe retries, unchanged records, conflict updates)
3. Role enforcement (teachers & admins allowed; students & guardians blocked with 403)
4. Future date validation (rejection with 400 Bad Request)
5. Multi-tenant isolation (foreign student IDs skipped cleanly as unknown)
"""
import uuid
import datetime
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app
from app.models.base import Base
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.models.tenant import User
from app.core.database import get_db as core_get_db
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
    get_current_user,
)

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
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


def override_auth_claims(role="teacher", tenant_id="tenant-school-1", user_id=None):
    uid = user_id or str(uuid.uuid4())
    return {
        "sub": uid,
        "user_id": uid,
        "tenant_id": str(tenant_id),
        "role": role,
        "email": f"{role}@test.school",
        "jti": uuid.uuid4().hex,
        "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600
    }


class MockUser:
    def __init__(self, id, tenant_id, role="teacher"):
        self.id = id
        self.tenant_id = tenant_id
        self.role = role
        self.is_active = True


def seed_teacher_user(db, tenant_id: str, user_id: uuid.UUID) -> User:
    u = User(
        id=user_id,
        tenant_id=uuid.UUID(tenant_id),
        email=f"teacher_{user_id.hex[:6]}@school.edu",
        password_hash="test_hash",
        role="teacher",
        is_active=True,
    )
    db.add(u)
    db.commit()
    return u


# ========================================================================================
# Offline Attendance Synchronization Tests
# ========================================================================================

def test_offline_attendance_batch_sync_success():
    """Verify batch sync creates attendance records and returns structured summary."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    teacher_uid = uuid.uuid4()

    s1_id = uuid.uuid4()
    s2_id = uuid.uuid4()
    s3_id = uuid.uuid4()

    db = TestingSessionLocal()
    seed_teacher_user(db, tid, teacher_uid)

    s1 = Student(id=s1_id, tenant_id=tid, first_name="A", last_name="1", admission_number="ADM-101", class_name="Class 5")
    s2 = Student(id=s2_id, tenant_id=tid, first_name="B", last_name="2", admission_number="ADM-102", class_name="Class 5")
    s3 = Student(id=s3_id, tenant_id=tid, first_name="C", last_name="3", admission_number="ADM-103", class_name="Class 5")
    db.add_all([s1, s2, s3])
    db.commit()
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="teacher", tenant_id=tid, user_id=str(teacher_uid))
    app.dependency_overrides[get_current_user] = lambda: MockUser(teacher_uid, uuid.UUID(tid), "teacher")

    today_str = datetime.date.today().isoformat()
    payload = {
        "class_name": "Class 5",
        "date": today_str,
        "records": [
            {"student_id": str(s1_id), "status": "Present", "notes": "On time"},
            {"student_id": str(s2_id), "status": "Absent", "notes": "Sick"},
            {"student_id": str(s3_id), "status": "Late", "notes": "Bus delay"},
        ]
    }

    res = client.post("/api/v1/attendance/sync-offline", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "SYNCED"
    assert data["new_inserted"] == 3
    assert data["records_processed"] == 3

    # Verify persisted in database
    db2 = TestingSessionLocal()
    events = db2.query(AttendanceEvent).filter(AttendanceEvent.tenant_id == tid).all()
    assert len(events) == 3
    db2.close()


def test_offline_attendance_sync_idempotency_and_conflict_update():
    """Verify repeated sync is idempotent and updates conflicting statuses safely."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    teacher_uid = uuid.uuid4()
    s1_id = uuid.uuid4()

    db = TestingSessionLocal()
    seed_teacher_user(db, tid, teacher_uid)
    s1 = Student(id=s1_id, tenant_id=tid, first_name="A", last_name="1", admission_number="ADM-104", class_name="Class 6")
    db.add(s1)
    db.commit()
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="teacher", tenant_id=tid, user_id=str(teacher_uid))
    app.dependency_overrides[get_current_user] = lambda: MockUser(teacher_uid, uuid.UUID(tid), "teacher")

    today_str = datetime.date.today().isoformat()

    # 1. First sync -> Inserted
    p1 = {
        "class_name": "Class 6",
        "date": today_str,
        "records": [{"student_id": str(s1_id), "status": "Absent"}]
    }
    r1 = client.post("/api/v1/attendance/sync-offline", json=p1)
    assert r1.status_code == 200
    assert r1.json()["new_inserted"] == 1

    # 2. Replay identical batch -> Unchanged (idempotency)
    r2 = client.post("/api/v1/attendance/sync-offline", json=p1)
    assert r2.status_code == 200
    assert r2.json()["unchanged"] == 1
    assert r2.json()["new_inserted"] == 0

    # 3. Updated batch with new status -> Updated safely
    p2 = {
        "class_name": "Class 6",
        "date": today_str,
        "records": [{"student_id": str(s1_id), "status": "Present", "notes": "Arrived later with slip"}]
    }
    r3 = client.post("/api/v1/attendance/sync-offline", json=p2)
    assert r3.status_code == 200
    assert r3.json()["updated_conflicts"] == 1

    # Verify DB reflects updated status
    db2 = TestingSessionLocal()
    rec = db2.query(AttendanceEvent).filter(AttendanceEvent.student_id == s1_id).first()
    assert rec.status == "Present"
    assert "Arrived later" in rec.remarks
    db2.close()


def test_offline_attendance_sync_role_enforcement():
    """Verify students and guardians are forbidden from posting offline attendance sync."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    student_uid = uuid.uuid4()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="student", tenant_id=tid, user_id=str(student_uid))

    payload = {
        "class_name": "Class 5",
        "date": datetime.date.today().isoformat(),
        "records": [{"student_id": str(uuid.uuid4()), "status": "Present"}]
    }

    res = client.post("/api/v1/attendance/sync-offline", json=payload)
    assert res.status_code == 403
    assert "Security Policy Violation" in res.json()["detail"]


def test_offline_attendance_sync_future_date_rejected():
    """Verify future attendance dates are rejected with 400 Bad Request."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    teacher_uid = uuid.uuid4()

    db = TestingSessionLocal()
    seed_teacher_user(db, tid, teacher_uid)
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="teacher", tenant_id=tid, user_id=str(teacher_uid))
    app.dependency_overrides[get_current_user] = lambda: MockUser(teacher_uid, uuid.UUID(tid), "teacher")

    tomorrow = datetime.date.today() + datetime.timedelta(days=1)
    payload = {
        "class_name": "Class 5",
        "date": tomorrow.isoformat(),
        "records": [{"student_id": str(uuid.uuid4()), "status": "Present"}]
    }

    res = client.post("/api/v1/attendance/sync-offline", json=payload)
    assert res.status_code == 400
    assert "cannot be in the future" in res.json()["detail"]


def test_offline_attendance_sync_foreign_students_skipped_safely():
    """Verify that student IDs from another tenant are safely skipped without leaking or erroring."""
    client = TestClient(app)
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())
    teacher_uid = uuid.uuid4()
    foreign_sid = uuid.uuid4()

    db = TestingSessionLocal()
    seed_teacher_user(db, tenant_a, teacher_uid)
    foreign_student = Student(id=foreign_sid, tenant_id=tenant_b, first_name="Foreign", last_name="Student", admission_number="ADM-999")
    db.add(foreign_student)
    db.commit()
    db.close()

    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_a
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="teacher", tenant_id=tenant_a, user_id=str(teacher_uid))
    app.dependency_overrides[get_current_user] = lambda: MockUser(teacher_uid, uuid.UUID(tenant_a), "teacher")

    payload = {
        "class_name": "Class 5",
        "date": datetime.date.today().isoformat(),
        "records": [{"student_id": str(foreign_sid), "status": "Present"}]
    }

    res = client.post("/api/v1/attendance/sync-offline", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["new_inserted"] == 0
    assert data["skipped"]["unknown_student"] == 1
