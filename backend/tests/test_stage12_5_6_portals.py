# backend/tests/test_stage12_5_6_portals.py
import pytest
import uuid
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models  # Registers all models with Base.metadata
from app.main import app
from app.models.base import Base
from app.models.tenant import Tenant, User
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.models.finance import FeePayment
from app.models.academic import ClassRoutine
from app.core.database import get_db as core_get_db
from app.api.deps import get_db as deps_get_db
from app.core.security import create_access_token, get_password_hash

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db_session: Session):
    def override_get_db(tenant_id: str = None):
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[core_get_db] = override_get_db
    app.dependency_overrides[deps_get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def setup_portal_fixture(db_session: Session):
    tid_uuid = uuid.uuid4()
    tid = str(tid_uuid)

    tenant = Tenant(
        id=tid_uuid,
        school_name="Kids Shine School",
        domain=f"kidsshine-{uuid.uuid4().hex[:6]}"
    )
    db_session.add(tenant)
    db_session.commit()

    # Guardian
    g_user_id = uuid.uuid4()
    g_user = User(
        id=g_user_id,
        email=f"father-{uuid.uuid4().hex[:4]}@kidsshine.edu.bd",
        password_hash=get_password_hash("ParentPass123!"),
        tenant_id=tid_uuid,
        role="guardian",
        is_active=True,
    )
    db_session.add(g_user)
    db_session.commit()

    guardian = Guardian(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        user_id=g_user_id,
        first_name="Monir",
        last_name="Hossain",
        phone_number="01719876543",
        email=g_user.email,
    )
    db_session.add(guardian)
    db_session.commit()

    # 2 Children for Monir Hossain
    # Child 1: Sami (Class 5)
    sami_user_id = uuid.uuid4()
    sami_user = User(
        id=sami_user_id,
        email=f"sami-{uuid.uuid4().hex[:4]}@kidsshine.edu.bd",
        password_hash=get_password_hash("StudentPass123!"),
        tenant_id=tid_uuid,
        role="student",
        is_active=True,
    )
    sami = Student(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        user_id=sami_user_id,
        first_name="Sami",
        last_name="Hossain",
        admission_number=f"KS-2026-001",
        class_name="Class 5",
        section="A",
        roll_number="01",
        status="Active",
    )
    # Child 2: Zara (Class 2)
    zara = Student(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        first_name="Zara",
        last_name="Hossain",
        admission_number=f"KS-2026-002",
        class_name="Class 2",
        section="B",
        roll_number="03",
        status="Active",
    )
    db_session.add_all([sami_user, sami, zara])
    db_session.commit()

    # Link both children to Monir
    link1 = GuardianStudentLink(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        guardian_id=guardian.id,
        student_id=sami.id,
        relationship_type=GuardianRelationship.FATHER,
        is_primary=True,
    )
    link2 = GuardianStudentLink(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        guardian_id=guardian.id,
        student_id=zara.id,
        relationship_type=GuardianRelationship.FATHER,
        is_primary=True,
    )
    db_session.add_all([link1, link2])
    db_session.commit()

    # Attendance for Sami: 3 days (2 Present, 1 Absent)
    today = date.today()
    yest = today - timedelta(days=1)
    ev1 = AttendanceEvent(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=sami.id,
        class_id="Class 5",
        date=today,
        status="Present",
    )
    ev2 = AttendanceEvent(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=sami.id,
        class_id="Class 5",
        date=yest,
        status="Absent",
    )
    # Attendance for Zara: 1 day (Present)
    ev3 = AttendanceEvent(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=zara.id,
        class_id="Class 2",
        date=today,
        status="Present",
    )
    db_session.add_all([ev1, ev2, ev3])
    db_session.commit()

    # Academic Results for Sami (GPA 5.0)
    r1 = StudentResult(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=sami.id,
        exam_term="Half Yearly 2026",
        class_name="Class 5",
        subject="Bangla",
        marks_obtained=88.0,
        grade="A+",
        grade_point=5.0,
    )
    r2 = StudentResult(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=sami.id,
        exam_term="Half Yearly 2026",
        class_name="Class 5",
        subject="English",
        marks_obtained=85.0,
        grade="A+",
        grade_point=5.0,
    )
    db_session.add_all([r1, r2])
    db_session.commit()

    # Fee Payment for Sami (৳ 3,000)
    p1 = FeePayment(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=sami.id,
        amount=3000,
        currency="BDT",
        payment_method="Cash",
        payment_status="SUCCESS",
        receipt_number=f"RCP-{uuid.uuid4().hex[:6].upper()}",
        idempotency_key=f"IDEMP-FEE-{uuid.uuid4().hex[:8]}",
    )
    db_session.add(p1)
    db_session.commit()

    # Class Routine for Class 5
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = day_names[today.weekday()]
    routine = ClassRoutine(
        id=uuid.uuid4(),
        tenant_id=tid,
        class_name="Class 5",
        day_of_week=current_day,
        period_number="Period 1",
        start_time="09:00 AM",
        end_time="09:45 AM",
        subject="Mathematics",
        teacher_name="Mr. Habib",
        room_number="Room 102",
    )
    db_session.add(routine)
    db_session.commit()

    guardian_token = create_access_token(
        data={"sub": str(guardian.id), "tenant_id": tid, "role": "guardian"}
    )
    student_token = create_access_token(
        data={"sub": str(sami.id), "tenant_id": tid, "role": "student"}
    )

    return {
        "tenant_id": tid,
        "guardian_token": guardian_token,
        "student_token": student_token,
        "guardian": guardian,
        "sami": sami,
        "zara": zara,
    }


def test_guardian_my_children_overview(client: TestClient, setup_portal_fixture: dict):
    headers = {
        "Authorization": f"Bearer {setup_portal_fixture['guardian_token']}",
        "X-Tenant-ID": setup_portal_fixture["tenant_id"],
    }

    res = client.get("/api/v1/guardians/me/children", headers=headers)
    assert res.status_code == 200, res.text
    children = res.json()
    assert len(children) == 2

    # Check Sami
    sami_data = next((c for c in children if c["student_name"] == "Sami Hossain"), None)
    assert sami_data is not None
    assert sami_data["admission_number"] == "KS-2026-001"
    assert sami_data["class_name"] == "Class 5"
    assert sami_data["relationship"] == "Father"
    # Attendance: 2 days (1 Present, 1 Absent) -> 50.0%
    assert sami_data["attendance"]["total_days"] == 2
    assert sami_data["attendance"]["present_days"] == 1
    assert sami_data["attendance"]["absent_days"] == 1
    assert sami_data["attendance"]["rate_percentage"] == 50.0
    assert sami_data["attendance"]["today_status"] == "Present"
    # Academic standing
    assert sami_data["academics"]["gpa"] == 5.0
    assert "GPA 5.00 (A+)" in sami_data["academics"]["standing"]
    # Fees
    assert sami_data["fees"]["total_paid"] == 3000
    assert sami_data["fees"]["status"] == "Paid in Full"

    # Check Zara
    zara_data = next((c for c in children if c["student_name"] == "Zara Hossain"), None)
    assert zara_data is not None
    assert zara_data["class_name"] == "Class 2"
    assert zara_data["attendance"]["total_days"] == 1
    assert zara_data["attendance"]["rate_percentage"] == 100.0


def test_student_me_dashboard(client: TestClient, setup_portal_fixture: dict):
    headers = {
        "Authorization": f"Bearer {setup_portal_fixture['student_token']}",
        "X-Tenant-ID": setup_portal_fixture["tenant_id"],
    }

    res = client.get("/api/v1/students/me/dashboard", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["student"]["name"] == "Sami Hossain"
    assert data["student"]["class_name"] == "Class 5"
    assert data["student"]["roll_number"] == "01"
    # Real attendance
    assert data["attendance"]["total_days"] == 2
    assert data["attendance"]["rate_percentage"] == 50.0
    assert data["attendance"]["today_status"] == "Present"
    # Real GPA
    assert data["academics"]["term_gpa"] == 5.0
    assert "GPA 5.00 (A+)" in data["academics"]["standing"]
    # Today's Routine
    assert data["routine_today"]["periods_count"] >= 1
    p1 = data["routine_today"]["periods"][0]
    assert p1["subject"] == "Mathematics"
    assert p1["teacher_name"] == "Mr. Habib"
    assert p1["room_number"] == "Room 102"


def test_student_portal_role_enforcement(client: TestClient, setup_portal_fixture: dict):
    # Guardian attempting to access /students/me/dashboard must receive 403
    guardian_headers = {
        "Authorization": f"Bearer {setup_portal_fixture['guardian_token']}",
        "X-Tenant-ID": setup_portal_fixture["tenant_id"],
    }
    res = client.get("/api/v1/students/me/dashboard", headers=guardian_headers)
    assert res.status_code == 403

    # Student attempting to access /guardians/me/children must receive 403
    student_headers = {
        "Authorization": f"Bearer {setup_portal_fixture['student_token']}",
        "X-Tenant-ID": setup_portal_fixture["tenant_id"],
    }
    res2 = client.get("/api/v1/guardians/me/children", headers=student_headers)
    assert res2.status_code == 403
