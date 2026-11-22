# backend/tests/test_owasp_top10_audit.py
"""
Comprehensive Automated Verification Test Suite for OWASP Top 10:2025 Findings (F1 - F10)
Validates access control, authentication, tenant isolation, concurrency, AI security, and cryptographic hygiene.
"""
import uuid
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import app
from app.core.database import SessionLocal
from app.core.security import create_access_token, get_password_hash
from app.models.student import Student
from app.models.tenant import User, SchoolProfile
from app.models.live_exam import LiveExam
from app.models.finance import FeePayment, PaymentMethod, PaymentStatus

client = TestClient(app)

TENANT_A = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"
TENANT_B = "22222222-2222-2222-2222-222222222222"

@pytest.fixture
def admin_token():
    db = SessionLocal()
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email=f"admin_{admin_id.hex[:6]}@school.com",
        password_hash=get_password_hash("AdminPass@123"),
        tenant_id=TENANT_A,
        role="admin",
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    token = create_access_token({
        "sub": str(admin_id),
        "user_id": str(admin_id),
        "tenant_id": TENANT_A,
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
        "sub": "teacher_user_01",
        "user_id": "teacher_user_01",
        "tenant_id": TENANT_A,
        "role": "teacher"
    })

@pytest.fixture
def student_token():
    return create_access_token({
        "sub": "student_user_01",
        "user_id": "student_user_01",
        "tenant_id": TENANT_A,
        "role": "student"
    })


# --------------------------------------------------------------------------
# F1: Body-supplied IDs resolved with strict tenant scope (OWASP A01)
# --------------------------------------------------------------------------
def test_f1_exam_result_dispatch_cross_tenant_is_404(teacher_token):
    """Verifies F1: Result dispatch cannot reference students or exams outside tenant."""
    foreign_student_id = str(uuid.uuid4())
    foreign_exam_id = str(uuid.uuid4())
    payload = {
        "exam_id": foreign_exam_id,
        "student_id": foreign_student_id,
        "score": 20.0,
        "total_marks": 25.0,
        "rank": 1
    }
    res = client.post(
        "/api/v1/academy/dispatch-result-sms",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json=payload
    )
    assert res.status_code == 404
    assert "Requested examination or student profile not found." in res.json()["detail"]


# --------------------------------------------------------------------------
# F2: Copilot financial redaction for non-admins (OWASP A01)
# --------------------------------------------------------------------------
def test_f2_copilot_financial_redaction_for_teacher(teacher_token):
    """Verifies F2: Financial revenue is redacted for non-admin roles in grounded-query."""
    with patch("app.api.endpoints.ai.ai_client") as mock_ai:
        mock_chat = MagicMock()
        mock_chat.send_message.return_value = MagicMock(text="Campus Status: Active students: 5. Operational metrics recorded.")
        mock_ai.chats.create.return_value = mock_chat

        res = client.post(
            "/api/v1/ai/grounded-query",
            headers={"Authorization": f"Bearer {teacher_token}"},
            json={"query": "What is our total revenue balance today?"}
        )
        assert res.status_code == 200
        # Check that prompt generated internally contains REDACTED and no revenue data
        sent_prompt = mock_chat.send_message.call_args[0][0]
        assert "REDACTED - INSUFFICIENT PRIVILEGE" in sent_prompt
        assert "Total Institutional Revenue: ৳" not in sent_prompt


def test_f2_copilot_role_gate_blocks_student(student_token):
    """Verifies F2: Students cannot query institutional copilot."""
    res = client.post(
        "/api/v1/ai/grounded-query",
        headers={"Authorization": f"Bearer {student_token}"},
        json={"query": "Show financial report"}
    )
    assert res.status_code == 403


# --------------------------------------------------------------------------
# F3: Attendance bulk-submit cross-tenant block (OWASP A01)
# --------------------------------------------------------------------------
def test_f3_bulk_attendance_cross_tenant_block(teacher_token):
    """Verifies F3: Submitting attendance for another tenant's student raises 422."""
    foreign_uuid = str(uuid.uuid4())
    payload = {
        "class_name": "Class 5",
        "attendance_date": "2026-10-21",
        "records": [{"student_id": foreign_uuid, "status": "Present"}]
    }
    res = client.post(
        "/api/v1/attendance/bulk-submit",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json=payload
    )
    assert res.status_code == 422
    assert "outside this institutional scope" in res.json()["detail"]


# --------------------------------------------------------------------------
# F4: Authentication enumeration oracle prevention (OWASP A07)
# --------------------------------------------------------------------------
def test_f4_guardian_login_enumeration_oracle_prevention():
    """Verifies F4: Unknown student vs wrong phone number return identical generic 401."""
    res1 = client.post("/api/v1/auth/guardian", json={
        "admission_number": "NON-EXISTENT-9999",
        "phone_number": "01700000000"
    })
    res2 = client.post("/api/v1/auth/guardian", json={
        "admission_number": "KS-2026-001",
        "phone_number": "01999999999"
    })
    assert res1.status_code == 401
    assert res2.status_code == 401
    assert res1.json()["detail"] == res2.json()["detail"]
    assert "Invalid admission number, credentials, or unauthorized access." in res1.json()["detail"]


def test_f4_student_login_enumeration_oracle_prevention():
    """Verifies F4: Unknown student admission ID returns generic 401 without existence leakage."""
    res = client.post("/api/v1/auth/student", json={
        "admission_number": "INVALID-ID-000",
        "password": "wrongpassword"
    })
    assert res.status_code == 401
    assert "Invalid admission number, credentials, or unauthorized access." in res.json()["detail"]


# --------------------------------------------------------------------------
# F5: Concurrency & Reversal Race Condition Guards (OWASP A06)
# --------------------------------------------------------------------------
def test_f5_duplicate_reversal_prevention(admin_token):
    """Verifies F5: Double reversal of the same fee payment is blocked with 409 Conflict."""
    db = SessionLocal()
    dummy_payment_id = uuid.uuid4()
    dummy_receipt = f"REC-TEST-{uuid.uuid4().hex[:6].upper()}"
    payment = FeePayment(
        id=dummy_payment_id,
        tenant_id=TENANT_A,
        student_id=str(uuid.uuid4()),
        amount=1500.0,
        currency="BDT",
        payment_method=PaymentMethod.CASH,
        payment_status=PaymentStatus.COMPLETED,
        receipt_number=dummy_receipt,
        idempotency_key=f"IDEMP-TEST-{dummy_payment_id}",
        is_reversed=True,  # Already reversed
        metadata_payload={}
    )
    try:
        db.add(payment)
        db.commit()

        # Attempt to reverse again
        res = client.post(
            "/api/v1/finance/reversal",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"payment_id": str(dummy_payment_id), "reason": "Accidental duplicate request"}
        )
        assert res.status_code == 409
        assert "already reversed" in res.json()["detail"].lower()
    finally:
        db.query(FeePayment).filter(FeePayment.id == dummy_payment_id).delete()
        db.commit()
        db.close()


# --------------------------------------------------------------------------
# F6: Prompt Injection Defense & AI Safety (OWASP A05 / LLM01)
# --------------------------------------------------------------------------
def test_f6_ai_mcq_exact_option_and_markup_rejection():
    """Verifies F6: ValidatedMCQ rejects markup vectors and inexact option matches."""
    from app.services.ai_gateway import ValidatedMCQ
    
    # 1. Exact match required
    with pytest.raises(ValueError, match="must be identical to one of the 4 options"):
        ValidatedMCQ(
            id="q_1",
            question="What is the unit of force?",
            options=["Newton", "Joule", "Watt", "Pascal"],
            correct_option="N",  # Prefix match rejected!
            explanation="Newton is the SI unit."
        )

    # 2. XSS and script vectors rejected
    with pytest.raises(ValueError, match="Disallowed markup or script vectors"):
        ValidatedMCQ(
            id="q_2",
            question="What is this? <script>alert(1)</script>",
            options=["A", "B", "C", "D"],
            correct_option="A",
            explanation="Explanation"
        )


# --------------------------------------------------------------------------
# F7: Inactive staff accounts cannot authenticate (OWASP A07)
# --------------------------------------------------------------------------
def test_f7_inactive_staff_login_blocked():
    """Verifies F7: Deactivated staff member receives 401 upon login attempt."""
    db = SessionLocal()
    test_email = f"deactivated_{uuid.uuid4().hex[:6]}@school.com"
    test_user = User(
        email=test_email,
        password_hash=get_password_hash("ValidPass@123"),
        tenant_id=TENANT_A,
        role="teacher",
        is_active=False  # Deactivated account
    )
    try:
        db.add(test_user)
        db.commit()

        res = client.post("/api/v1/auth/staff", json={
            "email": test_email,
            "password": "ValidPass@123"
        })
        assert res.status_code == 401
        assert "Invalid email or password." in res.json()["detail"]
    finally:
        db.query(User).filter(User.email == test_email).delete()
        db.commit()
        db.close()


# --------------------------------------------------------------------------
# F8: Cryptographic key strength enforcement (OWASP A04)
# --------------------------------------------------------------------------
def test_f8_settings_rejects_weak_secret():
    """Verifies F8: Pydantic configuration rejects the weak fallback secret."""
    from app.core.config import Settings
    with pytest.raises(ValueError, match="CRITICAL SECURITY FAILURE"):
        Settings(
            DATABASE_URL="postgresql://localhost/test",
            SECRET_KEY="educationos_secret_key_2026"
        )


# --------------------------------------------------------------------------
# F10: Central Tenant Guard session auto-filtering (OWASP A06)
# --------------------------------------------------------------------------
def test_f10_central_tenant_guard_filters_session():
    """Verifies F10: Queries executed with tenant_id in session info automatically filter."""
    db = SessionLocal()
    db.info["tenant_id"] = TENANT_B
    try:
        # Student count for Tenant B should be isolated
        students_b = db.query(Student).all()
        for s in students_b:
            assert str(s.tenant_id) == TENANT_B
    finally:
        db.close()
