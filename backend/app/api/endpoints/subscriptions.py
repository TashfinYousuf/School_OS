import uuid
import datetime
import logging
import json
import hashlib
import hmac

from decimal import Decimal, InvalidOperation
from typing import Optional, Literal, Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Depends, HTTPException, Header, Request, status

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.database import get_db as get_global_db
from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.subscription import InstitutionSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.student import Student

logger = logging.getLogger(__name__)

router = APIRouter()

# Comprehensive Pricing Plans Catalogue delegated strictly to billing.py SSOT (deprecated router)
from app.api.endpoints.billing import PRICING_PLANS  # noqa: E402,F401


ANNUAL_MONTHS_CHARGED = 10        # 12 months of service for 10 months of fee
GATEWAY_PATHS = {
    "BKASH": "bkash/checkout",
    "NAGAD": "nagad/checkout",
    "SSLCOMMERZ": "sslcommerz/session",
}
PAYMENT_BASE_URL = (getattr(settings, "PAYMENT_CHECKOUT_BASE_URL", None)
                    or "https://payment.educationos.app").rstrip("/")


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


# ----------------------------------------------------------------------------- helpers
def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _aware(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
    """Columns without timezone=True come back naive; comparing with an aware 'now' raises TypeError."""
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
    sub = InstitutionSubscription(tenant_id=tid, ai_questions_used_this_month=0)   # real usage starts at 0
    _apply_plan(sub, "unified_growth", "monthly", _now() + datetime.timedelta(days=30))  # 30-day trial
    db.add(sub)
    try:
        db.commit()
    except IntegrityError:                      # a concurrent request created it first
        db.rollback()
        sub = q.first()
        if sub is None:
            raise
        return sub
    db.refresh(sub)
    return sub


# ----------------------------------------------------------------------------- endpoints
@router.get("/plans")
def list_available_plans():
    """Public price catalogue (the single source of truth the pricing page renders from)."""
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
            valid_until=now + datetime.timedelta(days=14),
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
    """Creates a PENDING payment intent. The amount is computed and stored server-side."""
    tid = str(tenant_id)
    plan = PRICING_PLANS.get(payload.plan_key)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid subscription plan selected.")

    active = _active_students(db, tid)
    if active > plan["max_students"]:
        raise HTTPException(
            status_code=400,
            detail=f"You have {active} active students; {plan['name']} allows {plan['max_students']}.",
        )

    amount = _plan_amount(plan, payload.billing_cycle)
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

    # No amount in the URL: the gateway page must read it from the stored intent, never from a query string.
    checkout_url = f"{PAYMENT_BASE_URL}/{GATEWAY_PATHS[payload.gateway]}?{urlencode({'ref': reference})}"

    return {
        "status": "CHECKOUT_CREATED",
        "payment_reference": reference,
        "gateway": payload.gateway,
        "payable_amount": amount,
        "currency": "BDT",
        "billing_cycle": payload.billing_cycle,
        "checkout_url": checkout_url,
        "plan_details": plan,
        "instructions": f"Pay via {payload.gateway}, then submit your transaction ID. "
                        "The plan activates when the payment is confirmed.",
    }


@router.post("/verify-payment")
def submit_transaction_id(
    payload: SubmitPaymentPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """Attaches the customer's TrxID to their own intent. It never activates anything."""
    intent = (
        db.query(SubscriptionPayment)
        .filter(SubscriptionPayment.payment_reference == payload.payment_reference,
                SubscriptionPayment.tenant_id == str(tenant_id))
        .with_for_update()
        .first()
    )
    if not intent:
        raise HTTPException(status_code=404, detail="Payment reference not found.")
    if intent.status == "PAID":
        return {"status": "ALREADY_CONFIRMED", "message": "This payment is already confirmed.",
                "payment_reference": intent.payment_reference}

    intent.transaction_id = payload.transaction_id.strip()
    intent.status = "SUBMITTED"
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="This transaction ID has already been used.")

    return {
        "status": "PAYMENT_SUBMITTED",
        "message": "Transaction ID received. Your plan activates as soon as the payment is confirmed.",
        "payment_reference": intent.payment_reference,
        "transaction_id": intent.transaction_id,
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
        raise HTTPException(status_code=404, detail="Payment not found.")
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
    x_signature: Optional[str] = Header(None),
    db: Session = Depends(get_global_db),
):
    """
    Signed, idempotent activation. Tenant, plan and cycle come from OUR stored intent, never from the body.
    Expected: JSON {payment_reference, status:"SUCCESS", amount?, transaction_id?}
    Header:   X-Signature = hex(HMAC_SHA256(PAYMENT_WEBHOOK_SECRET, raw_body))
    """
    secret = getattr(settings, "PAYMENT_WEBHOOK_SECRET", None)
    if not secret:
        raise HTTPException(status_code=503, detail="Payment webhook is not configured.")
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    if not x_signature or not hmac.compare_digest(expected, x_signature.strip().lower()):
        logger.warning("billing webhook: invalid signature")
        raise HTTPException(status_code=401, detail="Invalid signature.")

    try:
        data = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    ref = str(data.get("payment_reference") or "")
    if data.get("status") != "SUCCESS" or not ref:
        return {"status": "IGNORED", "reason": "Non-success status or missing payment_reference"}

    intent = (db.query(SubscriptionPayment)
              .filter(SubscriptionPayment.payment_reference == ref)
              .with_for_update().first())
    if not intent:
        raise HTTPException(status_code=404, detail="Unknown payment reference.")
    if intent.status == "PAID":                                   # replay: no second extension
        return {"status": "ALREADY_PROCESSED", "payment_reference": ref}

    if data.get("amount") is not None:
        try:
            if Decimal(str(data["amount"])) != Decimal(str(intent.amount)):
                logger.error("billing webhook: amount mismatch ref=%s paid=%s expected=%s",
                             ref, data["amount"], intent.amount)
                raise HTTPException(status_code=409, detail="Amount mismatch.")
        except InvalidOperation:
            raise HTTPException(status_code=400, detail="Invalid amount.")

    if intent.plan_key not in PRICING_PLANS:
        logger.error("billing webhook: unknown plan %s on intent %s", intent.plan_key, ref)
        raise HTTPException(status_code=500, detail="Plan configuration error.")

    now = _now()
    sub = (db.query(InstitutionSubscription)
           .filter(InstitutionSubscription.tenant_id == intent.tenant_id)
           .with_for_update().first())
    if sub is None:
        sub = InstitutionSubscription(tenant_id=intent.tenant_id, ai_questions_used_this_month=0)
        db.add(sub)
    base = max(now, _aware(sub.valid_until) or now)               # renewals stack on remaining time
    valid_until = base + datetime.timedelta(days=_cycle_days(intent.billing_cycle))
    _apply_plan(sub, intent.plan_key, intent.billing_cycle, valid_until)

    intent.status = "PAID"
    intent.paid_at = now
    trx = data.get("transaction_id")
    if trx and not intent.transaction_id:
        intent.transaction_id = str(trx)[:64]
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Conflicting transaction.")

    return {"status": "SUBSCRIPTION_ACTIVATED", "payment_reference": ref,
            "tenant_id": intent.tenant_id, "valid_until": valid_until.isoformat()}