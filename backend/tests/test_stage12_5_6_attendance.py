# backend/tests/test_stage12_5_6_attendance.py
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
from app.core.database import get_db as core_get_db
from app.api.deps import get_db as deps_get_db, get_current_tenant_id
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
def setup_attendance_fixture(db_session: Session):
    alpha_uuid = uuid.uuid4()
    beta_uuid = uuid.uuid4()
    tid_alpha = str(alpha_uuid)
    tid_beta = str(beta_uuid)

    t_alpha = Tenant(
        id=alpha_uuid,
        school_name="Attendance Alpha School",
        domain=f"alpha-att-{uuid.uuid4().hex[:6]}"
    )
    t_beta = Tenant(
        id=beta_uuid,
        school_name="Attendance Beta School",
        domain=f"beta-att-{uuid.uuid4().hex[:6]}"
    )
    db_session.add_all([t_alpha, t_beta])
    db_session.commit()

    # Admin Alpha
    admin_alpha = User(
        id=uuid.uuid4(),
        email=f"admin-{uuid.uuid4().hex[:4]}@alpha-att.com",
        password_hash=get_password_hash("AdminPass123!"),
        tenant_id=alpha_uuid,
        role="admin",
        is_active=True,
    )
    db_session.add(admin_alpha)
    db_session.commit()

    # Guardian Alpha
    g_user = User(
        id=uuid.uuid4(),
        email=f"parent-{uuid.uuid4().hex[:4]}@alpha-att.com",
        password_hash=get_password_hash("ParentPass123!"),
        tenant_id=alpha_uuid,
        role="guardian",
        is_active=True,
    )
    db_session.add(g_user)
    db_session.commit()

    guardian_alpha = Guardian(
        id=uuid.uuid4(),
        tenant_id=alpha_uuid,
        user_id=g_user.id,
        first_name="Rahim",
        last_name="Uddin",
        phone_number="01711223344",
        email=g_user.email,
    )
    db_session.add(guardian_alpha)
    db_session.commit()

    # Students in Alpha
    s1 = Student(
        id=uuid.uuid4(),
        tenant_id=alpha_uuid,
        first_name="Tariq",
        last_name="Uddin",
        admission_number=f"ADM-A1-{uuid.uuid4().hex[:4]}",
        class_name="Class 5",
        roll_number="01",
        status="Active",
    )
    s2 = Student(
        id=uuid.uuid4(),
        tenant_id=alpha_uuid,
        first_name="Sadia",
        last_name="Rahman",
        admission_number=f"ADM-A2-{uuid.uuid4().hex[:4]}",
        class_name="Class 5",
        roll_number="02",
        status="Active",
    )
    db_session.add_all([s1, s2])
    db_session.commit()

    # Link Guardian to Tariq
    link = GuardianStudentLink(
        id=uuid.uuid4(),
        tenant_id=alpha_uuid,
        guardian_id=guardian_alpha.id,
        student_id=s1.id,
        relationship_type=GuardianRelationship.FATHER,
        is_primary=True,
    )
    db_session.add(link)
    db_session.commit()

    # Student in Beta (for leak test)
    s_beta = Student(
        id=uuid.uuid4(),
        tenant_id=beta_uuid,
        first_name="Foreign",
        last_name="Student",
        admission_number=f"ADM-B1-{uuid.uuid4().hex[:4]}",
        class_name="Class 5",
        roll_number="01",
        status="Active",
    )
    db_session.add(s_beta)
    db_session.commit()

    # Attendance Records
    today = date.today()
    yesterday = today - timedelta(days=1)
    day_before = today - timedelta(days=2)

    events = [
        AttendanceEvent(
            id=uuid.uuid4(),
            tenant_id=tid_alpha,
            student_id=s1.id,
            class_id="Class 5",
            date=today,
            status="Present",
            check_in_time=datetime.now(),
            marked_by=str(admin_alpha.id),
        ),
        AttendanceEvent(
            id=uuid.uuid4(),
            tenant_id=tid_alpha,
            student_id=s1.id,
            class_id="Class 5",
            date=yesterday,
            status="Absent",
            remarks="Fever",
            marked_by=str(admin_alpha.id),
        ),
        AttendanceEvent(
            id=uuid.uuid4(),
            tenant_id=tid_alpha,
            student_id=s1.id,
            class_id="Class 5",
            date=day_before,
            status="Present",
            marked_by=str(admin_alpha.id),
        ),
        AttendanceEvent(
            id=uuid.uuid4(),
            tenant_id=tid_alpha,
            student_id=s2.id,
            class_id="Class 5",
            date=today,
            status="Absent",
            remarks="Family function",
            marked_by=str(admin_alpha.id),
        ),
        # Beta Event (Must never leak to Alpha queries)
        AttendanceEvent(
            id=uuid.uuid4(),
            tenant_id=tid_beta,
            student_id=s_beta.id,
            class_id="Class 5",
            date=today,
            status="Present",
            marked_by="foreign-admin",
        ),
    ]
    db_session.add_all(events)
    db_session.commit()

    admin_token = create_access_token(
        data={"sub": str(admin_alpha.id), "tenant_id": tid_alpha, "role": "admin"}
    )
    guardian_token = create_access_token(
        data={"sub": str(guardian_alpha.id), "tenant_id": tid_alpha, "role": "guardian"}
    )

    # Unlinked guardian
    unlinked_g = Guardian(
        id=uuid.uuid4(),
        tenant_id=alpha_uuid,
        first_name="Unlinked",
        last_name="Parent",
        phone_number="01800000000",
    )
    db_session.add(unlinked_g)
    db_session.commit()
    unlinked_guardian_token = create_access_token(
        data={"sub": str(unlinked_g.id), "tenant_id": tid_alpha, "role": "guardian"}
    )

    return {
        "tenant_id": tid_alpha,
        "admin_token": admin_token,
        "guardian_token": guardian_token,
        "unlinked_guardian_token": unlinked_guardian_token,
        "student_1": s1,
        "student_2": s2,
        "guardian": guardian_alpha,
        "today": today,
        "yesterday": yesterday,
    }


def test_list_attendance_records_filtering(client: TestClient, setup_attendance_fixture: dict):
    headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['admin_token']}",
        "X-Tenant-ID": setup_attendance_fixture["tenant_id"],
    }

    # 1. Query records for Class 5
    res = client.get("/api/v1/attendance/records?class_name=Class 5", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total"] == 4  # 4 in Alpha, 0 from Beta
    assert len(data["records"]) == 4

    # 2. Filter by status=Absent
    res_absent = client.get("/api/v1/attendance/records?class_name=Class 5&status=Absent", headers=headers)
    assert res_absent.status_code == 200
    absent_data = res_absent.json()
    assert absent_data["total"] == 2
    for r in absent_data["records"]:
        assert r["status"] == "Absent"

    # 3. Filter by date
    today_str = setup_attendance_fixture["today"].isoformat()
    res_today = client.get(f"/api/v1/attendance/records?start_date={today_str}&end_date={today_str}", headers=headers)
    assert res_today.status_code == 200
    today_data = res_today.json()
    assert today_data["total"] == 2  # s1 (Present) and s2 (Absent)


def test_student_attendance_history_and_idor(client: TestClient, setup_attendance_fixture: dict):
    s1_id = setup_attendance_fixture["student_1"].id
    s2_id = setup_attendance_fixture["student_2"].id
    tid = setup_attendance_fixture["tenant_id"]

    # 1. Admin querying s1
    admin_headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['admin_token']}",
        "X-Tenant-ID": tid,
    }
    res = client.get(f"/api/v1/attendance/student/{s1_id}", headers=admin_headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["student_name"] == "Tariq Uddin"
    assert data["total_working_days"] == 3
    assert data["present_days"] == 2
    assert data["absent_days"] == 1
    # 2/3 = 66.7%
    assert data["attendance_rate_percentage"] == 66.7
    assert len(data["records"]) == 3

    # 2. Linked guardian querying s1 (Authorized)
    guardian_headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['guardian_token']}",
        "X-Tenant-ID": tid,
    }
    res_g = client.get(f"/api/v1/attendance/student/{s1_id}", headers=guardian_headers)
    assert res_g.status_code == 200
    assert res_g.json()["student_id"] == str(s1_id)

    # 3. Linked guardian querying s2 (Unlinked student -> IDOR Guard must return 403)
    res_idor = client.get(f"/api/v1/attendance/student/{s2_id}", headers=guardian_headers)
    assert res_idor.status_code == 403, f"Expected 403 BOLA rejection, got {res_idor.status_code}"

    # 4. Unlinked guardian querying s1 -> 403 Forbidden
    unlinked_headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['unlinked_guardian_token']}",
        "X-Tenant-ID": tid,
    }
    res_unlinked = client.get(f"/api/v1/attendance/student/{s1_id}", headers=unlinked_headers)
    assert res_unlinked.status_code == 403


def test_absent_list_with_guardian_contacts(client: TestClient, setup_attendance_fixture: dict):
    headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['admin_token']}",
        "X-Tenant-ID": setup_attendance_fixture["tenant_id"],
    }

    # Query absentees for yesterday
    yesterday_str = setup_attendance_fixture["yesterday"].isoformat()
    res = client.get(f"/api/v1/attendance/absent-list?attendance_date={yesterday_str}", headers=headers)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["total_absent"] == 1
    absentee = data["absentees"][0]
    assert absentee["student_name"] == "Tariq Uddin"
    assert absentee["guardian_name"] == "Rahim Uddin"
    assert absentee["guardian_phone"] == "01711223344"
    assert absentee["remarks"] == "Fever"


def test_attendance_export_formats(client: TestClient, setup_attendance_fixture: dict):
    headers = {
        "Authorization": f"Bearer {setup_attendance_fixture['admin_token']}",
        "X-Tenant-ID": setup_attendance_fixture["tenant_id"],
    }

    # 1. Export as CSV
    res_csv = client.get("/api/v1/attendance/export?class_name=Class 5&format=csv", headers=headers)
    assert res_csv.status_code == 200
    assert "text/csv" in res_csv.headers.get("content-type", "")
    assert "attachment; filename=" in res_csv.headers.get("content-disposition", "")
    csv_text = res_csv.text
    assert "Date,Admission Number,Roll,Student Name,Class,Status" in csv_text
    assert "Tariq Uddin" in csv_text
    assert "Sadia Rahman" in csv_text

    # 2. Export as HTML Printable Report
    res_html = client.get("/api/v1/attendance/export?class_name=Class 5&format=html", headers=headers)
    assert res_html.status_code == 200
    assert "text/html" in res_html.headers.get("content-type", "")
    assert "<h1>Institutional Attendance Ledger</h1>" in res_html.text
    assert "Tariq Uddin" in res_html.text

    # 3. Export as JSON
    res_json = client.get("/api/v1/attendance/export?class_name=Class 5&format=json", headers=headers)
    assert res_json.status_code == 200
    items = res_json.json()
    assert len(items) == 4
