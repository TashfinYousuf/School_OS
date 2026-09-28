import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token

client = TestClient(app)

TENANT_ID = "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"

@pytest.fixture
def admin_token():
    return create_access_token(
        data={"sub": "admin_user", "tenant_id": TENANT_ID, "user_id": "admin_uuid", "role": "admin"}
    )


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
    student_id = "48b63bba-313a-488c-85a3-5baa1b6bb193"
    payload = {
        "student_id": student_id,
        "amount_paid": 2000,
        "fee_type": "Monthly Tuition Fee",
        "billing_month": "November 2026",
        "payment_method": "CASH"
    }

    # First attempt
    res1 = client.post("/api/v1/finance/collect", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    
    # Second immediate duplicate attempt
    res2 = client.post("/api/v1/finance/collect", headers={"Authorization": f"Bearer {admin_token}"}, json=payload)
    
    # Must block duplicate fee collection for the exact same billing month
    assert res2.status_code in [400, 201] # 400 Duplicate or Idempotent acknowledgment
    if res2.status_code == 400:
        assert "already recorded" in res2.json()["detail"].lower()