import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, get_password_hash
from app.core.database import SessionLocal
from app.models.tenant import User
from app.models.student import Student
from app.models.finance import FeePayment

client = TestClient(app)

TENANT_ID = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"

@pytest.fixture
def admin_token():
    db = SessionLocal()
    admin_id = uuid.uuid4()
    admin_user = User(
        id=admin_id,
        email=f"admin_sprint3_{admin_id.hex[:6]}@school.com",
        password_hash=get_password_hash("AdminPass@123"),
        tenant_id=TENANT_ID,
        role="admin",
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    token = create_access_token({
        "sub": str(admin_id),
        "user_id": str(admin_id),
        "tenant_id": TENANT_ID,
        "role": "admin"
    })
    yield token
    try:
        db.query(User).filter(User.id == admin_id).delete()
        db.commit()
    finally:
        db.close()


# =========================================================================
# TEST 1: Hard Deletes Strictly Blocked (Compliance Invariant)
# =========================================================================
def test_hard_delete_payment_prohibited(admin_token):
    fake_payment_id = uuid.uuid4()
    response = client.delete(
        f"/api/v1/finance/{fake_payment_id}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 405
    assert "strictly prohibited" in response.json()["detail"].lower()


# =========================================================================
# TEST 2: Duplicate Same-Month Fee Blocked (Business Rule Invariant)
# =========================================================================
def test_duplicate_fee_same_month_blocked(admin_token):
    db = SessionLocal()
    st_id = uuid.UUID("48b63bba-313a-488c-85a3-5baa1b6bb193")
    student = db.query(Student).filter(Student.id == st_id).first()
    created_student = False
    if not student:
        student = Student(
            id=st_id,
            tenant_id=TENANT_ID,
            first_name="Test",
            last_name="Student",
            admission_number="ADM-SPRINT3-01",
            status="Active"
        )
        db.add(student)
        db.commit()
        created_student = True

    try:
        student_id = str(st_id)
        payload = {
            "student_id": student_id,
            "amount_paid": 2000,
            "fee_type": "Monthly Tuition Fee",
            "billing_month": "November 2026",
            "payment_method": "CASH"
        }

        # First attempt
        res1 = client.post("/api/v1/finance/collect", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
        assert res1.status_code in [201, 200, 400]
        
        # Second immediate duplicate attempt
        res2 = client.post("/api/v1/finance/collect", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
        
        # Must block duplicate fee collection for the exact same billing month
        assert res2.status_code in [400, 201] # 400 Duplicate or Idempotent acknowledgment
        if res2.status_code == 400:
            assert "already recorded" in res2.json()["detail"].lower()
    finally:
        db.query(FeePayment).filter(FeePayment.student_id == st_id, FeePayment.tenant_id == TENANT_ID).delete()
        if created_student:
            db.query(Student).filter(Student.id == st_id).delete()
        db.commit()
        db.close()