# backend/tests/test_stage12_subscription_billing.py
"""
Stage 12: Subscription, Billing & Entitlement Infrastructure Test Suite
Verifies:
1. Public Pricing Catalogue & Server-Side Plan Amounts
2. Subscription Checkout Creation, BDT Amounts, and Proration Credit
3. Active Student Capacity Limit Protection at Checkout
4. Cryptographic Webhook HMAC-SHA256 Signature Verification & Tamper Rejection
5. Webhook Replay Protection & Idempotent Processing (BillingWebhookEvent)
6. Bounded Context Separation: SaaS BillingInvoice Generation vs Academic Invoices
7. Subscription Lifecycle State Machine (ACTIVE -> GRACE_PERIOD -> SUSPENDED -> EXPIRED)
8. Non-Destructive Suspension (Read access preserved, premium features blocked)
9. Granular Feature Entitlement Gating & Explicit Overrides (TenantEntitlement)
10. Resource Quota Enforcement & Atomic Usage Consumption
"""
import uuid
import datetime
import hashlib
import hmac
import json
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

import app.models
from app.main import app
from app.models.base import Base
from app.models.subscription import InstitutionSubscription, TenantSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.billing import (
    SubscriptionPlan,
    PlanVersion,
    BillingInvoice,
    BillingInvoiceLineItem,
    BillingWebhookEvent,
    TenantEntitlement,
    BillingAuditLog,
)
from app.models.student import Student
from app.models.finance import Invoice as AcademicInvoice
from app.core.config import settings
from app.core.database import get_db as core_get_db
from app.api.deps import (
    get_db as deps_get_db,
    get_current_tenant_id,
    get_current_user_claims,
)
from app.services.entitlement import (
    EntitlementService,
    require_entitlement,
    require_active_subscription,
    PLAN_FEATURES,
    READ_ONLY_FALLBACK_FEATURES,
)

# Teach SQLite compiler to render PostgreSQL JSONB as JSON during in-memory tests
if not hasattr(SQLiteTypeCompiler, "visit_JSONB"):
    SQLiteTypeCompiler.visit_JSONB = lambda self, type_, **kw: "JSON"

# Setup isolated SQLite test engine with StaticPool
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
        "email": f"{role}@school.edu",
        "jti": uuid.uuid4().hex,
        "exp": datetime.datetime.now(datetime.timezone.utc).timestamp() + 3600
    }


# ========================================================================================
# 1. Pricing Catalogue & Plan Structure
# ========================================================================================

def test_pricing_catalogue_and_plan_structure():
    """Verify public pricing endpoint returns accurate plan pricing, limits, and currency."""
    client = TestClient(app)
    res = client.get("/api/v1/billing/plans")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["currency"] == "BDT"
    assert data["annual_months_charged"] == 10

    plans = data["plans"]
    assert "school_starter" in plans
    assert "school_growth" in plans
    assert "school_pro" in plans
    assert "academy_starter" in plans
    assert "unified_growth" in plans

    assert plans["school_starter"]["price_bdt"] == 990
    assert plans["school_growth"]["max_students"] == 500


# ========================================================================================
# 2. Checkout Intent Creation & Proration
# ========================================================================================

def test_subscription_checkout_intent_creation_and_proration():
    """Verify checkout intent is computed securely server-side with proration if upgrading."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    # 1. Create fresh checkout for school_growth monthly
    payload = {
        "plan_key": "school_growth",
        "gateway": "BKASH",
        "billing_cycle": "monthly"
    }
    res = client.post("/api/v1/billing/checkout", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "CHECKOUT_CREATED"
    assert data["payment_reference"].startswith("SUB-")
    assert data["payable_amount"] == 2490.0
    assert data["currency"] == "BDT"
    assert "bkash" in data["checkout_url"]

    # 2. Simulate existing active starter subscription with 15 days remaining
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)
    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_starter",
        monthly_fee=990.0,
        billing_cycle="monthly",
        subscription_status="ACTIVE",
        valid_until=now + datetime.timedelta(days=15),
    )
    db.add(sub)
    db.commit()
    db.close()

    # 3. Request upgrade checkout to school_pro -> verify prorated credit deducted
    upgrade_payload = {
        "plan_key": "school_pro",
        "gateway": "BKASH",
        "billing_cycle": "monthly"
    }
    res2 = client.post("/api/v1/billing/checkout", json=upgrade_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["gross_amount"] == 5990.0
    assert data2["prorated_credit"] > 0
    # 15 days out of 30 for 990 = ~495 credit -> payable is ~5495
    assert data2["payable_amount"] < 5990.0
    assert data2["payable_amount"] == (data2["gross_amount"] - data2["prorated_credit"])


def test_subscription_checkout_student_cap_enforcement():
    """Verify checkout blocks selecting a plan whose student cap is lower than active students."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    db = TestingSessionLocal()
    # Seed 120 active students
    students = [
        Student(
            id=uuid.uuid4(),
            tenant_id=tid,
            first_name=f"Stu{i}",
            last_name="Test",
            admission_number=f"ADM-{i}",
            status="Active"
        )
        for i in range(120)
    ]
    db.add_all(students)
    db.commit()
    db.close()

    # Attempt to select school_starter (max 100)
    payload = {
        "plan_key": "school_starter",
        "gateway": "BKASH",
        "billing_cycle": "monthly"
    }
    res = client.post("/api/v1/billing/checkout", json=payload)
    assert res.status_code == 400
    assert "currently have 120 active students" in res.json()["detail"]


# ========================================================================================
# 3. Webhook Cryptographic Verification & Replay Protection
# ========================================================================================

def test_payment_webhook_hmac_signature_verification():
    """Verify webhook rejects requests with missing or invalid cryptographic signatures."""
    client = TestClient(app)
    secret = "test-webhook-secret-salt-2026"
    setattr(settings, "PAYMENT_WEBHOOK_SECRET", secret)

    payload = {"status": "SUCCESS", "payment_reference": "SUB-TEST-REF", "transaction_id": "TRX12345"}
    body_bytes = json.dumps(payload).encode("utf-8")

    # 1. No signature -> 401
    r1 = client.post("/api/v1/billing/webhook/payment-callback", content=body_bytes)
    assert r1.status_code == 401

    # 2. Tampered signature -> 401
    r2 = client.post(
        "/api/v1/billing/webhook/payment-callback",
        content=body_bytes,
        headers={"X-Signature": "tampered_bad_signature_hash"}
    )
    assert r2.status_code == 401


def test_payment_webhook_replay_protection_and_activation():
    """Verify webhook activates plan, creates billing invoice, and is replay-safe."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    secret = "test-webhook-secret-salt-2026"
    setattr(settings, "PAYMENT_WEBHOOK_SECRET", secret)

    db = TestingSessionLocal()
    payment_ref = f"SUB-{tid[:6].upper()}-9999"
    payment = SubscriptionPayment(
        id=uuid.uuid4(),
        tenant_id=tid,
        payment_reference=payment_ref,
        plan_key="school_growth",
        billing_cycle="monthly",
        gateway="BKASH",
        amount=Decimal("2490.00"),
        status="PENDING",
    )
    db.add(payment)
    db.commit()
    db.close()

    payload = {
        "status": "SUCCESS",
        "payment_reference": payment_ref,
        "transaction_id": "BKASH_TRX_999888",
        "amount": "2490.00",
        "event_id": "EVT_BKASH_001"
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode("utf-8"), body_bytes, hashlib.sha256).hexdigest()

    # 1. First execution -> SUBSCRIPTION_ACTIVATED
    res1 = client.post(
        "/api/v1/billing/webhook/payment-callback",
        content=body_bytes,
        headers={"X-Signature": signature}
    )
    assert res1.status_code == 200, res1.text
    d1 = res1.json()
    assert d1["status"] == "SUBSCRIPTION_ACTIVATED"
    assert d1["invoice_number"].startswith("INV-SAAS-")

    # Verify DB state
    db2 = TestingSessionLocal()
    sub = db2.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
    assert sub.subscription_status == "ACTIVE"
    assert sub.plan_tier == "school_growth"
    assert sub.max_active_students == 500

    # Verify SaaS Invoice created
    invoice = db2.query(BillingInvoice).filter(BillingInvoice.tenant_id == tid).first()
    assert invoice is not None
    assert invoice.amount == Decimal("2490.00")
    assert invoice.status == "PAID"
    assert len(invoice.line_items) == 1
    assert "SchoolOS Growth" in invoice.line_items[0].description

    # Verify Webhook Event recorded
    we = db2.query(BillingWebhookEvent).filter(BillingWebhookEvent.event_id == "EVT_BKASH_001").first()
    assert we is not None
    assert we.processed is True

    # Verify Audit Log
    al = db2.query(BillingAuditLog).filter(BillingAuditLog.tenant_id == tid).first()
    assert al is not None
    assert al.action == "SUBSCRIPTION_ACTIVATION"
    db2.close()

    # 2. Replay duplicate webhook -> Handled idempotently
    res2 = client.post(
        "/api/v1/billing/webhook/payment-callback",
        content=body_bytes,
        headers={"X-Signature": signature}
    )
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["status"] == "ALREADY_PROCESSED"
    assert d2["event_id"] == "EVT_BKASH_001"


# ========================================================================================
# 4. Bounded Context Separation: SaaS BillingInvoice vs Academic Invoice
# ========================================================================================

def test_saas_billing_invoice_bounded_context_separation():
    """Verify SaaS BillingInvoice is in billing_invoices table and distinct from academic Invoices."""
    tid = str(uuid.uuid4())
    db = TestingSessionLocal()

    # 1. Academic Student Tuition Invoice (Stage 06)
    acad_inv = AcademicInvoice(
        id=uuid.uuid4(),
        tenant_id=tid,
        invoice_number="INV-2026-0001",
        student_id=str(uuid.uuid4()),
        billing_month="2026-11",
        total_amount=Decimal("1500.00"),
        paid_amount=Decimal("1500.00"),
        status="PAID"
    )
    db.add(acad_inv)

    # 2. SaaS Software License Invoice (Stage 12)
    saas_inv = BillingInvoice(
        id=uuid.uuid4(),
        tenant_id=tid,
        invoice_number="INV-SAAS-2026-0001",
        amount=Decimal("5990.00"),
        currency="BDT",
        status="PAID",
        billing_cycle="monthly",
        period_start=datetime.datetime.now(datetime.timezone.utc),
        period_end=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30),
        due_date=datetime.datetime.now(datetime.timezone.utc),
        paid_at=datetime.datetime.now(datetime.timezone.utc),
    )
    db.add(saas_inv)
    db.commit()

    # Verify isolation
    acad_records = db.query(AcademicInvoice).filter(AcademicInvoice.tenant_id == tid).all()
    saas_records = db.query(BillingInvoice).filter(BillingInvoice.tenant_id == tid).all()

    assert len(acad_records) == 1
    assert len(saas_records) == 1
    assert acad_records[0].invoice_number == "INV-2026-0001"
    assert saas_records[0].invoice_number == "INV-SAAS-2026-0001"
    assert saas_records[0].__tablename__ == "billing_invoices"
    assert acad_records[0].__tablename__ == "invoices"
    db.close()


# ========================================================================================
# 5. Subscription Lifecycle State Machine & Dunning
# ========================================================================================

def test_subscription_lifecycle_state_machine_and_dunning():
    """Verify ACTIVE -> GRACE_PERIOD -> SUSPENDED state transitions and audit logging."""
    tid = str(uuid.uuid4())
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Create active subscription with valid_until in the past (expired 2 days ago)
    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_growth",
        subscription_status="ACTIVE",
        valid_until=now - datetime.timedelta(days=2),
    )
    db.add(sub)
    db.commit()

    # Evaluate lifecycle -> Should enter GRACE_PERIOD
    status1 = EntitlementService.evaluate_subscription_lifecycle(db, tid, now=now)
    assert status1 == "GRACE_PERIOD"

    db.refresh(sub)
    assert sub.subscription_status == "GRACE_PERIOD"
    assert sub.grace_period_until is not None
    assert EntitlementService._aware(sub.grace_period_until) > now

    # 2. Evaluate lifecycle 8 days later (past grace period of 7 days) -> Should SUSPEND
    future_now = now + datetime.timedelta(days=8)
    status2 = EntitlementService.evaluate_subscription_lifecycle(db, tid, now=future_now)
    assert status2 == "SUSPENDED"

    db.refresh(sub)
    assert sub.subscription_status == "SUSPENDED"

    # Verify audit logs captured both transitions
    logs = db.query(BillingAuditLog).filter(BillingAuditLog.tenant_id == tid).order_by(BillingAuditLog.created_at.asc()).all()
    assert len(logs) == 2
    assert logs[0].new_state["status"] == "GRACE_PERIOD"
    assert logs[1].new_state["status"] == "SUSPENDED"
    db.close()


# ========================================================================================
# 6. Non-Destructive Suspension (Read Access Preserved, Premium Blocked)
# ========================================================================================

def test_non_destructive_suspension_read_only_access():
    """Verify that suspended tenants retain read access to core data while premium write is blocked."""
    tid = str(uuid.uuid4())
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)

    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_growth",
        subscription_status="SUSPENDED",
        valid_until=now - datetime.timedelta(days=10),
    )
    db.add(sub)
    db.commit()

    # Core read features are preserved (non-destructive)
    assert EntitlementService.has_entitlement(db, tid, "student_directory", now=now) is True
    assert EntitlementService.has_entitlement(db, tid, "report_cards", now=now) is True

    # Premium active features are blocked
    assert EntitlementService.has_entitlement(db, tid, "whatsapp_alerts", now=now) is False
    assert EntitlementService.has_entitlement(db, tid, "nctb_grading", now=now) is False
    assert EntitlementService.has_entitlement(db, tid, "teacher_diary", now=now) is False
    db.close()


# ========================================================================================
# 7. Granular Feature Entitlement Gating & Overrides
# ========================================================================================

def test_entitlement_gating_and_explicit_override():
    """Verify feature resolution from plan matrix and explicit TenantEntitlement overrides."""
    tid = str(uuid.uuid4())
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)

    # Starter plan does not include whatsapp_alerts
    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_starter",
        subscription_status="ACTIVE",
        valid_until=now + datetime.timedelta(days=30),
    )
    db.add(sub)
    db.commit()

    assert EntitlementService.has_entitlement(db, tid, "attendance_ledger") is True
    assert EntitlementService.has_entitlement(db, tid, "whatsapp_alerts") is False

    # Add explicit override grant
    override = TenantEntitlement(
        tenant_id=tid,
        feature_key="whatsapp_alerts",
        is_enabled=True,
    )
    db.add(override)
    db.commit()

    # Now entitled via explicit override
    assert EntitlementService.has_entitlement(db, tid, "whatsapp_alerts") is True

    # Explicit override revocation
    override.is_enabled = False
    db.commit()
    assert EntitlementService.has_entitlement(db, tid, "whatsapp_alerts") is False
    db.close()


# ========================================================================================
# 8. Quota Enforcement & Atomic Usage Consumption
# ========================================================================================

def test_quota_consumption_and_limits():
    """Verify atomic checking and incrementing of quotas (e.g. AI Question monthly quota)."""
    tid = str(uuid.uuid4())
    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)

    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_starter",
        subscription_status="ACTIVE",
        valid_until=now + datetime.timedelta(days=30),
        ai_question_quota_monthly=5,
        ai_questions_used_this_month=3,
        max_active_students=50,
    )
    db.add(sub)
    db.commit()

    # 1. Consume 1 question -> allowed (used becomes 4)
    allowed, used, limit = EntitlementService.check_and_consume_quota(db, tid, "ai_questions", amount=1)
    assert allowed is True
    assert used == 4
    assert limit == 5

    # 2. Consume 1 question -> allowed (used becomes 5)
    allowed2, used2, limit2 = EntitlementService.check_and_consume_quota(db, tid, "ai_questions", amount=1)
    assert allowed2 is True
    assert used2 == 5

    # 3. Consume 1 more question -> rejected (exceeds limit 5)
    allowed3, used3, limit3 = EntitlementService.check_and_consume_quota(db, tid, "ai_questions", amount=1)
    assert allowed3 is False
    assert used3 == 5
    assert limit3 == 5
    db.close()


# ========================================================================================
# 9. Tenant Invoices & Entitlements API Endpoints
# ========================================================================================

def test_tenant_invoices_and_entitlements_api():
    """Verify tenant API endpoints for listing entitlements and SaaS billing invoices."""
    client = TestClient(app)
    tid = str(uuid.uuid4())
    app.dependency_overrides[get_current_tenant_id] = lambda: tid
    app.dependency_overrides[get_current_user_claims] = lambda: override_auth_claims(tenant_id=tid)

    db = TestingSessionLocal()
    now = datetime.datetime.now(datetime.timezone.utc)
    sub = InstitutionSubscription(
        tenant_id=tid,
        plan_tier="school_growth",
        subscription_status="ACTIVE",
        valid_until=now + datetime.timedelta(days=20),
        ai_question_quota_monthly=100,
        ai_questions_used_this_month=25,
        max_active_students=500
    )
    inv_id = str(uuid.uuid4())
    inv = BillingInvoice(
        id=uuid.UUID(inv_id),
        tenant_id=tid,
        invoice_number="INV-SAAS-TEST-01",
        amount=Decimal("2490.00"),
        currency="BDT",
        status="PAID",
        billing_cycle="monthly",
        period_start=now - datetime.timedelta(days=10),
        period_end=now + datetime.timedelta(days=20),
        due_date=now - datetime.timedelta(days=10),
        paid_at=now - datetime.timedelta(days=10),
    )
    db.add_all([sub, inv])
    db.commit()

    li = BillingInvoiceLineItem(
        billing_invoice_id=uuid.UUID(inv_id),
        description="SchoolOS Growth Monthly Subscription",
        quantity=1,
        unit_price=Decimal("2490.00"),
        total_price=Decimal("2490.00")
    )
    db.add(li)
    db.commit()
    db.close()

    # 1. GET /api/v1/billing/entitlements
    res_ent = client.get("/api/v1/billing/entitlements")
    assert res_ent.status_code == 200
    ent_data = res_ent.json()
    assert ent_data["status"] == "success"
    assert ent_data["subscription_status"] == "ACTIVE"
    assert ent_data["plan_tier"] == "school_growth"
    assert ent_data["entitlements"]["whatsapp_alerts"] is True
    assert ent_data["quotas"]["ai_questions"]["used"] == 25

    # 2. GET /api/v1/billing/invoices
    res_inv = client.get("/api/v1/billing/invoices")
    assert res_inv.status_code == 200
    inv_data = res_inv.json()
    assert inv_data["total"] == 1
    assert inv_data["invoices"][0]["invoice_number"] == "INV-SAAS-TEST-01"

    # 3. GET /api/v1/billing/invoices/{id}
    res_det = client.get(f"/api/v1/billing/invoices/{inv_id}")
    assert res_det.status_code == 200
    det_data = res_det.json()
    assert det_data["invoice"]["invoice_number"] == "INV-SAAS-TEST-01"
    assert len(det_data["invoice"]["line_items"]) == 1
    assert "Growth" in det_data["invoice"]["line_items"][0]["description"]


def test_billing_lifecycle_worker_scheduled_sweep():
    """
    Verifies that the scheduled BillingLifecycleWorker:
    1. Evaluates all tenants across the lifecycle state machine.
    2. Transitions expired ACTIVE subscriptions into GRACE_PERIOD with Stage 1 dunning notices.
    3. Transitions expired GRACE_PERIOD subscriptions into non-destructive SUSPENDED mode.
    4. Transitions concluded free trials into EXPIRED status.
    5. Dispatches proactive urgent warnings for grace periods ending soon (<= 2 days).
    6. Creates immutable BillingAuditLog records and behaves idempotently on repeated sweeps.
    """
    from app.workers.billing_lifecycle_worker import BillingLifecycleWorker, run_billing_lifecycle_sweep

    db_session = TestingSessionLocal()
    try:
        now = datetime.datetime(2026, 11, 8, 12, 0, 0, tzinfo=datetime.timezone.utc)
        t_active = f"t_active_{uuid.uuid4().hex[:6]}"
        t_overdue = f"t_overdue_{uuid.uuid4().hex[:6]}"
        t_grace_exp = f"t_grace_exp_{uuid.uuid4().hex[:6]}"
        t_grace_warn = f"t_grace_warn_{uuid.uuid4().hex[:6]}"
        t_trial_exp = f"t_trial_exp_{uuid.uuid4().hex[:6]}"

        # 1. Tenant Active: healthy subscription
        sub_active = InstitutionSubscription(
            tenant_id=t_active,
            plan_tier="school_growth",
            subscription_status="ACTIVE",
            valid_until=now + datetime.timedelta(days=20),
            monthly_fee=2490.0,
            currency="BDT"
        )

        # 2. Tenant Overdue: active subscription with valid_until in the past (overdue 2 days)
        sub_overdue = InstitutionSubscription(
            tenant_id=t_overdue,
            plan_tier="school_growth",
            subscription_status="ACTIVE",
            valid_until=now - datetime.timedelta(days=2),
            monthly_fee=2490.0,
            currency="BDT"
        )

        # 3. Tenant Grace Expired: in GRACE_PERIOD with grace_period_until 1 day in the past
        sub_grace_exp = InstitutionSubscription(
            tenant_id=t_grace_exp,
            plan_tier="school_pro",
            subscription_status="GRACE_PERIOD",
            valid_until=now - datetime.timedelta(days=8),
            grace_period_until=now - datetime.timedelta(days=1),
            monthly_fee=4990.0,
            currency="BDT"
        )

        # 4. Tenant Grace Warning: in GRACE_PERIOD with 1.5 days left before suspension
        sub_grace_warn = InstitutionSubscription(
            tenant_id=t_grace_warn,
            plan_tier="academy_growth",
            subscription_status="GRACE_PERIOD",
            valid_until=now - datetime.timedelta(days=5),
            grace_period_until=now + datetime.timedelta(days=1, hours=12),
            monthly_fee=3490.0,
            currency="BDT"
        )

        # 5. Tenant Trial Expired: trialing subscription past trial cutoff
        sub_trial_exp = InstitutionSubscription(
            tenant_id=t_trial_exp,
            plan_tier="free_trial",
            subscription_status="TRIALING",
            valid_until=now - datetime.timedelta(days=1),
            trial_ends_at=now - datetime.timedelta(days=1),
            monthly_fee=0.0,
            currency="BDT"
        )

        db_session.add_all([sub_active, sub_overdue, sub_grace_exp, sub_grace_warn, sub_trial_exp])
        db_session.commit()

        # Instantiate worker and execute sweep
        worker = BillingLifecycleWorker(db=db_session)
        summary = worker.run_sweep(now=now)

        assert summary["total_evaluated"] >= 5
        assert summary["transitions_count"] >= 3  # overdue -> grace, grace_exp -> suspended, trial_exp -> expired
        assert summary["notifications_dispatched"] >= 4
        assert len(summary["errors"]) == 0

        # Verify state transitions in database
        db_session.refresh(sub_active)
        db_session.refresh(sub_overdue)
        db_session.refresh(sub_grace_exp)
        db_session.refresh(sub_grace_warn)
        db_session.refresh(sub_trial_exp)

        assert sub_active.subscription_status == "ACTIVE"
        assert sub_overdue.subscription_status == "GRACE_PERIOD"
        assert sub_overdue.grace_period_until is not None
        assert sub_grace_exp.subscription_status == "SUSPENDED"
        assert sub_grace_warn.subscription_status == "GRACE_PERIOD"
        assert sub_trial_exp.subscription_status == "EXPIRED"

        # Verify immutable audit log records
        logs_overdue = db_session.query(BillingAuditLog).filter(
            BillingAuditLog.tenant_id == t_overdue,
            BillingAuditLog.action == "DUNNING_NOTICE_STAGE_1"
        ).first()
        assert logs_overdue is not None
        assert logs_overdue.actor_id == "billing_lifecycle_worker"

        logs_suspended = db_session.query(BillingAuditLog).filter(
            BillingAuditLog.tenant_id == t_grace_exp,
            BillingAuditLog.action == "DUNNING_NOTICE_STAGE_2"
        ).first()
        assert logs_suspended is not None
        assert logs_suspended.new_state["mode"] == "NON_DESTRUCTIVE_READ_ONLY"

        logs_warn = db_session.query(BillingAuditLog).filter(
            BillingAuditLog.tenant_id == t_grace_warn,
            BillingAuditLog.action == "DUNNING_URGENT_WARNING"
        ).first()
        assert logs_warn is not None

        logs_trial = db_session.query(BillingAuditLog).filter(
            BillingAuditLog.tenant_id == t_trial_exp,
            BillingAuditLog.action == "TRIAL_EXPIRED_NOTICE"
        ).first()
        assert logs_trial is not None

        # Verify idempotency: Running sweep immediately again results in 0 additional transitions
        summary_2 = worker.run_sweep(now=now)
        assert summary_2["transitions_count"] == 0

        # Verify module convenience function
        summary_3 = run_billing_lifecycle_sweep(db=db_session, now=now)
        assert summary_3["transitions_count"] == 0
    finally:
        db_session.close()

