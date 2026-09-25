import uuid
import datetime
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel, Field, model_validator

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.finance import FeePayment
from app.models.student import Student
from app.models.tenant import SchoolProfile

router = APIRouter()

class CollectFeePayload(BaseModel):
    student_id: uuid.UUID
    amount_paid: Optional[float] = None
    amount: Optional[float] = None
    fee_type: str = "Monthly Tuition Fee"
    billing_month: str = "September 2026"
    currency: str = "BDT"
    discount: Optional[float] = 0.0
    payment_method: str = "CASH"
    transaction_id: Optional[str] = None
    sender_number_or_wallet: Optional[str] = None
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = None

    @model_validator(mode="after")
    def reconcile_amounts(self):
        val = self.amount_paid if self.amount_paid is not None else self.amount
        if val is None or val <= 0:
            raise ValueError("A valid payment amount greater than 0 is required.")
        self.amount_paid = float(val)
        self.amount = float(val)
        return self


def sanitize_payment_method(raw_method: Any) -> str:
    if not raw_method:
        return "CASH"
    method_str = getattr(raw_method, "value", str(raw_method))
    if "." in method_str:
        method_str = method_str.split(".")[-1]
    clean = method_str.strip().upper()
    if clean == "BANK_TRANSFER":
        return "BANK"
    return clean


def format_receipt_payload(payment: Any, student: Any, school: Any) -> dict:
    amt = getattr(payment, "amount_paid", getattr(payment, "amount", 0.0))
    rec = getattr(payment, "receipt_no", getattr(payment, "receipt_number", "REC-PENDING"))
    trx = getattr(payment, "transaction_id", getattr(payment, "provider_transaction_id", "CASH-DESK"))
    dt = getattr(payment, "created_at", getattr(payment, "payment_date", datetime.datetime.now()))
    dt_str = dt.strftime("%d %b, %Y • %I:%M %p") if isinstance(dt, (datetime.datetime, datetime.date)) else "Today"

    # Resolve fee_type and billing_month from metadata_payload or notes
    meta = getattr(payment, "metadata_payload", {}) or {}
    notes_val = getattr(payment, "notes", "") or ""

    actual_fee_type = meta.get("fee_type") or getattr(payment, "fee_type", None)
    if not actual_fee_type:
        actual_fee_type = notes_val.split(" - ")[0] if " - " in notes_val else "Monthly Tuition Fee"

    actual_month = meta.get("billing_month") or getattr(payment, "billing_month", None)
    if not actual_month:
        actual_month = notes_val.split(" - ")[1] if " - " in notes_val else "Current Month"

    clean_method = sanitize_payment_method(getattr(payment, "payment_method", "CASH"))

    return {
        "receipt_no": rec,
        "transaction_id": trx,
        "school_name": school.school_name if school else "Kids Shine International School",
        "school_address": "Nazrul Avenue, Kandirpar, Cumilla-3500 • Phone: +8801971122084",
        "student_name": f"{student.first_name} {student.last_name}",
        "admission_number": student.admission_number,
        "class_name": student.class_name or "N/A",
        "roll_number": student.roll_number or "—",
        "fee_type": actual_fee_type,
        "billing_month": actual_month,
        "amount_paid": float(amt),
        "currency": "BDT",
        "payment_method": clean_method,
        "sender_ref": getattr(payment, "bank_reference", getattr(payment, "sender_number_or_wallet", "N/A")),
        "date": dt_str
    }


@router.get("/summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    amt_col = getattr(FeePayment, "amount_paid", getattr(FeePayment, "amount", None))
    date_col = getattr(FeePayment, "created_at", getattr(FeePayment, "payment_date", None))

    # 1. Today's Collection (accounting for local timezone window)
    today_collection = db.query(func.coalesce(func.sum(amt_col), 0.0)).filter(
        FeePayment.tenant_id == str(tenant_id),
        date_col >= (today_start - datetime.timedelta(hours=6))
    ).scalar() or 0.0

    # 2. Month-Wise Collection (resets on 1st of every month)
    this_month_collection = db.query(func.coalesce(func.sum(amt_col), 0.0)).filter(
        FeePayment.tenant_id == str(tenant_id),
        date_col >= month_start
    ).scalar() or 0.0

    # 3. Overall Revenue Base
    total_revenue = db.query(func.coalesce(func.sum(amt_col), 0.0)).filter(
        FeePayment.tenant_id == str(tenant_id)
    ).scalar() or 0.0

    payment_count_today = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        date_col >= (today_start - datetime.timedelta(hours=6))
    ).count()

    current_month_name = now.strftime("%B %Y")

    return {
        "collected_today": float(today_collection),
        "today_collection": float(today_collection),
        "this_month_collection": float(this_month_collection),
        "current_month_label": current_month_name,
        "total_revenue": float(total_revenue),
        "transactions_today": payment_count_today,
        "today_transactions_count": payment_count_today,
        "supported_gateways": ["Cash Counter", "bKash", "Nagad", "Bank Transfer"]
    }


@router.get("/payments")
def list_fee_payments(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    query = db.query(FeePayment).filter(FeePayment.tenant_id == str(tenant_id))
    date_col = getattr(FeePayment, "created_at", getattr(FeePayment, "payment_date", FeePayment.id))
    payments = query.order_by(date_col.desc()).limit(150).all()

    results = []
    for p in payments:
        st = db.query(Student).filter(Student.id == p.student_id).first()

        amt = float(getattr(p, "amount_paid", getattr(p, "amount", 0.0)))
        rec = getattr(p, "receipt_no", getattr(p, "receipt_number", "REC-PENDING"))
        trx = getattr(p, "transaction_id", getattr(p, "provider_transaction_id", "CASH-DESK"))

        meta = getattr(p, "metadata_payload", {}) or {}
        notes_str = getattr(p, "notes", "") or ""

        fee_name = meta.get("fee_type") or getattr(p, "fee_type", None) or (notes_str.split(" - ")[0] if " - " in notes_str else "Monthly Tuition Fee")
        month_name = meta.get("billing_month") or getattr(p, "billing_month", None) or (notes_str.split(" - ")[1] if " - " in notes_str else "Current Month")

        p_date = getattr(p, "created_at", getattr(p, "payment_date", datetime.datetime.now()))
        formatted_date = p_date.strftime("%d %b, %Y") if isinstance(p_date, (datetime.datetime, datetime.date)) else "Today"

        student_name = f"{st.first_name} {st.last_name}" if st else "Student Record"
        adm_no = st.admission_number if st else "N/A"
        cls_name = st.class_name if st else "N/A"

        results.append({
            "id": str(p.id),
            "receipt_no": rec,
            "student_name": student_name,
            "admission_number": adm_no,
            "class_name": cls_name,
            "fee_type": fee_name,
            "billing_month": month_name,
            "amount_paid": amt,
            "currency": "BDT",
            "payment_method": sanitize_payment_method(getattr(p, "payment_method", "CASH")),
            "transaction_id": trx,
            "sender_number_or_wallet": getattr(p, "bank_reference", getattr(p, "sender_number_or_wallet", "N/A")),
            "payment_date": formatted_date
        })

    if search:
        s = search.strip().lower()
        results = [
            r for r in results 
            if s in r["student_name"].lower() or s in r["receipt_no"].lower() or s in r["admission_number"].lower() or s in r["transaction_id"].lower()
        ]

    return results


@router.post("/collect", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin"]))])
def collect_student_fee(
    payload: CollectFeePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    student = db.query(Student).filter(
        Student.id == payload.student_id, 
        Student.tenant_id == str(tenant_id)
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    target_month = payload.billing_month.strip()
    target_type = payload.fee_type.strip()

    # 🚀 RIGOROUS AND-LOGIC DUPLICATE CHECK (Only blocks exact same month & fee type)
    existing_payments = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        FeePayment.student_id == student.id
    ).all()

    for p in existing_payments:
        meta = getattr(p, "metadata_payload", {}) or {}
        p_month = meta.get("billing_month") or getattr(p, "billing_month", "") or ""
        p_type = meta.get("fee_type") or getattr(p, "fee_type", "") or getattr(p, "notes", "") or ""
        p_notes = getattr(p, "notes", "") or ""

        month_matched = (p_month.lower() == target_month.lower()) or (target_month.lower() in p_notes.lower())
        type_matched = (target_type.lower() in p_type.lower()) or (target_type.lower() in p_notes.lower())

        if month_matched and type_matched:
            rec_id = getattr(p, "receipt_no", getattr(p, "receipt_number", "REC-EXISTING"))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Fee already recorded for {target_month} ({target_type}). Existing receipt: {rec_id}."
            )

    # Idempotency Protection
    resolved_idemp = payload.idempotency_key or f"IDEMP-FEE-{uuid.uuid4().hex[:12]}"
    existing_idemp = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        FeePayment.idempotency_key == resolved_idemp
    ).first()
    if existing_idemp:
        school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
        return {
            "message": "Payment already recorded (Idempotent)",
            "receipt": format_receipt_payload(existing_idemp, student, school)
        }

    year = datetime.date.today().year
    receipt_no = f"REC-{year}-{uuid.uuid4().hex[:6].upper()}"
    clean_p_method = sanitize_payment_method(payload.payment_method)

    if payload.transaction_id and payload.transaction_id.strip():
        trx_id = payload.transaction_id.strip()
    elif clean_p_method == "CASH":
        trx_id = f"CASH-{uuid.uuid4().hex[:8].upper()}"
    else:
        trx_id = f"TRX-{uuid.uuid4().hex[:10].upper()}"

    # Metadata payload safely stores billing month and fee type
    metadata = {
        "fee_type": target_type,
        "billing_month": target_month,
        "collected_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }

    # 🚀 SAFE DYNAMIC KWARGS (Only includes valid model attributes)
    payment_kwargs = {
        "tenant_id": str(tenant_id),
        "student_id": student.id,
        "currency": "BDT",
        "payment_method": clean_p_method,
        "idempotency_key": resolved_idemp,
        "notes": f"{target_type} - {target_month}"
    }

    if hasattr(FeePayment, "amount_paid"):
        payment_kwargs["amount_paid"] = payload.amount_paid
    if hasattr(FeePayment, "amount"):
        payment_kwargs["amount"] = payload.amount_paid

    if hasattr(FeePayment, "receipt_no"):
        payment_kwargs["receipt_no"] = receipt_no
    if hasattr(FeePayment, "receipt_number"):
        payment_kwargs["receipt_number"] = receipt_no

    if hasattr(FeePayment, "transaction_id"):
        payment_kwargs["transaction_id"] = trx_id
    if hasattr(FeePayment, "provider_transaction_id"):
        payment_kwargs["provider_transaction_id"] = trx_id

    if hasattr(FeePayment, "bank_reference"):
        payment_kwargs["bank_reference"] = payload.sender_number_or_wallet or trx_id
    if hasattr(FeePayment, "sender_number_or_wallet"):
        payment_kwargs["sender_number_or_wallet"] = payload.sender_number_or_wallet or "N/A"

    if hasattr(FeePayment, "metadata_payload"):
        payment_kwargs["metadata_payload"] = metadata
    if hasattr(FeePayment, "payment_status"):
        payment_kwargs["payment_status"] = "COMPLETED"

    # Only assign these if the model actually defines them as columns
    if hasattr(FeePayment, "billing_month"):
        payment_kwargs["billing_month"] = target_month
    if hasattr(FeePayment, "fee_type"):
        payment_kwargs["fee_type"] = target_type
    if hasattr(FeePayment, "remarks"):
        payment_kwargs["remarks"] = payload.remarks

    new_payment = FeePayment(**payment_kwargs)
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()

    return {
        "message": "Fee collected successfully",
        "receipt": format_receipt_payload(new_payment, student, school)
    }