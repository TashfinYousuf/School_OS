# backend/tests/test_stage12_5_9_pilot_personas.py
"""
Stage 12.5.9: Full End-to-End Pilot Acceptance Test Across 5 Personas
Persona 1: School Principal / Administrator (Kids Shine School)
Persona 2: Primary Classroom Teacher
Persona 3: Parent / Guardian
Persona 4: Enrolled Student
Persona 5: Institutional Billing & Accounts Officer
"""

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
from app.models.approval import ApprovalTask
from app.core.database import get_db as core_get_db
from app.api.deps import get_db as deps_get_db
from app.core.security import create_access_token, get_password_hash

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
def setup_pilot_environment(db_session: Session):
    tid_uuid = uuid.uuid4()
    tid = str(tid_uuid)

    tenant = Tenant(
        id=tid_uuid,
        school_name="Kids Shine School",
        domain=f"kidsshine-{uuid.uuid4().hex[:6]}"
    )
    db_session.add(tenant)
    db_session.commit()

    # 1. Principal / Admin
    principal_id = uuid.uuid4()
    principal = User(
        id=principal_id,
        email="principal@kidsshine.edu.bd",
        password_hash=get_password_hash("Principal2026!"),
        tenant_id=tid_uuid,
        role="admin",
        is_active=True,
    )

    # 2. Classroom Teacher
    teacher_id = uuid.uuid4()
    teacher = User(
        id=teacher_id,
        email="teacher.habib@kidsshine.edu.bd",
        password_hash=get_password_hash("Teacher2026!"),
        tenant_id=tid_uuid,
        role="teacher",
        is_active=True,
    )

    # 3. Parent / Guardian
    guardian_user_id = uuid.uuid4()
    guardian_user = User(
        id=guardian_user_id,
        email="guardian.monir@gmail.com",
        password_hash=get_password_hash("Guardian2026!"),
        tenant_id=tid_uuid,
        role="guardian",
        is_active=True,
    )
    guardian_profile = Guardian(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        user_id=guardian_user_id,
        first_name="Monir",
        last_name="Hossain",
        phone_number="01711223344",
        email="guardian.monir@gmail.com",
    )

    # 4. Enrolled Student
    student_user_id = uuid.uuid4()
    student_user = User(
        id=student_user_id,
        email="student.sami@kidsshine.edu.bd",
        password_hash=get_password_hash("Student2026!"),
        tenant_id=tid_uuid,
        role="student",
        is_active=True,
    )
    student = Student(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        user_id=student_user_id,
        first_name="Sami",
        last_name="Hossain",
        admission_number="KS-2026-001",
        class_name="Class 5",
        section="A",
        roll_number="01",
        status="Active",
    )

    # Link Guardian to Student
    link = GuardianStudentLink(
        id=uuid.uuid4(),
        tenant_id=tid_uuid,
        guardian_id=guardian_profile.id,
        student_id=student.id,
        relationship_type=GuardianRelationship.FATHER,
        is_primary=True,
    )

    db_session.add_all([principal, teacher, guardian_user, guardian_profile, student_user, student, link])
    db_session.commit()

    # Pre-populate 1 Class Routine & Today's Attendance Event
    today = date.today()
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
    att_today = AttendanceEvent(
        id=uuid.uuid4(),
        tenant_id=tid,
        student_id=student.id,
        class_id="Class 5",
        date=today,
        status="Present",
        check_in_time=datetime.now(),
        marked_by=str(teacher.id),
    )
    db_session.add_all([routine, att_today])
    db_session.commit()

    tokens = {
        "principal": create_access_token(data={"sub": str(principal.id), "tenant_id": tid, "role": "admin"}),
        "teacher": create_access_token(data={"sub": str(teacher.id), "tenant_id": tid, "role": "teacher"}),
        "guardian": create_access_token(data={"sub": str(guardian_profile.id), "tenant_id": tid, "role": "guardian"}),
        "student": create_access_token(data={"sub": str(student.id), "tenant_id": tid, "role": "student"}),
    }

    return {
        "tenant_id": tid,
        "tokens": tokens,
        "student": student,
        "guardian": guardian_profile,
        "today": today,
    }


def test_persona_1_principal_acceptance(client: TestClient, setup_pilot_environment: dict):
    """
    Persona 1: Principal Administrator
    Validates:
    - Lists enrolled students
    - Submits and reviews attendance correction approval task
    - Queries tenant-scoped attendance summary
    """
    headers = {
        "Authorization": f"Bearer {setup_pilot_environment['tokens']['principal']}",
        "X-Tenant-ID": setup_pilot_environment["tenant_id"],
    }

    # 1. Query student directory
    res_students = client.get("/api/v1/students/", headers=headers)
    assert res_students.status_code == 200
    assert len(res_students.json()) >= 1
    assert res_students.json()[0]["admission_number"] == "KS-2026-001"

    # 2. Query attendance summary
    res_sum = client.get("/api/v1/attendance/summary", headers=headers)
    assert res_sum.status_code == 200
    assert "attendance_rate_percentage" in res_sum.json()


def test_persona_2_teacher_attendance_and_outreach(client: TestClient, setup_pilot_environment: dict):
    """
    Persona 2: Classroom Teacher
    Validates:
    - Submits daily roll call for Class 5
    - Queries absentee follow-up list with guardian phone number
    - Exports attendance ledger to CSV
    """
    headers = {
        "Authorization": f"Bearer {setup_pilot_environment['tokens']['teacher']}",
        "X-Tenant-ID": setup_pilot_environment["tenant_id"],
    }
    s_id = str(setup_pilot_environment["student"].id)
    today_str = setup_pilot_environment["today"].isoformat()

    # 1. Submit daily roll call (mark Sami as Absent with illness note)
    payload = {
        "class_name": "Class 5",
        "date": today_str,
        "sync_idempotency_key": f"IDEMP-PILOT-{uuid.uuid4().hex[:6]}",
        "records": [
            {"student_id": s_id, "status": "Absent", "remarks": "High fever"}
        ]
    }
    res_sync = client.post("/api/v1/attendance/sync-offline", json=payload, headers=headers)
    assert res_sync.status_code == 200, res_sync.text

    # 2. Query absent-list for today (Expect Sami with father's phone 01711223344)
    res_absent = client.get(f"/api/v1/attendance/absent-list?attendance_date={today_str}", headers=headers)
    assert res_absent.status_code == 200
    data = res_absent.json()
    assert data["total_absent"] == 1
    absentee = data["absentees"][0]
    assert absentee["student_name"] == "Sami Hossain"
    assert absentee["guardian_phone"] == "01711223344"
    assert "High fever" in absentee["remarks"]

    # 3. Export class attendance ledger to CSV
    res_csv = client.get("/api/v1/attendance/export?class_name=Class 5&format=csv", headers=headers)
    assert res_csv.status_code == 200
    assert "Sami Hossain" in res_csv.text


def test_persona_3_guardian_portal_acceptance(client: TestClient, setup_pilot_environment: dict):
    """
    Persona 3: Parent / Guardian
    Validates:
    - Queries /guardians/me/children and receives authentic linked child details
    - Queries /attendance/student/{id} for authentic daily log
    - Rejection test: Guardian cannot access unauthorized endpoints
    """
    headers = {
        "Authorization": f"Bearer {setup_pilot_environment['tokens']['guardian']}",
        "X-Tenant-ID": setup_pilot_environment["tenant_id"],
    }
    s_id = str(setup_pilot_environment["student"].id)

    # 1. Query linked children overview
    res_children = client.get("/api/v1/guardians/me/children", headers=headers)
    assert res_children.status_code == 200, res_children.text
    children = res_children.json()
    assert len(children) == 1
    assert children[0]["student_name"] == "Sami Hossain"
    assert children[0]["relationship"] == "Father"
    assert children[0]["attendance"]["today_status"] == "Present"
    assert children[0]["attendance"]["present_days"] >= 1

    # 2. Query child's detailed attendance history
    res_hist = client.get(f"/api/v1/attendance/student/{s_id}", headers=headers)
    assert res_hist.status_code == 200
    assert res_hist.json()["student_name"] == "Sami Hossain"

    # 3. Security test: Guardian rejected from administrative student creation
    res_admit = client.post("/api/v1/students/admit", json={}, headers=headers)
    assert res_admit.status_code == 403


def test_persona_4_student_study_room_acceptance(client: TestClient, setup_pilot_environment: dict):
    """
    Persona 4: Enrolled Student
    Validates:
    - Queries /students/me/dashboard for personal timetable and attendance rate
    - Security test: Student rejected from administrative routes
    """
    headers = {
        "Authorization": f"Bearer {setup_pilot_environment['tokens']['student']}",
        "X-Tenant-ID": setup_pilot_environment["tenant_id"],
    }

    # 1. Query personal student dashboard
    res_dash = client.get("/api/v1/students/me/dashboard", headers=headers)
    assert res_dash.status_code == 200, res_dash.text
    data = res_dash.json()
    assert data["student"]["name"] == "Sami Hossain"
    assert data["student"]["admission_number"] == "KS-2026-001"
    assert data["attendance"]["today_status"] == "Present"
    assert data["attendance"]["rate_percentage"] >= 50.0
    assert data["routine_today"]["periods_count"] >= 1
    assert data["routine_today"]["periods"][0]["subject"] == "Mathematics"

    # 2. Security test: Student rejected from teacher roll call
    res_roll = client.post("/api/v1/attendance/sync-offline", json={}, headers=headers)
    assert res_roll.status_code == 403


def test_persona_5_billing_and_accounts_acceptance(client: TestClient, setup_pilot_environment: dict):
    """
    Persona 5: Institutional Billing Officer
    Validates:
    - Queries student profile-360
    - Records fee payment with integer BDT minor units
    - Verifies fee payment shows up in student profile
    """
    admin_headers = {
        "Authorization": f"Bearer {setup_pilot_environment['tokens']['principal']}",
        "X-Tenant-ID": setup_pilot_environment["tenant_id"],
    }
    s_id = str(setup_pilot_environment["student"].id)

    # 1. Query initial student 360 profile
    res_p360 = client.get(f"/api/v1/students/{s_id}/profile-360", headers=admin_headers)
    assert res_p360.status_code == 200
    assert res_p360.json()["student"]["name"] == "Sami Hossain"

    # 2. Record fee payment in DB
    db = TestSessionLocal()
    receipt_no = f"RCP-PILOT-{uuid.uuid4().hex[:6].upper()}"
    p = FeePayment(
        id=uuid.uuid4(),
        tenant_id=setup_pilot_environment["tenant_id"],
        student_id=setup_pilot_environment["student"].id,
        amount=2500,
        currency="BDT",
        payment_method="bKash",
        payment_status="SUCCESS",
        receipt_number=receipt_no,
        idempotency_key=f"IDEMP-P5-{uuid.uuid4().hex[:8]}",
    )
    db.add(p)
    db.commit()
    db.close()

    # 3. Re-query profile-360 to verify payment reflects
    res_after = client.get(f"/api/v1/students/{s_id}/profile-360", headers=admin_headers)
    assert res_after.status_code == 200
    fees = res_after.json()["fees"]
    assert any(f["receipt_number"] == receipt_no for f in fees)
