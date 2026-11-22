# backend/tests/test_production_blueprint.py
"""
Automated Verification Test Suite for Production Blueprint:
1. Daily Attendance Zero-Honesty (No Historical Fallback Leak)
2. Phase 12 Operational Metric • Efficiency Engine Cumulative Savings
3. Workspace Isolation & Switcher (SchoolOS vs AcademyOS)
4. Commercial SaaS Billing, Tier Catalog, and Automated Gateway Checkout
5. AI Exam Engine Review & Publish Workflow
"""
import uuid
import datetime
from zoneinfo import ZoneInfo
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.tenant import Tenant, User
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.models.live_exam import LiveExam
from app.models.workspace import Workspace, WorkspaceType
from app.models.subscription import InstitutionSubscription

client = TestClient(app)

TENANT_TEST = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"
BD_TZ = ZoneInfo("Asia/Dhaka")

@pytest.fixture
def admin_token():
    db = SessionLocal()
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email=f"admin_bp_{admin_id.hex[:6]}@school.com",
        password_hash=get_password_hash("AdminPass@123"),
        tenant_id=TENANT_TEST,
        role="admin",
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    token = create_access_token({
        "sub": str(admin_id),
        "user_id": str(admin_id),
        "tenant_id": TENANT_TEST,
        "role": "admin"
    })
    yield token
    try:
        db.query(User).filter(User.id == admin_id).delete()
        db.commit()
    finally:
        db.close()

@pytest.fixture
def teacher_token():
    return create_access_token({
        "sub": "teacher_bp_01",
        "user_id": "teacher_bp_01",
        "tenant_id": TENANT_TEST,
        "role": "teacher"
    })


def test_dashboard_daily_attendance_zero_honesty():
    """
    Verifies that if yesterday had attendance submitted, but today NO attendance has been taken,
    the dashboard metrics endpoint strictly returns present_today=0 and absent_today=0.
    Ensures the old buggy fallback to previous days is completely eradicated.
    Uses an isolated tenant to guarantee no pre-existing same-day records interfere.
    """
    db = SessionLocal()
    isolated_tid = uuid.uuid4()
    isolated_tid_str = str(isolated_tid)
    adm_num = f"ADM-TEST-{uuid.uuid4().hex[:6]}"
    admin_id = uuid.uuid4()

    try:
        tenant = Tenant(
            id=isolated_tid,
            school_name="Zero Honesty Verification Academy",
            domain=f"zero-{isolated_tid.hex[:6]}.edu.bd",
            address="Dhaka, Bangladesh"
        )
        admin_user = User(
            id=admin_id,
            email=f"admin_zero_{admin_id.hex[:6]}@school.com",
            password_hash=get_password_hash("AdminPass@123"),
            tenant_id=isolated_tid,
            role="admin",
            is_active=True
        )
        db.add_all([tenant, admin_user])
        db.commit()

        token = create_access_token({
            "sub": str(admin_id),
            "user_id": str(admin_id),
            "tenant_id": isolated_tid_str,
            "role": "admin"
        })

        # Create student for this tenant
        student = Student(
            tenant_id=isolated_tid,
            first_name="Rahim",
            last_name="Uddin",
            admission_number=adm_num,
            class_name="Class 8",
            status="Active"
        )
        db.add(student)
        db.commit()
        db.refresh(student)

        # Insert historical attendance for YESTERDAY
        yesterday = datetime.datetime.now(BD_TZ).date() - datetime.timedelta(days=1)
        old_att = AttendanceEvent(
            tenant_id=isolated_tid_str,
            student_id=student.id,
            date=yesterday,
            status="Present",
            idempotency_key=f"att-{yesterday}-{student.id}"
        )
        db.add(old_att)
        db.commit()

        # Call GET /api/v1/dashboard/metrics
        res = client.get(
            "/api/v1/dashboard/metrics",
            headers={"Authorization": f"Bearer {token}", "X-Tenant-ID": isolated_tid_str}
        )
        assert res.status_code == 200, res.text
        data = res.json()

        # Assert present_today and absent_today are STRICTLY 0 because none was taken today
        assert data["present_today"] == 0, f"Expected 0 present today, got {data['present_today']}"
        assert data["absent_today"] == 0, f"Expected 0 absent today, got {data['absent_today']}"
        assert data["total_students"] >= 1
    finally:
        try:
            db.rollback()
            db.query(AttendanceEvent).filter(AttendanceEvent.tenant_id == isolated_tid_str).delete(synchronize_session=False)
            db.query(Student).filter(Student.tenant_id == isolated_tid).delete(synchronize_session=False)
            db.query(User).filter(User.id == admin_id).delete(synchronize_session=False)
            db.query(Tenant).filter(Tenant.id == isolated_tid).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        finally:
            db.close()


def test_operational_kpi_cumulative_efficiency_engine(admin_token):
    """
    Verifies Phase 12 Operational Metric • Efficiency Engine returns non-zero cumulative hours
    saved across attendance, AI blueprints, grading, and notices.
    """
    db = SessionLocal()
    adm_num = f"ADM-TEST-{uuid.uuid4().hex[:6]}"
    try:
        # Add a student
        student = Student(
            tenant_id=TENANT_TEST,
            first_name="Karim",
            last_name="Chowdhury",
            admission_number=adm_num,
            class_name="Class 9",
            status="Active"
        )
        db.add(student)
        db.commit()
        db.refresh(student)

        # Add 10 historical attendance events
        past_date = datetime.date(2026, 1, 10)
        for i in range(10):
            att = AttendanceEvent(
                tenant_id=TENANT_TEST,
                student_id=student.id,
                date=past_date + datetime.timedelta(days=i),
                status="Present",
                idempotency_key=f"kpi-att-{i}-{student.id}"
            )
            db.add(att)

        # Add 1 LiveExam blueprint
        now = datetime.datetime.now(datetime.timezone.utc)
        exam = LiveExam(
            tenant_id=TENANT_TEST,
            title="Physics Dynamics Test",
            total_marks=20.0,
            duration_minutes=30,
            start_time=now,
            end_time=now + datetime.timedelta(days=7),
            is_published=False,
            questions_payload=[{"id": "q1", "question": "Speed of light?", "options": ["3e8", "3e6", "1e5", "2e8"], "correct_option": "3e8"}]
        )
        db.add(exam)
        db.commit()

        # Fetch operational KPI
        res = client.get(
            "/api/v1/dashboard/operational-kpi",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200, res.text
        data = res.json()

        assert "total_hours_saved" in data
        assert "estimated_cost_saved_bdt" in data
        assert data["total_hours_saved"] > 0, "Cumulative hours saved must be greater than 0"
        assert data["estimated_cost_saved_bdt"] > 0
        assert data["breakdown"]["attendance_events"] >= 10
        assert data["breakdown"]["question_blueprints"] >= 1
    finally:
        db.rollback()
        db.query(AttendanceEvent).filter(AttendanceEvent.tenant_id == TENANT_TEST, AttendanceEvent.idempotency_key.like("kpi-att-%")).delete()
        db.query(LiveExam).filter(LiveExam.tenant_id == TENANT_TEST, LiveExam.title == "Physics Dynamics Test").delete()
        db.query(Student).filter(Student.tenant_id == TENANT_TEST, Student.admission_number == adm_num).delete()
        db.commit()
        db.close()


def test_workspaces_listing_and_switching(admin_token):
    """
    Verifies listing, active context, and switching between SchoolOS and AcademyOS workspaces.
    """
    # 1. List workspaces (auto-provisions School & Academy if not present)
    res = client.get(
        "/api/v1/workspaces",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 200, res.text
    workspaces = res.json()
    assert len(workspaces) >= 2
    types = [w["workspace_type"] for w in workspaces]
    assert "school" in types
    assert "academy" in types

    # 2. Get active workspace
    res_curr = client.get(
        "/api/v1/workspaces/current",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_curr.status_code == 200
    curr_data = res_curr.json()
    assert "id" in curr_data
    assert "workspace_type" in curr_data

    # 3. Switch to Academy workspace
    academy_ws = next(w for w in workspaces if w["workspace_type"] == "academy")
    res_switch = client.post(
        "/api/v1/workspaces/switch",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"workspace_id": academy_ws["id"]}
    )
    assert res_switch.status_code == 200
    switch_data = res_switch.json()
    assert switch_data["status"] == "SWITCHED"
    assert switch_data["workspace_type"] == "academy"


def test_saas_billing_plans_and_checkout(admin_token):
    """
    Verifies SaaS tier pricing catalog and checkout generation for bKash/Nagad/SSLCommerz.
    """
    # 1. List Plans
    res = client.get("/api/v1/billing/plans")
    assert res.status_code == 200
    catalog = res.json()["plans"]
    assert "school_starter" in catalog
    assert "school_growth" in catalog
    assert "academy_growth" in catalog
    assert "unified_growth" in catalog

    assert catalog["school_starter"]["price_bdt"] == 990
    assert catalog["school_growth"]["price_bdt"] == 2490
    assert catalog["academy_starter"]["price_bdt"] == 1490
    assert catalog["unified_growth"]["price_bdt"] == 4990

    # 2. Status
    res_status = client.get(
        "/api/v1/billing/status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["is_active"] is True
    assert "days_remaining" in status_data
    assert "quota" in status_data

    # 3. Checkout bKash
    res_checkout = client.post(
        "/api/v1/billing/checkout",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "plan_key": "school_growth",
            "gateway": "BKASH",
            "billing_cycle": "monthly"
        }
    )
    assert res_checkout.status_code == 200
    checkout_data = res_checkout.json()
    assert checkout_data["status"] == "CHECKOUT_CREATED"
    assert checkout_data["gross_amount"] == 2490
    assert checkout_data["payable_amount"] > 0
    assert "bkash" in checkout_data["checkout_url"].lower()


def test_question_paper_approval_lifecycle(admin_token):
    """
    Verifies that AI generated question papers start as unapproved/draft (is_published=False)
    and can be formally reviewed and published via POST /api/v1/question-papers/{paper_id}/approve.
    """
    db = SessionLocal()
    try:
        now = datetime.datetime.now(datetime.timezone.utc)
        exam = LiveExam(
            tenant_id=TENANT_TEST,
            title="Biology Botany Cell Division Test",
            total_marks=10.0,
            duration_minutes=20,
            start_time=now,
            end_time=now + datetime.timedelta(days=7),
            is_published=False,
            questions_payload=[{"id": "q1", "question": "In which stage do chromosomes align?", "options": ["Metaphase", "Prophase", "Anaphase", "Telophase"], "correct_option": "Metaphase"}]
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

        # Confirm starts as unpublished
        assert exam.is_published is False

        # Approve and publish
        res = client.post(
            f"/api/v1/question-papers/{exam.id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert res.status_code == 200, res.text
        appr_data = res.json()
        assert appr_data["status"] == "APPROVED_AND_PUBLISHED"
        assert appr_data["is_published"] is True

        # Check DB
        db.refresh(exam)
        assert exam.is_published is True
    finally:
        db.rollback()
        db.query(LiveExam).filter(LiveExam.tenant_id == TENANT_TEST, LiveExam.title == "Biology Botany Cell Division Test").delete()
        db.commit()
        db.close()

