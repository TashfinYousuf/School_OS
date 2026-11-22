import datetime
import hashlib
import hmac
import json
import logging
import uuid
from decimal import Decimal, InvalidOperation
from typing import Literal, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.core.config import settings
from app.core.database import get_db as get_global_db
from app.models.student import Student
from app.models.subscription import InstitutionSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.billing import (
    BillingInvoice,
    BillingInvoiceLineItem,
    BillingWebhookEvent,
    TenantEntitlement,
    BillingAuditLog,
)
from app.services.entitlement import EntitlementService, PLAN_FEATURES
from app.services.pricing_engine import (
    PricingEngine,
    PricingQuoteRequest,
    PricingQuoteResponse,
    PRICING_VERSION,
    IS_OWNER_APPROVED,
    BASE_PLATFORM_FEE_BDT,
    STUDENT_TIERS,
    CORE_MODULES,
    OPTIONAL_MODULES,
    AVAILABLE_ADDONS,
    ANNUAL_DISCOUNT_PERCENT,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# -----------------------------------------------------------------------------
# Pricing Catalogue (Single Source of Truth)
# -----------------------------------------------------------------------------
PRICING_PLANS = {
    "school_starter": {
        "id": "school_starter",
        "name": "SchoolOS Starter",
        "category": "school",
        "price_bdt": 990,
        "max_students": 100,
        "ai_quota": 100,
        "features": [
            "Up to 100 Students",
            "1-Tap Attendance Ledger",
            "Cash, bKash & Bank Fee Receipts",
            "Print-Ready A4 Report Cards",
            "100 AI Exam Questions / month"
        ]
    },
    "school_growth": {
        "id": "school_growth",
        "name": "SchoolOS Growth",
        "category": "school",
        "price_bdt": 2490,
        "max_students": 500,
        "ai_quota": 500,
        "features": [
            "Up to 500 Students",
            "Teacher Voice-to-Diary AI Copilot",
            "Automated WhatsApp Attendance Alerts",
            "Full NCTB Grading Engine",
            "500 AI Exam Questions / month"
        ]
    },
    "school_pro": {
        "id": "school_pro",
        "name": "SchoolOS Professional",
        "category": "school",
        "price_bdt": 5990,
        "max_students": 1500,
        "ai_quota": 2000,
        "features": [
            "Up to 1,500 Students",
            "Camera OMR Sheet Scanner",
            "Multi-Branch Administration",
            "Append-Only Audit Ledger",
            "2,000 AI Exam Questions / month"
        ]
    },
    "academy_starter": {
        "id": "academy_starter",
        "name": "AcademyOS Starter",
        "category": "academy",
        "price_bdt": 1490,
        "max_students": 150,
        "ai_quota": 200,
        "features": [
            "Batch & Shift Management",
            "Live MCQ Exams (-0.25 Negative Marking)",
            "Merit Ranking & Percentiles",
            "200 AI Exam Questions / month"
        ]
    },
    "academy_growth": {
        "id": "academy_growth",
        "name": "AcademyOS Growth",
        "category": "academy",
        "price_bdt": 3990,
        "max_students": 600,
        "ai_quota": 1000,
        "features": [
            "Up to 600 Batch Enrollments",
            "High-Concurrency Live Exams",
            "Socratic AI Doubt Solver Studio",
            "Detailed Solution Sheets",
            "1,000 AI Exam Questions / month"
        ]
    },
    "unified_growth": {
        "id": "unified_growth",
        "name": "EducationOS Unified Growth",
        "category": "unified",
        "price_bdt": 4990,
        "max_students": 800,
        "ai_quota": 1500,
        "features": [
            "Combined School + Academy Workspace",
            "Shared Identity & Separate Ledgers",
            "Complete K-12 + Admission Care Engine",
            "1,500 AI Exam Questions / month"
        ]
    },
    "unified_pro": {
        "id": "unified_pro",
        "name": "EducationOS Unified Pro",
        "category": "unified",
        "price_bdt": 9990,
        "max_students": 2500,
        "ai_quota": 5000,
        "features": [
            "Unlimited Concurrency & Campuses",
            "Dedicated OMR & AI Study Pipelines",
            "AEGIS-X Sentinel Security Auditing",
            "5,000 AI Exam Questions / month",
            "Priority SLA Support"
        ]
    }
}

ANNUAL_MONTHS_CHARGED = 10  # 12 months for the price of 10
GATEWAY_PATHS = {
    "BKASH": "bkash/checkout",
    "NAGAD": "nagad/checkout",
    "SSLCOMMERZ": "sslcommerz/session",
}
PAYMENT_BASE_URL = (getattr(settings, "PAYMENT_CHECKOUT_BASE_URL", None) or "https://payment.educationos.app").rstrip("/")


# -----------------------------------------------------------------------------
# Dynamic Pricing Endpoints (Stage 2)
# -----------------------------------------------------------------------------
@router.post("/calculate-quote", response_model=PricingQuoteResponse, status_code=status.HTTP_200_OK)
def calculate_pricing_quote(payload: PricingQuoteRequest):
    """
    Authoritative Dynamic Pricing Calculator.
    Calculates transparent price quotes based on:
    - Institution Type (school, college, academy)
    - Active Billable Student Volume (graduated brackets)
    - Core (included) vs Optional Paid Modules
    - Service Add-ons & Usage Allocations
    - Monthly vs Annual Billing Cycle (with approved discount)
    """
    return PricingEngine.calculate_quote(payload)


@router.get("/catalogue", status_code=status.HTTP_200_OK)
def get_pricing_catalogue():
    """
    Returns the authoritative catalogue of core modules, optional paid modules,
    student tiers, and available service add-ons.
    """
    return {
        "pricing_version": PRICING_VERSION,
        "is_owner_approved": IS_OWNER_APPROVED,
        "base_platform_fee_bdt": BASE_PLATFORM_FEE_BDT,
        "student_tiers": STUDENT_TIERS,
        "core_modules": list(CORE_MODULES.values()),
        "optional_modules": list(OPTIONAL_MODULES.values()),
        "available_addons": list(AVAILABLE_ADDONS.values()),
        "annual_discount_percent": ANNUAL_DISCOUNT_PERCENT,
    }


class CreateCheckoutPayload(BaseModel):
    plan_key: str = Field(..., min_length=1, max_length=64)
    gateway: Literal["BKASH", "NAGAD", "SSLCOMMERZ"] = "BKASH"
    billing_cycle: Literal["monthly", "annual"] = "monthly"

    @field_validator("gateway", "billing_cycle", mode="before")
    @classmethod
    def _normalise(cls, v, info):
        if not isinstance(v, str):
            return v
        return v.strip().upper() if info.field_name == "gateway" else v.strip().lower()


class SubmitPaymentPayload(BaseModel):
    payment_reference: str = Field(..., min_length=6, max_length=64)
    transaction_id: str = Field(..., min_length=5, max_length=64, pattern=r"^[A-Za-z0-9_\-]+$")


# -----------------------------------------------------------------------------
# Internal Helpers
# -----------------------------------------------------------------------------
def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _aware(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    """Ensures naive datetimes are safely converted to UTC-aware to prevent TypeErrors."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=datetime.timezone.utc)


def _cycle_days(cycle: str) -> int:
    return 365 if cycle == "annual" else 30


def _plan_amount(plan: dict, cycle: str) -> int:
    return plan["price_bdt"] * (ANNUAL_MONTHS_CHARGED if cycle == "annual" else 1)


def _active_students(db: Session, tid: str) -> int:
    return db.query(Student).filter(Student.tenant_id == tid, Student.status == "Active").count()


def _apply_plan(sub, plan_key: str, cycle: str, valid_until) -> None:
    plan = PRICING_PLANS[plan_key]
    sub.plan_tier = plan_key
    sub.workspace_scope = plan["category"]
    sub.monthly_fee = float(plan["price_bdt"])
    sub.billing_cycle = cycle
    sub.max_active_students = plan["max_students"]
    sub.ai_question_quota_monthly = plan["ai_quota"]
    sub.valid_until = valid_until
    sub.subscription_status = "ACTIVE"


def _get_or_create_subscription(db: Session, tid: str) -> InstitutionSubscription:
    q = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid)
    sub = q.first()
    if sub:
        return sub

    sub = InstitutionSubscription(tenant_id=tid, ai_questions_used_this_month=0)
    _apply_plan(sub, "school_starter", "monthly", _now() + datetime.timedelta(days=30))
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        sub = q.first()
        if sub is None:
            raise
        return sub
    db.refresh(sub)
    return sub


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@router.get("/plans")
def list_available_plans():
    """Public price catalogue (Single source of truth)."""
    return {
        "status": "success",
        "currency": "BDT",
        "annual_months_charged": ANNUAL_MONTHS_CHARGED,
        "plans": PRICING_PLANS,
    }


@router.get("/status")
def get_subscription_status(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    tid = str(tenant_id)
    sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
    now = _now()

    # 1. New Organization without license -> Default to Official Free Trial
    if not sub:
        sub = InstitutionSubscription(
            tenant_id=tid,
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
        db.add(sub)
        db.commit()
        db.refresh(sub)

    valid_until = _aware(sub.valid_until) or now
    
    # 2. 🚀 AUTO-DOWNGRADE STATE MACHINE:
    # If subscription date expired and not renewed -> Automatically degrade to Free Tier!
    if valid_until < now and sub.plan_tier != "free_trial":
        logger.warning(f"Tenant {tid} subscription expired on {valid_until}. Downgrading to Free Tier.")
        sub.plan_tier = "free_trial"
        sub.subscription_status = "EXPIRED"
        sub.max_active_students = 50
        sub.ai_question_quota_monthly = 10
        db.commit()

    is_active = sub.subscription_status == "ACTIVE" and valid_until >= now
    current_students = _active_students(db, tid)
    plan_info = PRICING_PLANS.get(sub.plan_tier or "school_starter", {})
    plan_name = plan_info.get("name") if sub.plan_tier in PRICING_PLANS else ("Free Trial Tier" if sub.plan_tier == "free_trial" else "Free Starter")

    return {
        "status": "success",
        "subscription_id": str(sub.id),
        "is_active": is_active,
        "is_trial": sub.plan_tier == "free_trial",
        "subscription_status": "ACTIVE" if is_active else "EXPIRED",
        "plan_key": sub.plan_tier,
        "plan_name": plan_name,
        "workspace_scope": sub.workspace_scope,
        "billing_cycle": sub.billing_cycle,
        "monthly_fee": sub.monthly_fee,
        "valid_until": valid_until.isoformat(),
        "days_remaining": max(0, (valid_until - now).days),
        "quota": {
            "max_students": sub.max_active_students or 50,
            "current_students": current_students,
            "students_remaining": max(0, (sub.max_active_students or 50) - current_students),
            "ai_questions_quota": sub.ai_question_quota_monthly or 30,
            "ai_questions_used": sub.ai_questions_used_this_month or 0,
            "ai_questions_remaining": max(0, (sub.ai_question_quota_monthly or 30) - (sub.ai_questions_used_this_month or 0)),
        },
    }


@router.post("/checkout")
def create_subscription_checkout(
    payload: CreateCheckoutPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Creates a PENDING payment intent. Amount is securely computed server-side."""
    tid = str(tenant_id)
    plan = PRICING_PLANS.get(payload.plan_key)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid subscription plan selected.")

    active = _active_students(db, tid)
    if active > plan["max_students"]:
        raise HTTPException(
            status_code=400,
            detail=f"You currently have {active} active students; {plan['name']} supports up to {plan['max_students']}.",
        )

    # Proration Calculation: If upgrading an active, unexpired subscription
    now = _now()
    sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
    prorated_credit = Decimal("0.00")
    if sub and sub.subscription_status == "ACTIVE" and sub.valid_until and _aware(sub.valid_until) > now and sub.monthly_fee > 0:
        days_left = max(0, (_aware(sub.valid_until) - now).days)
        total_cycle_days = 365 if sub.billing_cycle == "annual" else 30
        if days_left > 0 and total_cycle_days > 0:
            daily_rate = Decimal(str(sub.monthly_fee)) / Decimal(str(30 if sub.billing_cycle == "monthly" else 365))
            prorated_credit = round(daily_rate * Decimal(str(days_left)), 2)

    gross_amount = Decimal(str(_plan_amount(plan, payload.billing_cycle)))
    net_amount = max(Decimal("10.00"), gross_amount - prorated_credit)
    amount = net_amount
    reference = f"SUB-{tid[:6].upper()}-{uuid.uuid4().hex[:8].upper()}"

    db.add(SubscriptionPayment(
        tenant_id=tid,
        payment_reference=reference,
        plan_key=payload.plan_key,
        billing_cycle=payload.billing_cycle,
        gateway=payload.gateway,
        amount=amount,
        status="PENDING",
        created_by=str(claims.get("user_id") or claims.get("sub") or ""),
    ))
    db.commit()

    checkout_url = f"{PAYMENT_BASE_URL}/{GATEWAY_PATHS[payload.gateway]}?{urlencode({'ref': reference})}"

    return {
        "status": "CHECKOUT_CREATED",
        "payment_reference": reference,
        "gateway": payload.gateway,
        "payable_amount": float(amount),
        "gross_amount": float(gross_amount),
        "prorated_credit": float(prorated_credit),
        "currency": "BDT",
        "billing_cycle": payload.billing_cycle,
        "checkout_url": checkout_url,
        "plan_details": plan,
        "instructions": f"Complete payment of ৳{float(amount):,} via {payload.gateway}, then enter your transaction ID. "
                        "The plan activates automatically once the payment is confirmed.",
    }


@router.post("/verify-payment")
def submit_transaction_id(
    payload: SubmitPaymentPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Attaches the customer's TrxID / deposit claim without premature activation."""
    intent = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.payment_reference == payload.payment_reference,
            SubscriptionPayment.tenant_id == str(tenant_id)
        )
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")

    if intent.status == "PAID":
        return {
            "status": "ALREADY_CONFIRMED",
            "message": "This payment has already been verified and activated.",
            "payment_reference": intent.payment_reference
        }

    submitter_id = str(claims.get("user_id") or claims.get("sub") or "")
    now = _now()
    intent.transaction_id = payload.transaction_id.strip()
    intent.status = "SUBMITTED"
    intent.submitted_by = submitter_id
    intent.submitted_at = now
    db.add(BillingAuditLog(
        tenant_id=str(tenant_id),
        actor_id=submitter_id or "tenant_admin",
        action="MANUAL_PAYMENT_CLAIM_SUBMITTED",
        old_state={"status": "PENDING"},
        new_state={"status": "SUBMITTED", "transaction_id": intent.transaction_id, "payment_ref": intent.payment_reference},
        reason="Tenant admin submitted payment reference proof for verification."
    ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This transaction ID has already been submitted for another reference.")

    return {
        "status": "PAYMENT_SUBMITTED",
        "message": "Transaction ID received. Your plan will activate as soon as the merchant network or platform billing reviewer confirms.",
        "payment_reference": intent.payment_reference,
        "transaction_id": intent.transaction_id,
    }


@router.post("/manual-claim")
def submit_manual_payment_claim(
    payload: SubmitPaymentPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """Explicit alias for Mode A manual bank/bKash deposit proof submission."""
    return submit_transaction_id(payload=payload, db=db, tenant_id=tenant_id, claims=claims)


@router.get("/payments")
def list_subscription_payments(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """Lists subscription payment intents and manual claims for the tenant."""
    tid = str(tenant_id)
    payments = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.tenant_id == tid)
        .order_by(SubscriptionPayment.created_at.desc())
        .limit(20)
        .all()
    )
    return {
        "status": "success",
        "payments": [
            {
                "payment_reference": p.payment_reference,
                "plan_key": p.plan_key,
                "billing_cycle": p.billing_cycle,
                "gateway": p.gateway,
                "amount": float(p.amount),
                "status": p.status,
                "transaction_id": p.transaction_id,
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in payments
        ]
    }


@router.get("/payments/{reference}")
def get_payment_status(
    reference: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    intent = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.payment_reference == reference,
        SubscriptionPayment.tenant_id == str(tenant_id),
    ).first()
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")
    return {
        "payment_reference": intent.payment_reference,
        "status": intent.status,
        "plan_key": intent.plan_key,
        "billing_cycle": intent.billing_cycle,
        "amount": float(intent.amount),
        "paid_at": intent.paid_at.isoformat() if intent.paid_at else None,
    }


async def _raw_body(request: Request) -> bytes:
    return await request.body()


@router.post("/webhook/payment-callback")
def handle_payment_gateway_webhook(
    body: bytes = Depends(_raw_body),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    db: Session = Depends(get_global_db),
):
    """
    Signed, Idempotent Activation.
    Tenant, plan, and cycle come strictly from OUR stored intent, never from the request body.
    """
    secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", None)
    if not secret:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured.")

    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not x_signature or not hmac.compare_digest(expected, x_signature.strip().lower()):
        logger.warning("billing webhook: invalid cryptographic signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature.")

    try:
        data = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    ref = str(data.get("payment_reference") or "")
    if data.get("status") != "SUCCESS" or not ref:
        return {"status": "IGNORED", "reason": "Non-success status or missing payment reference"}

    intent = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.payment_reference == ref)
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Unknown payment reference.")

    event_id = str(data.get("event_id") or data.get("transaction_id") or ref)
    # 1. Replay Protection: Check if this event was already processed
    existing_evt = (
        db.query(BillingWebhookEvent)
        .filter(
            BillingWebhookEvent.gateway == intent.gateway,
            BillingWebhookEvent.event_id == event_id,
            BillingWebhookEvent.processed == True
        )
        .first()
    )
    if existing_evt or intent.status == "PAID":
        return {
            "status": "ALREADY_PROCESSED",
            "payment_reference": ref,
            "event_id": event_id,
            "message": "Webhook event was previously verified and processed."
        }

    if data.get("amount") is not None:
        try:
            if Decimal(str(data["amount"])) != Decimal(str(intent.amount)):
                logger.error("billing webhook: amount mismatch ref=%s paid=%s expected=%s", ref, data["amount"], intent.amount)
                raise HTTPException(status_code=409, detail="Payment amount mismatch.")
        except InvalidOperation:
            raise HTTPException(status_code=400, detail="Invalid amount specification.")

    if intent.plan_key not in PRICING_PLANS:
        logger.error("billing webhook: unknown plan %s on intent %s", intent.plan_key, ref)
        raise HTTPException(status_code=500, detail="Plan configuration error.")

    now = _now()
    sub = (
        db.query(InstitutionSubscription)
        .filter(InstitutionSubscription.tenant_id == intent.tenant_id)
        .with_for_update()
        .first()
    )
    if sub is None:
        sub = InstitutionSubscription(tenant_id=intent.tenant_id, ai_questions_used_this_month=0)
        db.add(sub)

    base = max(now, _aware(sub.valid_until) or now)
    valid_until = base + datetime.timedelta(days=_cycle_days(intent.billing_cycle))
    old_status = sub.subscription_status
    _apply_plan(sub, intent.plan_key, intent.billing_cycle, valid_until)
    sub.current_period_start = base
    sub.grace_period_until = None

    intent.status = "PAID"
    intent.paid_at = now
    trx = data.get("transaction_id")
    if trx and not intent.transaction_id:
        intent.transaction_id = str(trx)[:64]

    # 2. Record Replay Protection Event
    sig_hash = hashlib.sha256((x_signature or "").encode()).hexdigest()
    webhook_record = BillingWebhookEvent(
        gateway=intent.gateway,
        event_id=event_id,
        signature_hash=sig_hash,
        payload=data,
        processed=True,
        processed_at=now,
    )
    db.add(webhook_record)

    # 3. Create Immutable SaaS Billing Invoice & Line Item
    inv_number = f"INV-SAAS-{now.year}-{uuid.uuid4().hex[:8].upper()}"
    invoice = BillingInvoice(
        tenant_id=intent.tenant_id,
        subscription_id=sub.id,
        invoice_number=inv_number,
        amount=Decimal(str(intent.amount)),
        currency="BDT",
        status="PAID",
        billing_cycle=intent.billing_cycle,
        period_start=base,
        period_end=valid_until,
        due_date=now,
        paid_at=now,
    )
    db.add(invoice)
    db.flush()

    plan_display_name = PRICING_PLANS.get(intent.plan_key, {}).get("name") or intent.plan_key
    line_item = BillingInvoiceLineItem(
        billing_invoice_id=invoice.id,
        description=f"Subscription License: {plan_display_name} ({intent.billing_cycle})",
        quantity=1,
        unit_price=Decimal(str(intent.amount)),
        total_price=Decimal(str(intent.amount)),
    )
    db.add(line_item)

    # 4. Audit Log
    db.add(BillingAuditLog(
        tenant_id=intent.tenant_id,
        actor_id=f"gateway_{intent.gateway}",
        action="SUBSCRIPTION_ACTIVATION",
        old_state={"status": old_status, "plan": sub.plan_tier},
        new_state={"status": "ACTIVE", "plan": intent.plan_key, "valid_until": valid_until.isoformat(), "payment_ref": ref},
        reason=f"Payment verified via {intent.gateway} webhook (Trx: {trx or intent.transaction_id})"
    ))

    # 5. Provision Entitlements
    EntitlementService.sync_tenant_entitlements_for_plan(db, intent.tenant_id, intent.plan_key)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting transaction record.")

    return {
        "status": "SUBSCRIPTION_ACTIVATED",
        "payment_reference": ref,
        "tenant_id": intent.tenant_id,
        "valid_until": valid_until.isoformat(),
        "invoice_number": inv_number,
    }


# -----------------------------------------------------------------------------
# Mode A: Manual Payment Reconciliation (Admin / Operations)
# -----------------------------------------------------------------------------
class AdminReconcilePaymentPayload(BaseModel):
    payment_reference: str = Field(..., min_length=6, max_length=64)
    statement_reference: str = Field(..., min_length=3, max_length=128)
    verified_amount: float = Field(..., gt=0)
    notes: Optional[str] = None


class AdminRejectPaymentPayload(BaseModel):
    payment_reference: str = Field(..., min_length=6, max_length=64)
    reason: str = Field(..., min_length=5, max_length=255)


class AdminReversePaymentPayload(BaseModel):
    payment_reference: str = Field(..., min_length=6, max_length=64)
    reason: str = Field(..., min_length=5, max_length=255)


@router.get("/admin/payments")
def list_admin_subscription_payments(
    status_filter: Optional[str] = None,
    gateway_filter: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"])),
):
    """
    Platform Superadmin Payment Review Console:
    Lists subscription payments and manual claims across all tenants with filtering support.
    """
    q = db.query(SubscriptionPayment)
    if status_filter and status_filter.upper() != "ALL":
        q = q.filter(SubscriptionPayment.status == status_filter.upper())
    if gateway_filter and gateway_filter.upper() != "ALL":
        q = q.filter(SubscriptionPayment.gateway == gateway_filter.upper())

    payments = q.order_by(SubscriptionPayment.created_at.desc()).limit(min(100, max(1, limit))).all()
    return {
        "status": "success",
        "total": len(payments),
        "payments": [
            {
                "id": str(p.id),
                "payment_reference": p.payment_reference,
                "tenant_id": p.tenant_id,
                "plan_key": p.plan_key,
                "billing_cycle": p.billing_cycle,
                "gateway": p.gateway,
                "amount": float(p.amount),
                "status": p.status,
                "transaction_id": p.transaction_id,
                "submitted_by": p.submitted_by,
                "submitted_at": p.submitted_at.isoformat() if p.submitted_at else None,
                "reviewed_by": p.reviewed_by,
                "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
                "review_notes": p.review_notes,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "paid_at": p.paid_at.isoformat() if p.paid_at else None,
            }
            for p in payments
        ]
    }


@router.post("/admin/reconcile-payment")
def reconcile_manual_payment(
    payload: AdminReconcilePaymentPayload,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"])),
):
    """
    Mode A: Platform Superadmin Operational Payment Reconciliation.
    Strictly enforces dual-custody (submitter != approver), duplicate statement reference check,
    amount verification, and immutable invoice/audit recording.
    """
    now = _now()
    operator_id = str(claims.get("user_id") or claims.get("sub") or "platform_superadmin")
    intent = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.payment_reference == payload.payment_reference)
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")

    if intent.status == "PAID":
        return {
            "status": "ALREADY_CONFIRMED",
            "message": "Payment has already been reconciled and activated.",
            "payment_reference": intent.payment_reference,
        }

    if intent.submitted_by and str(intent.submitted_by) == operator_id:
        raise HTTPException(
            status_code=403,
            detail="Dual-custody violation: the user who submitted this manual payment claim cannot approve it."
        )

    stmt_ref = payload.statement_reference.strip()
    dup_trx = (
        db.query(SubscriptionPayment)
        .filter(
            SubscriptionPayment.gateway == intent.gateway,
            SubscriptionPayment.transaction_id == stmt_ref,
            SubscriptionPayment.id != intent.id,
        )
        .first()
    )
    if dup_trx:
        raise HTTPException(
            status_code=409,
            detail="Duplicate statement/transaction reference: already linked to another payment intent."
        )

    # Verify amount matches expected payable
    if Decimal(str(payload.verified_amount)) < Decimal(str(intent.amount)):
        raise HTTPException(
            status_code=400,
            detail=f"Deposited amount (৳{payload.verified_amount}) is less than payable (৳{intent.amount})."
        )

    # Resolve subscription
    sub = (
        db.query(InstitutionSubscription)
        .filter(InstitutionSubscription.tenant_id == intent.tenant_id)
        .with_for_update()
        .first()
    )
    if sub is None:
        sub = InstitutionSubscription(tenant_id=intent.tenant_id, ai_questions_used_this_month=0)
        db.add(sub)

    base = max(now, _aware(sub.valid_until) or now)
    valid_until = base + datetime.timedelta(days=_cycle_days(intent.billing_cycle))
    old_status = sub.subscription_status
    _apply_plan(sub, intent.plan_key, intent.billing_cycle, valid_until)
    sub.current_period_start = base
    sub.grace_period_until = None

    intent.status = "PAID"
    intent.paid_at = now
    intent.reviewed_by = operator_id
    intent.reviewed_at = now
    intent.review_notes = (payload.notes or f"Confirmed ref: {stmt_ref}")[:255]
    if not intent.transaction_id:
        intent.transaction_id = stmt_ref

    # Create Immutable SaaS Billing Invoice
    inv_number = f"INV-SAAS-{now.year}-{uuid.uuid4().hex[:8].upper()}"
    invoice = BillingInvoice(
        tenant_id=intent.tenant_id,
        subscription_id=sub.id,
        invoice_number=inv_number,
        amount=Decimal(str(intent.amount)),
        currency="BDT",
        status="PAID",
        billing_cycle=intent.billing_cycle,
        period_start=base,
        period_end=valid_until,
        due_date=now,
        paid_at=now,
    )
    db.add(invoice)
    db.flush()

    line_item = BillingInvoiceLineItem(
        billing_invoice_id=invoice.id,
        description=f"Subscription License: {PRICING_PLANS.get(intent.plan_key, {}).get('name', intent.plan_key)} ({intent.billing_cycle})",
        quantity=1,
        unit_price=Decimal(str(intent.amount)),
        total_price=Decimal(str(intent.amount)),
    )
    db.add(line_item)

    operator_id = str(claims.get("user_id") or claims.get("sub") or "manual_operator")
    db.add(BillingAuditLog(
        tenant_id=intent.tenant_id,
        actor_id=operator_id,
        action="MANUAL_RECONCILIATION_ACTIVATION",
        old_state={"status": old_status, "plan": sub.plan_tier},
        new_state={"status": "ACTIVE", "plan": intent.plan_key, "valid_until": valid_until.isoformat(), "payment_ref": intent.payment_reference},
        reason=f"Manual bank/bKash deposit confirmed: {payload.statement_reference}. Notes: {payload.notes or 'None'}"
    ))

    EntitlementService.sync_tenant_entitlements_for_plan(db, intent.tenant_id, intent.plan_key)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting transaction record.")

    return {
        "status": "SUBSCRIPTION_ACTIVATED",
        "payment_reference": intent.payment_reference,
        "tenant_id": intent.tenant_id,
        "valid_until": valid_until.isoformat(),
        "invoice_number": inv_number,
        "reconciled_by": operator_id,
        "statement_reference": payload.statement_reference
    }


@router.post("/admin/reject-payment")
def reject_manual_payment(
    payload: AdminRejectPaymentPayload,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"])),
):
    """Superadmin rejects or disputes an unverified payment claim with mandatory reason."""
    now = _now()
    operator_id = str(claims.get("user_id") or claims.get("sub") or "platform_superadmin")
    intent = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.payment_reference == payload.payment_reference)
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")
    if intent.status == "PAID":
        raise HTTPException(status_code=409, detail="Paid payment cannot be rejected; use /admin/reverse-payment.")

    old_status = intent.status
    intent.status = "REJECTED"
    intent.reviewed_by = operator_id
    intent.reviewed_at = now
    intent.review_notes = payload.reason.strip()[:255]
    db.add(BillingAuditLog(
        tenant_id=intent.tenant_id,
        actor_id=operator_id,
        action="MANUAL_PAYMENT_REJECTED",
        old_state={"status": old_status, "transaction_id": intent.transaction_id},
        new_state={"status": "REJECTED", "payment_ref": intent.payment_reference},
        reason=payload.reason.strip(),
    ))
    db.commit()
    return {
        "status": "PAYMENT_REJECTED",
        "payment_reference": intent.payment_reference,
        "reviewed_by": operator_id,
        "reason": payload.reason.strip(),
    }


@router.post("/admin/reverse-payment")
def reverse_subscription_payment(
    payload: AdminReversePaymentPayload,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"])),
):
    """Append-only Superadmin reversal of an erroneous PAID SaaS subscription payment."""
    now = _now()
    operator_id = str(claims.get("user_id") or claims.get("sub") or "platform_superadmin")
    intent = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.payment_reference == payload.payment_reference)
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")
    if intent.status != "PAID":
        raise HTTPException(status_code=409, detail=f"Only PAID transactions can be reversed (current: {intent.status}).")

    sub = (
        db.query(InstitutionSubscription)
        .filter(InstitutionSubscription.tenant_id == intent.tenant_id)
        .with_for_update()
        .first()
    )
    old_sub_status = sub.subscription_status if sub else "NONE"
    intent.status = "REVERSED"
    intent.reviewed_by = operator_id
    intent.reviewed_at = now
    intent.review_notes = payload.reason.strip()[:255]

    if sub:
        sub.subscription_status = "PAST_DUE"
        sub.valid_until = now
        sub.grace_period_until = now + datetime.timedelta(days=3)

    db.query(BillingInvoice).filter(
        BillingInvoice.tenant_id == intent.tenant_id,
        BillingInvoice.status == "PAID",
    ).update({"status": "VOID"}, synchronize_session=False)

    db.add(BillingAuditLog(
        tenant_id=intent.tenant_id,
        actor_id=operator_id,
        action="SUBSCRIPTION_PAYMENT_REVERSED",
        old_state={"payment_status": "PAID", "subscription_status": old_sub_status},
        new_state={"payment_status": "REVERSED", "subscription_status": "PAST_DUE"},
        reason=payload.reason.strip(),
    ))
    db.commit()
    return {
        "status": "PAYMENT_REVERSED",
        "payment_reference": intent.payment_reference,
        "tenant_id": intent.tenant_id,
        "reversed_by": operator_id,
    }


@router.get("/entitlements")
def get_tenant_entitlements(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"])),
):
    """
    Returns tenant feature entitlements and quota consumption status.
    """
    tid = str(tenant_id)
    lifecycle_status = EntitlementService.evaluate_subscription_lifecycle(db, tid)
    sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
    plan_tier = sub.plan_tier if sub else "free_trial"
    
    # Active plan features
    features = PLAN_FEATURES.get(plan_tier, [])
    
    # Explicit overrides
    overrides = db.query(TenantEntitlement).filter(TenantEntitlement.tenant_id == tid).all()
    override_map = {o.feature_key: o.is_enabled for o in overrides}
    
    resolved = {}
    for f in features:
        resolved[f] = override_map.get(f, True) if lifecycle_status not in ("SUSPENDED", "EXPIRED", "CANCELLED") else False

    return {
        "status": "success",
        "tenant_id": tid,
        "subscription_status": lifecycle_status,
        "plan_tier": plan_tier,
        "entitlements": resolved,
        "quotas": {
            "ai_questions": {
                "limit": sub.ai_question_quota_monthly if sub else 30,
                "used": sub.ai_questions_used_this_month if sub else 0,
            },
            "max_students": sub.max_active_students if sub else 50
        }
    }


@router.get("/invoices")
def list_billing_invoices(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """
    Lists SaaS subscription invoices for the authenticated tenant.
    """
    tid = str(tenant_id)
    invoices = (
        db.query(BillingInvoice)
        .filter(BillingInvoice.tenant_id == tid)
        .order_by(BillingInvoice.created_at.desc())
        .all()
    )
    return {
        "status": "success",
        "total": len(invoices),
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "amount": float(inv.amount),
                "currency": inv.currency,
                "status": inv.status,
                "billing_cycle": inv.billing_cycle,
                "period_start": inv.period_start.isoformat(),
                "period_end": inv.period_end.isoformat(),
                "due_date": inv.due_date.isoformat(),
                "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
                "created_at": inv.created_at.isoformat(),
            }
            for inv in invoices
        ]
    }


@router.get("/invoices/{invoice_id}")
def get_billing_invoice_detail(
    invoice_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """
    Retrieves a single SaaS subscription invoice and its line items.
    """
    tid = str(tenant_id)
    try:
        inv_uuid = uuid.UUID(invoice_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid invoice ID format.")

    invoice = (
        db.query(BillingInvoice)
        .filter(BillingInvoice.id == inv_uuid, BillingInvoice.tenant_id == tid)
        .first()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="SaaS billing invoice not found.")

    return {
        "status": "success",
        "invoice": {
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "amount": float(invoice.amount),
            "currency": invoice.currency,
            "status": invoice.status,
            "billing_cycle": invoice.billing_cycle,
            "period_start": invoice.period_start.isoformat(),
            "period_end": invoice.period_end.isoformat(),
            "due_date": invoice.due_date.isoformat(),
            "paid_at": invoice.paid_at.isoformat() if invoice.paid_at else None,
            "line_items": [
                {
                    "id": str(li.id),
                    "description": li.description,
                    "quantity": li.quantity,
                    "unit_price": float(li.unit_price),
                    "total_price": float(li.total_price),
                }
                for li in invoice.line_items
            ]
        }
    }


@router.post("/simulate-lifecycle")
def simulate_subscription_lifecycle(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """
    Evaluates and applies dunning state transitions (grace period, suspension).
    """
    tid = str(tenant_id)
    current_status = EntitlementService.evaluate_subscription_lifecycle(db, tid)
    return {
        "status": "success",
        "tenant_id": tid,
        "subscription_status": current_status
    }