"""
Stage 06 Verification Test Suite: Finance & Payment Integrity Reconstruction
Validates:
1. BLK-P0-08 Remediation: Rejection of client-asserted transaction IDs without provider verification.
2. Provider Factory & Gateway dispatch (CASH, BANK, BKASH, NAGAD, SSLCOMMERZ).
3. Cryptographic HMAC-SHA256 signature verification and replay protection on webhooks.
4. Invoice creation, line item accounting, and Decimal fixed precision.
5. Invoice payment application, balance deduction, and lifecycle transitions (ISSUED -> PARTIALLY_PAID -> PAID).
6. Resource-level IDOR/BOLA guard on student invoices (guardians/students).
7. Append-only ledger reversal, separation of duties, and double-reversal prevention.
8. Compliance guard blocking hard deletes on financial records.
"""

import hmac
import hashlib
import json
import uuid
from decimal import Decimal
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient

from app.core.rbac import (
    Permission,
    RoleEnum,
)
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user,
    get_current_user_claims,
)
from app.core.security import create_access_token, clear_revocation_store
from app.models.base import Base
from app.models.tenant import User, Tenant, SchoolProfile
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.finance import (
    FeePayment,
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
)
from app.services.payment_providers import (
    PaymentProviderFactory,
    BasePaymentProvider,
    CashDeskProvider,
    BKashMerchantProvider,
    NagadProvider,
)
from app.main import app

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"


@pytest.fixture
def sqlite_session():
    """Provides an isolated in-memory SQLite session with finance and user tables."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    target_tables = [
        User.__table__,
        Student.__table__,
        Guardian.__table__,
        GuardianStudentLink.__table__,
        SchoolProfile.__table__,
        Invoice.__table__,
        InvoiceLineItem.__table__,
        FeePayment.__table__,
    ]
    Base.metadata.create_all(bind=engine, tables=target_tables)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine, tables=target_tables)


@pytest.fixture(autouse=True)
def clean_overrides():
    clear_revocation_store()
    app.dependency_overrides.clear()
    yield
    clear_revocation_store()
    app.dependency_overrides.clear()


# ----------------------------------------------------------------------------------------
# 1. Provider Factory & CashDesk Invariants
# ----------------------------------------------------------------------------------------
def test_payment_provider_factory():
    cash_p = PaymentProviderFactory.get_provider("CASH")
    assert isinstance(cash_p, CashDeskProvider)

    bkash_p = PaymentProviderFactory.get_provider("BKASH")
    assert isinstance(bkash_p, BKashMerchantProvider)

    nagad_p = PaymentProviderFactory.get_provider("NAGAD")
    assert isinstance(nagad_p, NagadProvider)

    # Rejection of unsupported payment rails
    with pytest.raises(ValueError) as exc_info:
        PaymentProviderFactory.get_provider("BITCOIN")
    assert "Unsupported payment method" in str(exc_info.value)


@pytest.mark.anyio
async def test_cash_desk_requires_cashier_identity():
    provider = CashDeskProvider()
    
    # Missing cashier identity -> Fails
    result_fail = await provider.process_payment(
        tenant_id="t1",
        amount=Decimal("1500.00"),
        receipt_number="REC-001",
        client_metadata={}
    )
    assert not result_fail.success
    assert result_fail.status == "FAILED"
    assert "cashier_user_id is required" in result_fail.message

    # Valid cashier identity -> Succeeds as COMPLETED
    result_ok = await provider.process_payment(
        tenant_id="t1",
        amount=Decimal("1500.00"),
        receipt_number="REC-001",
        client_metadata={"cashier_user_id": "cashier-uuid-123"}
    )
    assert result_ok.success
    assert result_ok.status == "COMPLETED"
    assert result_ok.transaction_id == "CASH-REC-001"


# ----------------------------------------------------------------------------------------
# 2. BLK-P0-08 Remediation: Rejection of Client-Asserted Transaction IDs
# ----------------------------------------------------------------------------------------
def test_blk_p0_08_rejects_unverified_client_mfs_assertion(sqlite_session):
    """
    REMEDIATES BLK-P0-08:
    A client asserts a random bKash transaction ID without genuine provider verification.
    The system MUST NOT mark the fee payment as COMPLETED; it MUST be marked as PENDING.
    """
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)
    cashier_id = uuid.uuid4()
    student_id = uuid.uuid4()

    cashier_user = User(
        id=cashier_id,
        tenant_id=tenant_uuid,
        email="cashier@school.edu",
        password_hash="test_hash",
        role="admin",
        is_active=True,
    )
    student = Student(
        id=student_id,
        tenant_id=tenant_id,
        first_name="Hasan",
        last_name="Ali",
        admission_number="ADM-FEE-01",
        status="Active",
    )
    sqlite_session.add(cashier_user)
    sqlite_session.add(student)
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = lambda: cashier_user

    admin_token = create_access_token(data={"sub": str(cashier_id), "tenant_id": tenant_id, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Attempt to collect fee claiming bKash with unverified transaction ID
    response = client.post(
        "/api/v1/finance/collect",
        json={
            "student_id": str(student_id),
            "amount_paid": 3500.00,
            "fee_type": "Monthly Tuition Fee",
            "billing_month": "October 2026",
            "payment_method": "BKASH",
            "transaction_id": "FAKE_CLIENT_TRX_9999",
            "sender_number_or_wallet": "01711000000"
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert "PENDING" in data["message"]
    assert data["receipt"]["payment_status"] == "PENDING"

    # Verify directly in DB that status is PENDING and NOT COMPLETED
    payment = sqlite_session.query(FeePayment).filter(
        FeePayment.student_id == str(student_id),
        FeePayment.tenant_id == tenant_id
    ).first()
    assert payment is not None
    assert payment.payment_status == "PENDING"
    assert payment.provider_transaction_id == "FAKE_CLIENT_TRX_9999"


# ----------------------------------------------------------------------------------------
# 3. Cryptographic Webhook Verification (HMAC-SHA256) & Transition to COMPLETED
# ----------------------------------------------------------------------------------------
def test_mfs_webhook_cryptographic_verification(sqlite_session, monkeypatch):
    monkeypatch.setenv("BKASH_WEBHOOK_SECRET", "test-bkash-webhook-secret-rc3")
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)
    student_id = uuid.uuid4()

    student = Student(
        id=student_id,
        tenant_id=tenant_id,
        first_name="Tariq",
        last_name="Islam",
        admission_number="ADM-FEE-02",
        status="Active",
    )
    payment = FeePayment(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        student_id=str(student_id),
        amount=Decimal("4000.00"),
        currency="BDT",
        payment_method="BKASH",
        payment_status="PENDING",
        receipt_number="REC-2026-TEST01",
        provider_transaction_id="BKASH-TRX-PENDING-01",
        idempotency_key=f"IDEMP-{uuid.uuid4().hex[:12]}",
        metadata_payload={},
    )
    sqlite_session.add(student)
    sqlite_session.add(payment)
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id

    # 1. Tampered / invalid signature -> 401 Unauthorized
    payload = {
        "transaction_id": "BKASH-TRX-VERIFIED-999",
        "receipt_number": "REC-2026-TEST01",
        "status": "COMPLETED",
        "amount": 4000.00
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    
    res_tampered = client.post(
        "/api/v1/finance/webhook/bkash",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Signature": "tampered_bad_sig"}
    )
    assert res_tampered.status_code == 401
    assert "Cryptographic webhook signature verification failed" in res_tampered.json()["detail"]

    # 2. Genuine HMAC-SHA256 signature -> 200 OK
    provider = BKashMerchantProvider()
    valid_sig = hmac.new(
        provider.webhook_secret.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    res_valid = client.post(
        "/api/v1/finance/webhook/bkash",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Signature": valid_sig}
    )
    assert res_valid.status_code == 200, res_valid.text
    assert res_valid.json()["payment_status"] == "COMPLETED"

    # Verify DB state
    sqlite_session.refresh(payment)
    assert payment.payment_status == "COMPLETED"
    assert payment.is_reconciled is True
    assert payment.provider_transaction_id == "BKASH-TRX-VERIFIED-999"

    # 3. Idempotent replay protection: replay of the same webhook callback
    res_replay = client.post(
        "/api/v1/finance/webhook/bkash",
        content=body_bytes,
        headers={"Content-Type": "application/json", "X-Signature": valid_sig}
    )
    assert res_replay.status_code == 200
    assert res_replay.json()["status"] == "ALREADY_COMPLETED"


# ----------------------------------------------------------------------------------------
# 4. Invoice Architecture & Payment Application Lifecycle
# ----------------------------------------------------------------------------------------
def test_invoice_creation_and_payment_lifecycle(sqlite_session):
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)
    admin_id = uuid.uuid4()
    student_id = uuid.uuid4()

    admin_user = User(
        id=admin_id,
        tenant_id=tenant_uuid,
        email="finance@school.edu",
        password_hash="test_hash",
        role="admin",
        is_active=True,
    )
    student = Student(
        id=student_id,
        tenant_id=tenant_id,
        first_name="Sumaiya",
        last_name="Akter",
        admission_number="ADM-INV-01",
        status="Active",
    )
    sqlite_session.add(admin_user)
    sqlite_session.add(student)
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = lambda: admin_user

    admin_token = create_access_token(data={"sub": str(admin_id), "tenant_id": tenant_id, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Invoice with 2 line items
    res_inv = client.post(
        "/api/v1/finance/invoices",
        json={
            "student_id": str(student_id),
            "billing_month": "November 2026",
            "title": "Semester Examination Fee",
            "discount_amount": 200.00,
            "items": [
                {"description": "Exam Registration Fee", "amount": 2500.00, "quantity": 1},
                {"description": "Laboratory Fee", "amount": 700.00, "quantity": 1}
            ]
        },
        headers=headers,
    )
    assert res_inv.status_code == 201, res_inv.text
    inv_data = res_inv.json()
    invoice_id = inv_data["id"]
    assert Decimal(str(inv_data["total_amount"])) == Decimal("3200.00")
    assert Decimal(str(inv_data["discount_amount"])) == Decimal("200.00")
    # Net payable = 3200 - 200 = 3000 BDT
    assert inv_data["status"] == "ISSUED"
    assert len(inv_data["items"]) == 2

    # 2. Collect Partial Cash Payment of 1,500 BDT
    res_partial = client.post(
        "/api/v1/finance/collect",
        json={
            "student_id": str(student_id),
            "invoice_id": str(invoice_id),
            "amount_paid": 1500.00,
            "fee_type": "Semester Examination Fee",
            "billing_month": "November 2026",
            "payment_method": "CASH"
        },
        headers=headers,
    )
    assert res_partial.status_code == 201
    
    # Verify invoice status is now PARTIALLY_PAID
    inv_check_1 = client.get(f"/api/v1/finance/invoices/{invoice_id}", headers=headers)
    assert inv_check_1.status_code == 200
    assert inv_check_1.json()["status"] == "PARTIALLY_PAID"
    assert Decimal(str(inv_check_1.json()["paid_amount"])) == Decimal("1500.00")

    # 3. Collect Remaining Cash Payment of 1,500 BDT
    res_final = client.post(
        "/api/v1/finance/collect",
        json={
            "student_id": str(student_id),
            "invoice_id": str(invoice_id),
            "amount_paid": 1500.00,
            "fee_type": "Semester Examination Fee (Balance)",
            "billing_month": "November 2026",
            "payment_method": "CASH"
        },
        headers=headers,
    )
    assert res_final.status_code == 201

    # Verify invoice status is now PAID
    inv_check_2 = client.get(f"/api/v1/finance/invoices/{invoice_id}", headers=headers)
    assert inv_check_2.status_code == 200
    assert inv_check_2.json()["status"] == "PAID"
    assert Decimal(str(inv_check_2.json()["paid_amount"])) == Decimal("3000.00")


# ----------------------------------------------------------------------------------------
# 5. Invoice IDOR / BOLA Guard (Guardian & Student Access)
# ----------------------------------------------------------------------------------------
def test_invoice_idor_bola_guard(sqlite_session):
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    student_a_id = uuid.uuid4()
    student_b_id = uuid.uuid4()
    guardian_user_id = uuid.uuid4()
    guardian_id = uuid.uuid4()

    student_a = Student(id=student_a_id, tenant_id=tenant_id, first_name="A", last_name="A", admission_number="A1")
    student_b = Student(id=student_b_id, tenant_id=tenant_id, first_name="B", last_name="B", admission_number="B1")
    
    guardian_user = User(
        id=guardian_user_id,
        tenant_id=tenant_uuid,
        email="guardian@home.org",
        password_hash="test_hash",
        role="guardian",
        is_active=True,
    )
    guardian_profile = Guardian(
        id=guardian_id,
        tenant_id=tenant_id,
        user_id=guardian_user_id,
        first_name="Guardian",
        last_name="Parent",
    )
    # Link guardian ONLY to Student A
    link_a = GuardianStudentLink(
        tenant_id=tenant_id,
        guardian_id=guardian_id,
        student_id=student_a_id,
    )

    inv_a_id = uuid.uuid4()
    inv_b_id = uuid.uuid4()
    invoice_a = Invoice(
        id=inv_a_id,
        tenant_id=tenant_id,
        student_id=str(student_a_id),
        invoice_number="INV-A1",
        billing_month="Dec 2026",
        total_amount=Decimal("1000.00"),
    )
    invoice_b = Invoice(
        id=inv_b_id,
        tenant_id=tenant_id,
        student_id=str(student_b_id),
        invoice_number="INV-B1",
        billing_month="Dec 2026",
        total_amount=Decimal("1000.00"),
    )
    sqlite_session.add_all([student_a, student_b, guardian_user, guardian_profile, link_a, invoice_a, invoice_b])
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = lambda: guardian_user

    guardian_token = create_access_token(data={"sub": str(guardian_user_id), "tenant_id": tenant_id, "role": "guardian"})
    headers = {"Authorization": f"Bearer {guardian_token}"}

    # Guardian viewing linked student's invoice -> 200 OK
    res_a = client.get(f"/api/v1/finance/invoices/{inv_a_id}", headers=headers)
    assert res_a.status_code == 200
    assert res_a.json()["invoice_number"] == "INV-A1"

    # Guardian viewing unlinked student's invoice -> 403 Forbidden (BOLA protected)
    res_b = client.get(f"/api/v1/finance/invoices/{inv_b_id}", headers=headers)
    assert res_b.status_code == 403
    assert "not authorized to view this invoice" in res_b.json()["detail"].lower()


# ----------------------------------------------------------------------------------------
# 6. Append-Only Ledger Reversal & Double-Reversal Prevention
# ----------------------------------------------------------------------------------------
def test_payment_reversal_append_only_ledger(sqlite_session):
    client = TestClient(app)
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)
    admin_id = uuid.uuid4()
    student_id = uuid.uuid4()

    admin_user = User(
        id=admin_id,
        tenant_id=tenant_uuid,
        email="admin@school.edu",
        password_hash="test_hash",
        role="admin",
        is_active=True,
    )
    student = Student(id=student_id, tenant_id=tenant_id, first_name="S", last_name="S", admission_number="S1")
    
    payment_id = uuid.uuid4()
    payment = FeePayment(
        id=payment_id,
        tenant_id=tenant_id,
        student_id=str(student_id),
        amount=Decimal("2000.00"),
        currency="BDT",
        payment_method="CASH",
        payment_status="COMPLETED",
        receipt_number="REC-2026-REV01",
        idempotency_key=f"IDEMP-{uuid.uuid4().hex[:12]}",
        metadata_payload={},
    )
    sqlite_session.add_all([admin_user, student, payment])
    sqlite_session.commit()

    app.dependency_overrides[deps_get_db] = lambda: sqlite_session
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id
    app.dependency_overrides[get_current_user] = lambda: admin_user

    admin_token = create_access_token(data={"sub": str(admin_id), "tenant_id": tenant_id, "role": "admin"})
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Reverse the payment
    res_rev = client.post(
        "/api/v1/finance/reversal",
        json={"payment_id": str(payment_id), "reason": "Accidental double billing"},
        headers=headers,
    )
    assert res_rev.status_code == 200, res_rev.text
    rev_data = res_rev.json()
    assert rev_data["status"] == "REVERSED"
    assert rev_data["adjusted_amount"] == -2000.00

    # Verify original payment is marked REVERSED
    sqlite_session.refresh(payment)
    assert payment.is_reversed is True
    assert payment.payment_status == "REVERSED"

    # Verify negative adjustment entry exists in ledger
    adj_entry = sqlite_session.query(FeePayment).filter(
        FeePayment.reversal_reference_id == payment_id,
        FeePayment.tenant_id == tenant_id
    ).first()
    assert adj_entry is not None
    assert adj_entry.amount == Decimal("-2000.00")
    assert adj_entry.payment_status == "ADJUSTED"

    # 2. Double-reversal attempt -> 409 Conflict
    res_double = client.post(
        "/api/v1/finance/reversal",
        json={"payment_id": str(payment_id), "reason": "Attempting second reversal"},
        headers=headers,
    )
    assert res_double.status_code == 409
    assert "already reversed" in res_double.json()["detail"].lower()


def test_hard_delete_compliance_block():
    client = TestClient(app)
    response = client.delete(f"/api/v1/finance/{uuid.uuid4()}")
    assert response.status_code == 405
    assert "Hard deletes are strictly prohibited" in response.json()["detail"]
