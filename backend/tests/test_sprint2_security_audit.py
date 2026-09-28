import sys
from pathlib import Path

# Add root backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

TENANT_KIDS_SHINE = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"
TENANT_OTHER_INSTITUTE = "99999999-0000-0000-0000-000000000000"

@pytest.fixture
def kids_shine_admin_token():
    return create_access_token(
        data={"sub": "admin_1", "tenant_id": TENANT_KIDS_SHINE, "user_id": "admin_uuid_1", "role": "admin"}
    )

@pytest.fixture
def other_institute_admin_token():
    return create_access_token(
        data={"sub": "admin_2", "tenant_id": TENANT_OTHER_INSTITUTE, "user_id": "admin_uuid_2", "role": "admin"}
    )

@pytest.fixture
def teacher_token():
    return create_access_token(
        data={"sub": "teacher_1", "tenant_id": TENANT_KIDS_SHINE, "user_id": "teacher_uuid_1", "role": "teacher"}
    )


# =========================================================================
# TEST 1: Anti-IDOR Cross-Tenant Isolation Test
# =========================================================================
def test_cross_tenant_idor_blocked_with_404(other_institute_admin_token):
    """
    Attacker from Tenant B attempts to fetch Student from Tenant A (Kids Shine).
    MUST return 404 Not Found (Zero data leak).
    """
    fake_kids_shine_student_id = "48b63bba-313a-488c-85a3-5baa1b6bb193"

    response = client.get(
        f"/api/v1/students/{fake_kids_shine_student_id}",
        headers={"Authorization": f"Bearer {other_institute_admin_token}"}
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# =========================================================================
# TEST 2: Role Boundary Test (Teacher cannot mutate Finance)
# =========================================================================
def test_teacher_forbidden_from_fee_collection(teacher_token):
    """Teachers must be blocked with 403 Forbidden on financial mutations."""
    payload = {
        "student_id": "48b63bba-313a-488c-85a3-5baa1b6bb193",
        "amount_paid": 1500,
        "fee_type": "Monthly Tuition Fee",
        "billing_month": "October 2026",
        "payment_method": "CASH"
    }
    response = client.post(
        "/api/v1/finance/collect",
        headers={"Authorization": f"Bearer {teacher_token}"},
        json=payload
    )
    assert response.status_code == 403


# =========================================================================
# TEST 3: Invalid UUID Sanitization (Prevents SQL / 500 crash)
# =========================================================================
def test_malformed_uuid_returns_404(kids_shine_admin_token):
    """Malformed UUID path parameters must return 404/422 cleanly, never 500."""
    response = client.get(
        "/api/v1/students/not-a-valid-uuid-12345",
        headers={"Authorization": f"Bearer {kids_shine_admin_token}"}
    )
    assert response.status_code in [404, 422]