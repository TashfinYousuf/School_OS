# backend/tests/test_stage09_institution_operations.py
"""
Stage 09: Institution & Academy Operations Test Suite
Verifies:
1. Admissions Application, Review, Approval, Rejection, and Idempotent Enrollment
2. Attendance Duplicate Prevention, Daily/Monthly Summaries, Correction Workflow
3. Examination Lifecycle, Post-Publication Edit Protection, Marks Validation
4. Deterministic Decimal GPA Calculation, NCTB Scale, Pass/Fail Invariants, Student/Guardian BOLA
5. Notice Multi-Channel Audience Filtering and Read Acknowledgement
6. Class Routine Conflict Engine (Teacher Collision, Room Collision, Class Period Collision)
7. Academy Batch Seat Capacity and Enrollment
"""
import uuid
import datetime
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models  # Registers all models with Base.metadata
from app.main import app
from app.models.base import Base
from app.models.admission import AdmissionApplication
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.attendance import AttendanceEvent
from app.models.approval import ApprovalTask
from app.models.exam import Exam, ExamResult
from app.models.result import StudentResult
from app.models.notice import Notice, NoticeAcknowledgement
from app.models.academic import ClassRoutine
from app.models.academy import AcademicProgram, AcademyBatch, BatchEnrollment
from app.models.tenant import Tenant, User
from app.models.finance import Invoice, InvoiceLineItem, FeePayment
from app.core.database import get_db as core_get_db
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
    require_roles,
)
from app.api.endpoints.results import calculate_nctb_grade_decimal

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

# Setup isolated SQLite test engine with StaticPool so all threads/sessions share memory
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
    """Wipes and recreates schema between test runs and ensures DB dependency override."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[deps_get_db] = get_test_db
    app.dependency_overrides[core_get_db] = get_test_db
    yield
    app.dependency_overrides.clear()


def override_auth_claims(role="admin", tenant_id="tenant-school-1", user_id=None):
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


# ========================================================================================
# 1. Admissions Domain
# ========================================================================================

def test_admission_application_submission_with_fee():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    payload = {
        "first_name": "Rahim",
        "last_name": "Uddin",
        "class_name": "Class 6",
        "academic_year": "2026",
        "date_of_birth": "2014-05-10",
        "gender": "Male",
        "blood_group": "B+",
        "guardian_name": "Karim Uddin",
        "guardian_relationship": "Father",
        "guardian_phone": "01711002233",
        "guardian_email": "karim@example.com",
        "address": "Nazrul Avenue, Cumilla",
        "application_fee": "500.00"
    }

    res = client.post("/api/v1/admissions/apply", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["application_number"].startswith("ADM-2026-")
    assert data["status"] == "SUBMITTED"
    assert data["invoice_id"] is not None
    assert Decimal(str(data["application_fee"])) == Decimal("500.00")


def test_admission_review_and_approval_workflow():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    # 1. Submit application
    submit_res = client.post("/api/v1/admissions/apply", json={
        "first_name": "Fatima",
        "last_name": "Zohra",
        "class_name": "Class 7",
        "academic_year": "2026",
        "guardian_name": "Ayesha Begum",
        "guardian_relationship": "Mother",
        "guardian_phone": "01811223344",
        "application_fee": "0.00"
    })
    app_id = submit_res.json()["id"]

    # 2. Review: SUBMITTED -> UNDER_REVIEW
    rev_res = client.post(f"/api/v1/admissions/{app_id}/review", json={"notes": "Documents verified."})
    assert rev_res.status_code == 200
    assert rev_res.json()["status"] == "UNDER_REVIEW"
    assert rev_res.json()["review_notes"] == "Documents verified."

    # 3. Approve: UNDER_REVIEW -> APPROVED
    appr_res = client.post(f"/api/v1/admissions/{app_id}/approve", json={"notes": "Principal approved."})
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "APPROVED"


def test_admission_rejection_workflow():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    submit_res = client.post("/api/v1/admissions/apply", json={
        "first_name": "Kamal",
        "last_name": "Hasan",
        "class_name": "Class 8",
        "academic_year": "2026",
        "guardian_name": "Jamal Hasan",
        "guardian_phone": "01999887766",
        "application_fee": "0.00"
    })
    app_id = submit_res.json()["id"]

    # Reject
    rej_res = client.post(f"/api/v1/admissions/{app_id}/reject", json={"rejection_reason": "Age limit exceeded."})
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"
    assert rej_res.json()["rejection_reason"] == "Age limit exceeded."


def test_admission_idempotent_enrollment():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    # Submit and approve
    submit_res = client.post("/api/v1/admissions/apply", json={
        "first_name": "Sakib",
        "last_name": "Al Hasan",
        "class_name": "Class 9",
        "academic_year": "2026",
        "guardian_name": "Mashrafe Mortaza",
        "guardian_phone": "01711223344",
        "application_fee": "0.00"
    })
    app_id = submit_res.json()["id"]

    client.post(f"/api/v1/admissions/{app_id}/review", json={})
    client.post(f"/api/v1/admissions/{app_id}/approve", json={})

    # Enroll
    enroll_res1 = client.post(f"/api/v1/admissions/{app_id}/enroll", json={"section": "Science-A", "roll_number": "01"})
    assert enroll_res1.status_code == 200
    data1 = enroll_res1.json()
    assert data1["status"] == "ENROLLED"
    student_id = data1["enrolled_student_id"]
    assert student_id is not None

    # Verify student and guardian exist in DB
    db = TestingSessionLocal()
    student = db.query(Student).filter(Student.id == uuid.UUID(student_id)).first()
    assert student is not None
    assert student.first_name == "Sakib"
    assert student.class_name == "Class 9"

    guardian = db.query(Guardian).filter(Guardian.phone_number == "01711223344").first()
    assert guardian is not None
    assert guardian.first_name == "Mashrafe"

    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student.id
    ).first()
    assert link is not None
    assert link.is_primary_contact in (True, "Yes")

    # Repeated enrollment call (Idempotency) must return existing state without duplicate students
    enroll_res2 = client.post(f"/api/v1/admissions/{app_id}/enroll", json={"section": "Science-A"})
    assert enroll_res2.status_code == 200
    assert enroll_res2.json()["enrolled_student_id"] == student_id

    total_students = db.query(Student).filter(Student.tenant_id == tid).count()
    assert total_students == 1
    db.close()


def test_admission_cross_tenant_isolation():
    client = TestClient(app)
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    # Create application in Tenant A
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_a
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tenant_a)

    res = client.post("/api/v1/admissions/apply", json={
        "first_name": "TenantA_Student",
        "last_name": "Test",
        "class_name": "Class 5",
        "academic_year": "2026",
        "guardian_name": "Guardian A",
        "guardian_phone": "01700000001",
        "application_fee": "0.00"
    })
    app_id_a = res.json()["id"]

    # Switch session to Tenant B and attempt to access / enroll Tenant A application
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_b
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tenant_b)

    get_res = client.get(f"/api/v1/admissions/{app_id_a}")
    assert get_res.status_code == 404

    enroll_res = client.post(f"/api/v1/admissions/{app_id_a}/enroll", json={})
    assert enroll_res.status_code == 404


# ========================================================================================
# 2. Attendance Domain
# ========================================================================================

def test_attendance_summary_calculation():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    today = datetime.date.today()
    db = TestingSessionLocal()

    # Create 4 students and attendance records
    s1 = Student(id=uuid.uuid4(), tenant_id=tid, first_name="A", last_name="1", admission_number="ADM-1", class_name="Class 10")
    s2 = Student(id=uuid.uuid4(), tenant_id=tid, first_name="B", last_name="2", admission_number="ADM-2", class_name="Class 10")
    s3 = Student(id=uuid.uuid4(), tenant_id=tid, first_name="C", last_name="3", admission_number="ADM-3", class_name="Class 10")
    s4 = Student(id=uuid.uuid4(), tenant_id=tid, first_name="D", last_name="4", admission_number="ADM-4", class_name="Class 10")
    db.add_all([s1, s2, s3, s4])

    ev1 = AttendanceEvent(tenant_id=tid, student_id=s1.id, class_id="Class 10", date=today, status="Present")
    ev2 = AttendanceEvent(tenant_id=tid, student_id=s2.id, class_id="Class 10", date=today, status="Absent")
    ev3 = AttendanceEvent(tenant_id=tid, student_id=s3.id, class_id="Class 10", date=today, status="Late")
    ev4 = AttendanceEvent(tenant_id=tid, student_id=s4.id, class_id="Class 10", date=today, status="Half_Day")
    db.add_all([ev1, ev2, ev3, ev4])
    db.commit()
    db.close()

    res = client.get(f"/api/v1/attendance/summary?class_name=Class 10&target_date={today.isoformat()}")
    assert res.status_code == 200
    data = res.json()
    assert data["total_records"] == 4
    assert data["present_count"] == 1
    assert data["absent_count"] == 1
    assert data["late_count"] == 1
    assert data["half_day_count"] == 1
    # 1 Present + 1 Late + 0.5 Half_Day = 2.5 / 4 = 62.5%
    assert data["attendance_rate_percentage"] == 62.5


def test_attendance_correction_request_and_approval():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    teacher_id = str(uuid.uuid4())
    admin_id = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid

    db = TestingSessionLocal()
    st = Student(id=uuid.uuid4(), tenant_id=tid, first_name="Nabil", last_name="Hasan", admission_number="ADM-5", class_name="Class 8")
    db.add(st)
    ev = AttendanceEvent(tenant_id=tid, student_id=st.id, class_id="Class 8", date=datetime.date.today(), status="Absent")
    db.add(ev)
    db.commit()
    event_id = ev.id
    db.close()

    # 1. Teacher submits correction request: Absent -> Present
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="teacher", tenant_id=tid, user_id=teacher_id)
    req_res = client.post("/api/v1/attendance/correction-request", json={
        "attendance_event_id": str(event_id),
        "requested_status": "Present",
        "reason": "Student arrived with permission slip."
    })
    assert req_res.status_code == 201
    task_id = req_res.json()["task_id"]

    # 2. Administrator reviews and approves correction
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="admin", tenant_id=tid, user_id=admin_id)
    appr_res = client.post(f"/api/v1/attendance/correction-approval/{task_id}", json={
        "action": "APPROVE",
        "review_notes": "Slip verified by office."
    })
    assert appr_res.status_code == 200
    assert appr_res.json()["new_status"] == "Present"

    # 3. Verify event is updated in database
    db2 = TestingSessionLocal()
    updated_ev = db2.query(AttendanceEvent).filter(AttendanceEvent.id == event_id).first()
    assert updated_ev.status == "Present"
    assert "Slip verified by office" in updated_ev.remarks
    db2.close()


# ========================================================================================
# 3. Examinations & Results Domain
# ========================================================================================

def test_exam_lifecycle_and_post_publication_edit_lock():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    db = TestingSessionLocal()
    st = Student(id=uuid.uuid4(), tenant_id=tid, first_name="Tariq", last_name="Zaman", admission_number="ADM-6", class_name="Class 10")
    db.add(st)
    db.commit()
    student_id = st.id
    db.close()

    # 1. Create Exam (SCHEDULED)
    create_res = client.post("/api/v1/exams/", json={
        "name": "Mid-Term Examination 2026",
        "term": "Mid-Term",
        "status": "SCHEDULED",
        "academic_year": "2026",
        "class_name": "Class 10",
        "subject": "Physics",
        "max_marks": 100.0,
        "pass_marks": 33.0
    })
    assert create_res.status_code == 201
    exam_id = create_res.json()["id"]

    # 2. Enter valid competency marks
    mark_res = client.post("/api/v1/exams/results/", json={
        "student_id": str(student_id),
        "exam_id": str(exam_id),
        "marks_obtained": 85.0,
        "grade": "A+"
    })
    assert mark_res.status_code == 201

    # 3. Publish Exam
    pub_res = client.post(f"/api/v1/exams/{exam_id}/status", json={"status": "PUBLISHED"})
    assert pub_res.status_code == 200
    assert pub_res.json()["status"] == "PUBLISHED"

    # 4. Attempt to edit marks on PUBLISHED exam -> Must fail with 403 Forbidden
    locked_res = client.post("/api/v1/exams/results/", json={
        "student_id": str(student_id),
        "exam_id": str(exam_id),
        "marks_obtained": 95.0
    })
    assert locked_res.status_code == 403
    assert "Modifications locked" in locked_res.json()["detail"]


def test_exam_marks_boundary_validation():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    db = TestingSessionLocal()
    st = Student(id=uuid.uuid4(), tenant_id=tid, first_name="A", last_name="B", admission_number="ADM-7", class_name="Class 9")
    ex = Exam(id=uuid.uuid4(), tenant_id=tid, name="Quiz", term="Term 1", status="IN_PROGRESS", max_marks=50.0)
    db.add_all([st, ex])
    db.commit()
    sid, eid = st.id, ex.id
    db.close()

    # Exceeds max marks (50.0)
    res = client.post("/api/v1/exams/results/", json={
        "student_id": str(sid),
        "exam_id": str(eid),
        "marks_obtained": 55.0
    })
    assert res.status_code == 422
    assert "Invalid marks" in res.json()["detail"]


def test_results_deterministic_decimal_gpa_and_pass_fail_invariants():
    # 1. Decimal calculation precision
    grade, gpa = calculate_nctb_grade_decimal(80.0)
    assert grade == "A+"
    assert gpa == Decimal("5.00")

    grade, gpa = calculate_nctb_grade_decimal(65.0)
    assert grade == "A-"
    assert gpa == Decimal("3.50")

    grade, gpa = calculate_nctb_grade_decimal(32.5)
    assert grade == "F"
    assert gpa == Decimal("0.00")

    # 2. Test Report Card Calculation via API
    client = TestClient(app)
    tid = str(uuid.uuid4())
    student_uuid = uuid.uuid4()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="admin", tenant_id=tid)

    db = TestingSessionLocal()
    st = Student(id=student_uuid, tenant_id=tid, first_name="Adnan", last_name="Sami", admission_number="ADM-8", class_name="Class 10")
    db.add(st)

    # 3 Subjects: Math (85 -> A+ 5.0), English (75 -> A 4.0), Bengali (65 -> A- 3.5)
    # Average GPA: (5.0 + 4.0 + 3.5) / 3 = 12.5 / 3 = 4.17
    r1 = StudentResult(tenant_id=tid, student_id=student_uuid, exam_term="Final 2026", class_name="Class 10", subject="Math", marks_obtained=85.0, grade="A+", grade_point=5.0, is_published=True)
    r2 = StudentResult(tenant_id=tid, student_id=student_uuid, exam_term="Final 2026", class_name="Class 10", subject="English", marks_obtained=75.0, grade="A", grade_point=4.0, is_published=True)
    r3 = StudentResult(tenant_id=tid, student_id=student_uuid, exam_term="Final 2026", class_name="Class 10", subject="Bengali", marks_obtained=65.0, grade="A-", grade_point=3.5, is_published=True)
    db.add_all([r1, r2, r3])
    db.commit()
    db.close()

    card_res = client.get(f"/api/v1/results/progress-card/{student_uuid}?exam_term=Final 2026")
    assert card_res.status_code == 200
    card = card_res.json()
    assert card["evaluation_status"] == "PASSED"
    assert card["gpa"] == 4.17
    assert card["final_grade"] == "A"
    assert card["total_marks"] == 225.0

    # 3. Fail-in-one-subject rule (GPA must collapse to 0.00 / FAILED)
    db2 = TestingSessionLocal()
    r4 = StudentResult(tenant_id=tid, student_id=student_uuid, exam_term="Final 2026", class_name="Class 10", subject="Physics", marks_obtained=25.0, grade="F", grade_point=0.0, is_published=True)
    db2.add(r4)
    db2.commit()
    db2.close()

    card_res2 = client.get(f"/api/v1/results/progress-card/{student_uuid}?exam_term=Final 2026")
    assert card_res2.status_code == 200
    card2 = card_res2.json()
    assert card2["evaluation_status"] == "FAILED"
    assert card2["gpa"] == 0.0
    assert card2["final_grade"] == "F"


def test_results_student_self_access_and_bola_protection():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    student_a = uuid.uuid4()
    student_b = uuid.uuid4()

    app.dependency_overrides[get_current_tenant_id] = lambda: tid

    db = TestingSessionLocal()
    st_a = Student(id=student_a, tenant_id=tid, first_name="Student", last_name="A", admission_number="ADM-A")
    st_b = Student(id=student_b, tenant_id=tid, first_name="Student", last_name="B", admission_number="ADM-B")
    r_b = StudentResult(tenant_id=tid, student_id=student_b, exam_term="Term 1", class_name="Class 8", subject="Math", marks_obtained=90.0, grade="A+", grade_point=5.0, is_published=True)
    db.add_all([st_a, st_b, r_b])
    db.commit()
    db.close()

    # Authenticate as Student A and attempt to access Student B's progress card -> Must fail with 403 Forbidden
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="student", tenant_id=tid, user_id=str(student_a))
    res = client.get(f"/api/v1/results/progress-card/{student_b}?exam_term=Term 1")
    assert res.status_code == 403
    assert "Forbidden" in res.json()["detail"]

    # Student A accessing their own report card is allowed
    res_own = client.get(f"/api/v1/results/progress-card/{student_a}?exam_term=Term 1")
    assert res_own.status_code == 200


# ========================================================================================
# 4. Notices & Communication Domain
# ========================================================================================

def test_notice_audience_filtering_and_acknowledgement():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    guardian_user_id = str(uuid.uuid4())

    app.dependency_overrides[get_current_tenant_id] = lambda: tid

    # Create 3 notices: ALL, PARENTS, TEACHERS
    db = TestingSessionLocal()
    n_all = Notice(id=uuid.uuid4(), tenant_id=tid, title="School Holiday", content="School closed Sunday.", target_audience="ALL", is_published=True)
    n_parents = Notice(id=uuid.uuid4(), tenant_id=tid, title="PTA Meeting", content="Meet at 10 AM.", target_audience="PARENTS", is_published=True)
    n_teachers = Notice(id=uuid.uuid4(), tenant_id=tid, title="Staff Strategy", content="Confidential agenda.", target_audience="TEACHERS", is_published=True)
    db.add_all([n_all, n_parents, n_teachers])
    db.commit()
    notice_all_id = n_all.id
    db.close()

    # Authenticate as Guardian: Must only see ALL and PARENTS (2 notices), never TEACHERS
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="guardian", tenant_id=tid, user_id=guardian_user_id)
    res = client.get("/api/v1/notices/")
    assert res.status_code == 200
    notices = res.json()
    assert len(notices) == 2
    titles = [n["title"] for n in notices]
    assert "School Holiday" in titles
    assert "PTA Meeting" in titles
    assert "Staff Strategy" not in titles

    # Acknowledge reading receipt
    ack_res = client.post(f"/api/v1/notices/{notice_all_id}/acknowledge")
    assert ack_res.status_code == 200
    assert ack_res.json()["message"] == "Notice receipt acknowledged successfully."


# ========================================================================================
# 5. Timetables & Routines Domain (Conflict Engine)
# ========================================================================================

def test_routine_conflict_engine():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="admin", tenant_id=tid)

    # 1. Create Base Routine Slot
    base_res = client.post("/api/v1/academic/routine", json={
        "class_name": "Class 8",
        "day_of_week": "Sunday",
        "period_number": "Period 1",
        "start_time": "09:00 AM",
        "end_time": "09:45 AM",
        "subject": "Mathematics",
        "teacher_name": "Dr. Shamsul Huda",
        "room_number": "Room 201"
    })
    assert base_res.status_code == 201

    # 2. Conflict Test: Teacher Collision (same teacher, same day & period, different class)
    c1 = client.post("/api/v1/academic/routine", json={
        "class_name": "Class 9",
        "day_of_week": "Sunday",
        "period_number": "Period 1",
        "start_time": "09:00 AM",
        "end_time": "09:45 AM",
        "subject": "Higher Math",
        "teacher_name": "Dr. Shamsul Huda",
        "room_number": "Room 205"
    })
    assert c1.status_code == 409
    assert "Teacher Conflict" in c1.json()["detail"]

    # 3. Conflict Test: Room Collision (same room, same day & period, different class)
    c2 = client.post("/api/v1/academic/routine", json={
        "class_name": "Class 10",
        "day_of_week": "Sunday",
        "period_number": "Period 1",
        "start_time": "09:00 AM",
        "end_time": "09:45 AM",
        "subject": "English",
        "teacher_name": "Farhana Yasmin",
        "room_number": "Room 201"
    })
    assert c2.status_code == 409
    assert "Room Conflict" in c2.json()["detail"]

    # 4. Conflict Test: Class Period Collision (same class already has a subject in Period 1)
    c3 = client.post("/api/v1/academic/routine", json={
        "class_name": "Class 8",
        "day_of_week": "Sunday",
        "period_number": "Period 1",
        "start_time": "09:00 AM",
        "end_time": "09:45 AM",
        "subject": "General Science",
        "teacher_name": "Farhana Yasmin",
        "room_number": "Room 202"
    })
    assert c3.status_code == 409
    assert "Class Schedule Conflict" in c3.json()["detail"]


# ========================================================================================
# 6. Academy & Batch Operations
# ========================================================================================

def test_academy_batch_seat_capacity_limit():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="admin", tenant_id=tid)

    # 1. Create Program and Batch with max capacity = 1
    prog_res = client.post("/api/v1/academy/programs", json={
        "name": "Engineering VIP Care",
        "target_exam": "BUET",
        "course_fee": 15000.0,
        "duration_months": 4
    })
    prog_id = prog_res.json()["id"]

    batch_res = client.post("/api/v1/academy/batches", json={
        "program_id": prog_id,
        "batch_name": "Batch Alpha",
        "shift_time": "08:00 AM",
        "days_schedule": "Sat, Mon",
        "max_seat_capacity": 1
    })
    batch_id = batch_res.json()["batch_id"]

    student_1 = uuid.uuid4()
    student_2 = uuid.uuid4()

    # 2. First enrollment succeeds
    e1 = client.post("/api/v1/academy/enroll", json={"student_id": str(student_1), "batch_id": batch_id})
    assert e1.status_code == 201

    # 3. Second enrollment exceeds capacity -> Must fail with 400 Bad Request
    e2 = client.post("/api/v1/academy/enroll", json={"student_id": str(student_2), "batch_id": batch_id})
    assert e2.status_code == 400
    assert "Batch is fully booked" in e2.json()["detail"]


def test_academic_grades_retrieval_and_creation():
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(role="admin", tenant_id=tid)

    # 1. GET /api/v1/academic/grades returns initial NCTB curriculum grades (Class 1-10)
    res = client.get("/api/v1/academic/grades")
    assert res.status_code == 200
    grades = res.json()
    assert len(grades) >= 10
    names = [g["name"] for g in grades]
    assert "Class 1" in names
    assert "Class 10" in names

    # 2. POST /api/v1/academic/grades creates a new grade level
    new_res = client.post("/api/v1/academic/grades", json={
        "name": "Class 11 - Science",
        "description": "Higher Secondary First Year"
    })
    assert new_res.status_code == 201
    created = new_res.json()
    assert created["name"] == "Class 11 - Science"
    assert created["description"] == "Higher Secondary First Year"

    # 3. Verify it is now in the list
    list_res = client.get("/api/v1/academic/grades")
    assert any(g["name"] == "Class 11 - Science" for g in list_res.json())

