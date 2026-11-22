# backend/tests/test_trial_and_manual_payment.py
import datetime
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from starlette.testclient import TestClient
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

from app.main import app
from app.api.deps import get_db as deps_get_db, get_current_tenant_id
from app.core.database import get_db as core_get_db
from app.core.security import get_password_hash, create_access_token, clear_revocation_store
from app.models.base import Base
from app.models.tenant import Tenant, User
from app.models.student import Student
from app.models.subscription import InstitutionSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.billing import (
    BillingInvoice,
    BillingInvoiceLineItem,
    BillingAuditLog,
    TenantEntitlement,
    BillingWebhookEvent,
)

client = TestClient(app)


@pytest.fixture
def sqlite_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    target_tables = [
        Tenant.__table__,
        User.__table__,
        Student.__table__,
        InstitutionSubscription.__table__,
        SubscriptionPayment.__table__,
        BillingInvoice.__table__,
        BillingInvoiceLineItem.__table__,
        BillingAuditLog.__table__,
        TenantEntitlement.__table__,
        BillingWebhookEvent.__table__,
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


@pytest.fixture
def billing_fixture(sqlite_db):
    tenant_uuid = uuid.uuid4()
    tenant_id = str(tenant_uuid)

    tenant = Tenant(
        id=tenant_uuid,
        school_name="Trial & Billing Test Academy",
        domain=f"billing-{uuid.uuid4().hex[:6]}.edu.bd",
        address="Dhaka, Bangladesh"
    )
    sqlite_db.add(tenant)

    # 1. Admin User (Tenant Customer)
    admin_id = uuid.uuid4()
    admin = User(
        id=admin_id,
        tenant_id=tenant_uuid,
        email=f"admin-{uuid.uuid4().hex[:6]}@billing.edu.bd",
        password_hash=get_password_hash("AdminPass123!"),
        role="admin",
        is_active=True,
        first_name="School",
        last_name="Principal"
    )
    sqlite_db.add(admin)

    # 2. Superadmin User (Platform Operations)
    superadmin_id = uuid.uuid4()
    superadmin = User(
        id=superadmin_id,
        tenant_id=tenant_uuid,
        email=f"superadmin-{uuid.uuid4().hex[:6]}@schoolos.internal",
        password_hash=get_password_hash("SuperPass123!"),
        role="superadmin",
        is_active=True,
        first_name="Platform",
        last_name="Ops"
    )
    sqlite_db.add(superadmin)

    # 3. 30-Day Free Trial Subscription
    now = datetime.datetime.now(datetime.timezone.utc)
    sub = InstitutionSubscription(
        tenant_id=tenant_id,
        plan_tier="free_trial",
        workspace_scope="school",
        monthly_fee=0.0,
        billing_cycle="monthly",
        max_active_students=50,
        ai_question_quota_monthly=30,
        ai_questions_used_this_month=0,
        valid_until=now + datetime.timedelta(days=30),
        subscription_status="ACTIVE"
    )
    sqlite_db.add(sub)
    sqlite_db.commit()

    # Overrides
    app.dependency_overrides[deps_get_db] = lambda: sqlite_db
    app.dependency_overrides[core_get_db] = lambda: sqlite_db
    app.dependency_overrides[get_current_tenant_id] = lambda: tenant_id

    admin_token = create_access_token(data={"sub": str(admin_id), "user_id": str(admin_id), "tenant_id": tenant_id, "role": "admin"})
    superadmin_token = create_access_token(data={"sub": str(superadmin_id), "user_id": str(superadmin_id), "tenant_id": tenant_id, "role": "superadmin"})

    return {
        "tenant_id": tenant_id,
        "admin_id": str(admin_id),
        "admin_token": admin_token,
        "superadmin_id": str(superadmin_id),
        "superadmin_token": superadmin_token,
        "sub_id": str(sub.id)
    }


def test_trial_status_calculation(billing_fixture):
    data = billing_fixture
    headers = {
        "Authorization": f"Bearer {data['admin_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    res = client.get("/api/v1/billing/status", headers=headers)
    assert res.status_code == 200
    res_data = res.json()
    assert res_data["status"] == "success"
    assert res_data["is_active"] is True
    assert res_data["is_trial"] is True
    assert res_data["days_remaining"] >= 28
    assert "quota" in res_data
    assert res_data["quota"]["max_students"] == 50


def test_checkout_and_manual_claim_workflow(billing_fixture):
    data = billing_fixture
    headers = {
        "Authorization": f"Bearer {data['admin_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Initiate checkout intent for Growth tier
    checkout_res = client.post(
        "/api/v1/billing/checkout",
        headers=headers,
        json={
            "plan_key": "school_growth",
            "gateway": "BKASH",
            "billing_cycle": "monthly"
        }
    )
    assert checkout_res.status_code == 200
    checkout_data = checkout_res.json()
    assert checkout_data["status"] == "CHECKOUT_CREATED"
    ref = checkout_data["payment_reference"]
    assert ref.startswith("SUB-")
    assert checkout_data["payable_amount"] == 2490.0

    # 2. Submit manual payment claim (TrxID)
    trx_id = f"TRX{uuid.uuid4().hex[:10].upper()}"
    claim_res = client.post(
        "/api/v1/billing/manual-claim",
        headers=headers,
        json={
            "payment_reference": ref,
            "transaction_id": trx_id
        }
    )
    assert claim_res.status_code == 200
    claim_data = claim_res.json()
    assert claim_data["status"] == "PAYMENT_SUBMITTED"
    assert claim_data["payment_reference"] == ref
    assert claim_data["transaction_id"] == trx_id

    # 3. Verify in payments listing
    payments_res = client.get("/api/v1/billing/payments", headers=headers)
    assert payments_res.status_code == 200
    payments_list = payments_res.json()["payments"]
    assert any(p["payment_reference"] == ref and p["status"] == "SUBMITTED" for p in payments_list)


def test_dual_custody_superadmin_reconciliation(billing_fixture):
    data = billing_fixture
    admin_headers = {
        "Authorization": f"Bearer {data['admin_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }
    superadmin_headers = {
        "Authorization": f"Bearer {data['superadmin_token']}",
        "X-Tenant-ID": data["tenant_id"]
    }

    # 1. Create and submit payment
    checkout_res = client.post(
        "/api/v1/billing/checkout",
        headers=admin_headers,
        json={
            "plan_key": "school_starter",
            "gateway": "NAGAD",
            "billing_cycle": "monthly"
        }
    )
    assert checkout_res.status_code == 200
    ref = checkout_res.json()["payment_reference"]
    trx_id = f"NAGAD{uuid.uuid4().hex[:8].upper()}"

    client.post(
        "/api/v1/billing/manual-claim",
        headers=admin_headers,
        json={"payment_reference": ref, "transaction_id": trx_id}
    )

    # 2. Submitter (Admin) cannot reconcile their own payment
    unauth_reconcile = client.post(
        "/api/v1/billing/admin/reconcile-payment",
        headers=admin_headers,
        json={
            "payment_reference": ref,
            "statement_reference": trx_id,
            "verified_amount": 990.0
        }
    )
    assert unauth_reconcile.status_code == 403

    # 3. Superadmin successfully reconciles payment
    reconcile_res = client.post(
        "/api/v1/billing/admin/reconcile-payment",
        headers=superadmin_headers,
        json={
            "payment_reference": ref,
            "statement_reference": trx_id,
            "verified_amount": 990.0,
            "notes": "Verified against platform Nagad statement."
        }
    )
    assert reconcile_res.status_code == 200
    recon_data = reconcile_res.json()
    assert recon_data["status"] == "SUBSCRIPTION_ACTIVATED"
    assert "invoice_number" in recon_data

    # 4. Check updated subscription status
    status_res = client.get("/api/v1/billing/status", headers=admin_headers)
    assert status_res.status_code == 200
    new_status = status_res.json()
    assert new_status["plan_key"] == "school_starter"
    assert new_status["is_active"] is True
    assert new_status["is_trial"] is False
