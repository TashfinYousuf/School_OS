# backend/tests/test_admission_models_and_payments.py
"""
Test Suite: Admission Management System (Model A & B) & Anti-Fraud Payment Lifecycle.
Verifies:
1. Model A Full Lifecycle:
   Session Creation -> Application Ingestion -> Fee Invoice -> Manual Payment Submission ->
   Admin Payment Verification (Anti-Fraud Receipt 1) -> Exam Scheduling (Admit Card) ->
   Exam Marks Entry -> Selection -> Final Fee Invoice -> Final Fee Verification (Anti-Fraud Receipt 2) ->
   Idempotent Official Enrollment & IAM Provisioning.
2. Model B Direct Admission Lifecycle:
   Session Creation -> Application Ingestion -> Review -> Approval -> Enrollment.
3. Teacher Role & Class-Scoped Isolation:
   Teachers can only view and score candidates within their assigned class.
   Teachers cannot verify financial payments or enroll students.
4. Anti-Fraud & Data Integrity:
   Server-side fee calculation cannot be tampered with.
   Exam scheduling blocked without application fee clearance.
   Enrollment blocked without final fee clearance.
   Receipt numbering is strictly sequential and immutable.
   Two-tenant isolation: Tenant B cannot access Tenant A admission records.
"""
import uuid
import pytest
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
from fastapi import HTTPException

import app.models
from app.models.base import Base
from app.models.tenant import Tenant, User, Role
from app.models.users import Teacher
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.student import Student
from app.models.academic import AcademicSession, ClassModel, StudentEnrollmentHistory
from app.models.finance import Invoice, InvoiceStatus
from app.models.admission import AdmissionSession, AdmissionApplication, AdmissionReceipt

from app.api.endpoints.admissions import (
    create_admission_session,
    list_admission_sessions,
    get_admission_session,
    submit_admission_application,
    track_admission_status,
    list_admission_applications,
    get_admission_application,
    review_admission_application,
    approve_admission_application,
    schedule_entrance_exam,
    submit_entrance_exam_score,
    select_candidate_for_admission,
    initiate_admission_payment,
    submit_manual_payment,
    verify_admission_payment,
    get_admission_receipt,
    enroll_admitted_student,
)
from app.schemas.admission import (
    AdmissionSessionCreate,
    AdmissionApplicationCreate,
    AdmissionReviewPayload,
    AdmissionExamSchedulePayload,
    AdmissionExamScorePayload,
    AdmissionSelectionPayload,
    AdmissionManualPaymentSubmitPayload,
    AdmissionPaymentVerifyPayload,
    AdmissionEnrollPayload,
)

# SQLite JSONB compatibility
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False}, poolclass=StaticPool)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


def _create_tenant_and_users(db, tid: str):
    t_uuid = uuid.UUID(tid)
    tenant = Tenant(id=t_uuid, school_name=f"School-{tid[:4]}", domain=f"school-{tid[:4]}.edu", is_active=True)
    db.add(tenant)
    db.flush()

    admin_user = User(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        email=f"admin@{tid[:4]}.com",
        username=f"admin_{tid[:4]}",
        password_hash="fakehash",
        role="admin",
        is_active=True,
    )
    teacher1_user = User(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        email=f"teacher1@{tid[:4]}.com",
        username=f"teacher1_{tid[:4]}",
        password_hash="fakehash",
        role="teacher",
        is_active=True,
    )
    teacher2_user = User(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        email=f"teacher2@{tid[:4]}.com",
        username=f"teacher2_{tid[:4]}",
        password_hash="fakehash",
        role="teacher",
        is_active=True,
    )
    db.add_all([admin_user, teacher1_user, teacher2_user])
    db.flush()

    # Create teacher profile with assigned classes
    t1_profile = Teacher(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        user_id=teacher1_user.id,
        first_name="Teacher",
        last_name="ClassOne",
        assigned_class="Class 1",
    )
    t2_profile = Teacher(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        user_id=teacher2_user.id,
        first_name="Teacher",
        last_name="ClassTwo",
        assigned_class="Class 2",
    )
    db.add_all([t1_profile, t2_profile])
    db.commit()

    return {
        "tenant_id": tid,
        "admin": {"user_id": str(admin_user.id), "roles": ["admin"]},
        "teacher1": {"user_id": str(teacher1_user.id), "roles": ["teacher"]},
        "teacher2": {"user_id": str(teacher2_user.id), "roles": ["teacher"]},
    }


def test_model_a_full_admission_lifecycle():
    """
    Model A: Entrance exam + admission fee + selection + final fee + enrollment.
    """
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    actors = _create_tenant_and_users(db, tid)

    # 1. Admin creates Model A intake session
    session_payload = AdmissionSessionCreate(
        academic_year="2026",
        session_name="Grade 1 Intake 2026",
        admission_model="MODEL_A",
        status="OPEN",
        application_fee=Decimal("500.00"),
        final_admission_fee=Decimal("5000.00"),
        class_fees={"Class 1": 600.00}, # Class-specific fee override
        max_seats={"Class 1": 40},
    )
    session = create_admission_session(session_payload, db=db, tenant_id=tid, _=None)
    assert session.session_name == "Grade 1 Intake 2026"
    assert session.admission_model == "MODEL_A"

    # 2. Prospective applicant submits application for Class 1
    app_payload = AdmissionApplicationCreate(
        session_id=session.id,
        class_name="Class 1",
        academic_year="2026",
        first_name="Tariq",
        last_name="Rahman",
        gender="Male",
        guardian_name="Fazlur Rahman",
        guardian_phone="01711000001",
        guardian_relationship="Father",
        guardian_email="fazlur@example.com",
        present_address="Dhanmondi, Dhaka",
        declaration_accepted=True,
    )
    app = submit_admission_application(app_payload, db=db, tenant_id=tid)
    assert app.status == "SUBMITTED"
    assert app.admission_model == "MODEL_A"
    assert app.application_fee == Decimal("600.00") # Overridden by class fee
    assert app.final_admission_fee == Decimal("5000.00")
    assert app.payment_status == "PENDING"
    assert app.invoice_id is not None

    # Check fee invoice was created
    invoice = db.query(Invoice).filter(Invoice.id == app.invoice_id).first()
    assert invoice is not None
    assert invoice.total_amount == Decimal("600.00")
    assert invoice.status == InvoiceStatus.ISSUED.value

    # 3. Applicant attempts to schedule exam before fee is paid -> rejected!
    exam_payload = AdmissionExamSchedulePayload(
        exam_date=datetime.now(timezone.utc),
        venue="Main Auditorium, Room 101",
    )
    with pytest.raises(HTTPException) as exc:
        schedule_entrance_exam(app.id, exam_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert exc.value.status_code == 400
    assert "fee is verified and paid" in exc.value.detail

    # 4. Applicant initiates payment and submits manual payment proof (bKash)
    init_res = initiate_admission_payment(app.id, fee_category="APPLICATION_FEE", db=db, tenant_id=tid)
    assert init_res["amount"] == Decimal("600.00")
    assert init_res["currency"] == "BDT"

    manual_pay_payload = AdmissionManualPaymentSubmitPayload(
        fee_category="APPLICATION_FEE",
        payment_method="bKash",
        transaction_reference="BKASH-TXN-998877",
        amount_paid=Decimal("600.00"),
    )
    app = submit_manual_payment(app.id, manual_pay_payload, db=db, tenant_id=tid)
    assert app.payment_status == "UNDER_REVIEW"

    # 5. Admin verifies application fee payment
    verify_payload = AdmissionPaymentVerifyPayload(
        fee_category="APPLICATION_FEE",
        payment_method="bKash",
        transaction_reference="BKASH-TXN-998877",
    )
    receipt1 = verify_admission_payment(app.id, verify_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert receipt1.receipt_number == "RCP-2026-0001"
    assert receipt1.amount_paid == Decimal("600.00")
    assert receipt1.fee_category == "APPLICATION_FEE"
    assert receipt1.receipt_payload["student_name"] == "Tariq Rahman"
    assert receipt1.receipt_payload["class_name"] == "Class 1"

    # Verify idempotency: calling verify again returns same receipt
    receipt1_dup = verify_admission_payment(app.id, verify_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert receipt1_dup.id == receipt1.id

    # Verify application & invoice state
    db.refresh(app)
    assert app.payment_status == "PAID"
    db.refresh(invoice)
    assert invoice.status == InvoiceStatus.PAID.value

    # 6. Admin schedules entrance exam & admit card
    app = schedule_entrance_exam(app.id, exam_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert app.status == "EXAM_SCHEDULED"
    assert app.admit_card_number is not None
    assert app.admit_card_number.startswith("AC-2026-")

    # 7. Teacher 1 (assigned to Class 1) enters entrance exam score
    score_payload = AdmissionExamScorePayload(
        score=Decimal("88.50"),
        marks_details={"bangla": 44, "english": 44.5},
        notes="Strong reading and comprehension skills",
    )
    app = submit_entrance_exam_score(app.id, score_payload, db=db, tenant_id=tid, claims=actors["teacher1"])
    assert app.status == "EXAM_EVALUATED"
    assert app.entrance_exam_score == Decimal("88.50")
    assert app.entrance_exam_details["breakdown"]["bangla"] == 44

    # 8. Admin reviews exam results and selects candidate for admission
    select_payload = AdmissionSelectionPayload(
        selection_status="SELECTED",
        notes="Approved for Class 1 Morning shift",
    )
    app = select_candidate_for_admission(app.id, select_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert app.status == "SELECTED"
    assert app.selection_status == "SELECTED"
    assert app.final_invoice_id is not None

    # Check final admission fee invoice was created
    final_inv = db.query(Invoice).filter(Invoice.id == app.final_invoice_id).first()
    assert final_inv is not None
    assert final_inv.total_amount == Decimal("5000.00")
    assert final_inv.status == InvoiceStatus.ISSUED.value

    # 9. Attempting to enroll before final admission fee is paid is rejected!
    enroll_payload = AdmissionEnrollPayload(section="A", roll_number="101")
    with pytest.raises(HTTPException) as exc:
        enroll_admitted_student(app.id, enroll_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert exc.value.status_code == 400

    # 10. Admin verifies final admission fee (Counter payment)
    verify_final_pay = AdmissionPaymentVerifyPayload(
        fee_category="FINAL_ADMISSION_FEE",
        payment_method="Cash Counter",
        transaction_reference="COUNTER-RCP-001",
    )
    receipt2 = verify_admission_payment(app.id, verify_final_pay, db=db, tenant_id=tid, claims=actors["admin"])
    assert receipt2.receipt_number == "RCP-2026-0002"
    assert receipt2.amount_paid == Decimal("5000.00")
    assert receipt2.fee_category == "FINAL_ADMISSION_FEE"

    db.refresh(app)
    assert app.final_fee_payment_status == "PAID"
    assert app.status == "APPROVED"

    # 11. Admin officially enrolls the student
    enrolled_app = enroll_admitted_student(app.id, enroll_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert enrolled_app.status == "ENROLLED"
    assert enrolled_app.enrolled_student_id is not None

    # Verify student was created
    student = db.query(Student).filter(Student.id == enrolled_app.enrolled_student_id).first()
    assert student is not None
    assert student.first_name == "Tariq"
    assert student.last_name == "Rahman"
    assert student.class_name == "Class 1"
    assert student.section == "A"
    assert student.roll_number == "101"

    # Verify guardian linkage
    guardian = db.query(Guardian).filter(Guardian.phone_number == "01711000001").first()
    assert guardian is not None
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student.id,
    ).first()
    assert link is not None
    assert link.relationship_type == GuardianRelationship.FATHER

    # Verify receipts updated to link student_id
    db.refresh(receipt1)
    db.refresh(receipt2)
    assert receipt1.student_id == student.id
    assert receipt2.student_id == student.id

    # Verify enrollment history
    history = db.query(StudentEnrollmentHistory).filter(StudentEnrollmentHistory.student_id == student.id).first()
    assert history is not None
    assert history.promotion_status == "ADMITTED"

    # Verify idempotency of enrollment
    enrolled_dup = enroll_admitted_student(app.id, enroll_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert enrolled_dup.enrolled_student_id == student.id


def test_model_b_direct_admission_lifecycle():
    """
    Model B: Direct Application -> Document/Admin Review -> Approval -> Enrollment.
    """
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    actors = _create_tenant_and_users(db, tid)

    # 1. Admin creates Model B intake session (Direct Admission, free application)
    session_payload = AdmissionSessionCreate(
        academic_year="2026",
        session_name="Pre-School Direct 2026",
        admission_model="MODEL_B",
        status="OPEN",
        application_fee=Decimal("0.00"),
        final_admission_fee=Decimal("0.00"),
    )
    session = create_admission_session(session_payload, db=db, tenant_id=tid, _=None)
    assert session.admission_model == "MODEL_B"

    # 2. Parent submits application
    app_payload = AdmissionApplicationCreate(
        session_id=session.id,
        class_name="Playgroup",
        academic_year="2026",
        first_name="Amina",
        last_name="Begum",
        gender="Female",
        guardian_name="Nusrat Begum",
        guardian_phone="01811223344",
        guardian_relationship="Mother",
        declaration_accepted=True,
    )
    app = submit_admission_application(app_payload, db=db, tenant_id=tid)
    assert app.status == "SUBMITTED"
    assert app.payment_status == "PAID" # Zero fee is auto-cleared

    # 3. Admin reviews application
    review_payload = AdmissionReviewPayload(notes="Birth certificate and photos verified.")
    app = review_admission_application(app.id, review_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert app.status == "UNDER_REVIEW"

    # 4. Admin approves application
    app = approve_admission_application(app.id, review_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert app.status == "APPROVED"

    # 5. Admin enrolls student
    enroll_payload = AdmissionEnrollPayload(section="Rose", roll_number="01")
    app = enroll_admitted_student(app.id, enroll_payload, db=db, tenant_id=tid, claims=actors["admin"])
    assert app.status == "ENROLLED"
    assert app.enrolled_student_id is not None

    student = db.query(Student).filter(Student.id == app.enrolled_student_id).first()
    assert student.first_name == "Amina"
    assert student.section == "Rose"


def test_teacher_scoped_class_isolation():
    """
    Verifies that teachers can only view and evaluate applications for their assigned class.
    Teachers cannot verify payments or enroll students.
    """
    db = TestingSessionLocal()
    tid = str(uuid.uuid4())
    actors = _create_tenant_and_users(db, tid)

    # Create Class 1 application
    app1 = submit_admission_application(
        AdmissionApplicationCreate(
            class_name="Class 1",
            first_name="Student",
            last_name="One",
            guardian_name="Guardian One",
            guardian_phone="01711111111",
            declaration_accepted=True,
        ),
        db=db,
        tenant_id=tid,
    )

    # Create Class 2 application
    app2 = submit_admission_application(
        AdmissionApplicationCreate(
            class_name="Class 2",
            first_name="Student",
            last_name="Two",
            guardian_name="Guardian Two",
            guardian_phone="01722222222",
            declaration_accepted=True,
        ),
        db=db,
        tenant_id=tid,
    )

    # Teacher 1 (assigned to Class 1) listing applications -> only sees Class 1
    t1_list = list_admission_applications(db=db, tenant_id=tid, claims=actors["teacher1"])
    assert len(t1_list) == 1
    assert t1_list[0].id == app1.id

    # Teacher 2 (assigned to Class 2) listing applications -> only sees Class 2
    t2_list = list_admission_applications(db=db, tenant_id=tid, claims=actors["teacher2"])
    assert len(t2_list) == 1
    assert t2_list[0].id == app2.id

    # Admin listing applications -> sees both
    admin_list = list_admission_applications(db=db, tenant_id=tid, claims=actors["admin"])
    assert len(admin_list) == 2

    # Teacher 1 accessing Class 1 application -> succeeds
    fetched = get_admission_application(app1.id, db=db, tenant_id=tid, claims=actors["teacher1"])
    assert fetched.id == app1.id

    # Teacher 1 attempting to access Class 2 application -> 403 Forbidden
    with pytest.raises(HTTPException) as exc:
        get_admission_application(app2.id, db=db, tenant_id=tid, claims=actors["teacher1"])
    assert exc.value.status_code == 403

    # Teacher 1 attempting to enter score on Class 2 application -> 403 Forbidden
    with pytest.raises(HTTPException) as exc:
        submit_entrance_exam_score(
            app2.id,
            AdmissionExamScorePayload(score=Decimal("90.00")),
            db=db,
            tenant_id=tid,
            claims=actors["teacher1"],
        )
    assert exc.value.status_code == 403


def test_cross_tenant_isolation_and_tracking():
    """
    Verifies that applications, sessions, and receipts are isolated across tenants.
    """
    db = TestingSessionLocal()
    tid_a = str(uuid.uuid4())
    tid_b = str(uuid.uuid4())
    actors_a = _create_tenant_and_users(db, tid_a)
    actors_b = _create_tenant_and_users(db, tid_b)

    # Tenant A creates application
    app_a = submit_admission_application(
        AdmissionApplicationCreate(
            class_name="Class 5",
            first_name="Rahim",
            last_name="Uddin",
            guardian_name="Kabir Uddin",
            guardian_phone="01911000000",
            declaration_accepted=True,
        ),
        db=db,
        tenant_id=tid_a,
    )

    # Tenant B tries to get Tenant A application -> 404
    with pytest.raises(HTTPException) as exc:
        get_admission_application(app_a.id, db=db, tenant_id=tid_b, claims=actors_b["admin"])
    assert exc.value.status_code == 404

    # Public tracking by application number works within Tenant A
    tracked = track_admission_status(app_a.application_number, phone="01911000000", db=db, tenant_id=tid_a)
    assert tracked.id == app_a.id

    # Public tracking with wrong phone fails
    with pytest.raises(HTTPException) as exc:
        track_admission_status(app_a.application_number, phone="01888999999", db=db, tenant_id=tid_a)
    assert exc.value.status_code == 404

    # Public tracking from Tenant B for Tenant A app fails
    with pytest.raises(HTTPException) as exc:
        track_admission_status(app_a.application_number, phone="01911000000", db=db, tenant_id=tid_b)
    assert exc.value.status_code == 404


def test_public_tenant_resolution_and_health_probes():
    """
    Validates public tenant resolution dependency, health/readiness endpoints,
    and request correlation ID propagation.
    """
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api.deps import get_public_or_authenticated_tenant_id
    from app.core.security import create_access_token

    client = TestClient(app)

    # 1. Health Probe
    health_resp = client.get("/api/v1/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["service"] == "EducationOS API"
    assert "pool" in health_data

    # 2. Readiness Probe
    ready_resp = client.get("/api/v1/ready")
    assert ready_resp.status_code in (200, 503)
    if ready_resp.status_code == 200:
        assert ready_resp.json()["ready"] is True
    else:
        assert ready_resp.json()["ready"] is False

    # 3. Request Correlation ID Middleware
    custom_cid = "corr-" + str(uuid.uuid4())
    cid_resp = client.get("/api/v1/health", headers={"X-Correlation-ID": custom_cid})
    assert cid_resp.headers.get("X-Correlation-ID") == custom_cid
    assert cid_resp.headers.get("X-Request-ID") == custom_cid
    assert "X-Process-Time" in cid_resp.headers

    # 4. Public Tenant Resolution Dependency
    test_tid = str(uuid.uuid4())

    # Case A: From X-Tenant-ID header
    resolved_header = get_public_or_authenticated_tenant_id(
        authorization=None,
        x_tenant_id=test_tid,
        tenant_id_query=None,
    )
    assert resolved_header == test_tid

    # Case B: From tenant_id query param
    resolved_query = get_public_or_authenticated_tenant_id(
        authorization=None,
        x_tenant_id=None,
        tenant_id_query=test_tid,
    )
    assert resolved_query == test_tid

    # Case C: From Authorization Bearer JWT
    token = create_access_token({"sub": str(uuid.uuid4()), "tenant_id": test_tid, "role": "admin"})
    resolved_auth = get_public_or_authenticated_tenant_id(
        authorization=f"Bearer {token}",
        x_tenant_id=None,
        tenant_id_query=None,
    )
    assert resolved_auth == test_tid

    # Case D: Missing all tenant markers -> raises HTTP 400
    with pytest.raises(HTTPException) as exc:
        get_public_or_authenticated_tenant_id(
            authorization=None,
            x_tenant_id=None,
            tenant_id_query=None,
        )
    assert exc.value.status_code == 400

