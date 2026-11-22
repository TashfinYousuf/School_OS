import uuid
import datetime
import logging
from decimal import Decimal
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from pydantic import BaseModel, Field, model_validator

from app.core.db_utils import optional_query
from app.api.deps import (
    get_db,
    get_current_tenant_id,
    get_current_user,
    get_current_user_claims,
    require_roles,
    require_permissions,
)
from app.core.rbac import Permission, has_permission
from app.core.security_guard import security_guard
from app.models.finance import (
    FeePayment,
    Invoice,
    InvoiceLineItem,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
)
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.tenant import SchoolProfile, User
from app.schemas.finance import (
    InvoiceCreate,
    InvoiceResponse,
    InvoiceLineItemCreate,
    InvoiceLineItemResponse,
)
from app.services.payment_providers import PaymentProviderFactory
from app.services.institution import get_institution_profile

logger = logging.getLogger(__name__)
router = APIRouter()


class CollectFeePayload(BaseModel):
    student_id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
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


def format_receipt_payload(
    payment: Any, 
    student: Any, 
    school: Any = None, 
    db: Optional[Session] = None,
    tenant_id: Optional[str] = None
) -> dict:
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

    effective_tid = tenant_id or getattr(payment, "tenant_id", None) or getattr(student, "tenant_id", None)
    school_name = getattr(school, "name", "EducationOS Institution")
    school_address = getattr(school, "address", "") or "Campus Address"

    if db is not None and hasattr(db, "query") and effective_tid:
        try:
            inst = get_institution_profile(db, effective_tid)
            school_name = inst.name
            school_address = " • ".join(p for p in (inst.address, f"Phone: {inst.phone}" if inst.phone else None) if p)
        except Exception:
            pass
    
    return {
        "receipt_no": rec,
        "transaction_id": trx,
        "payment_status": getattr(payment, "payment_status", "COMPLETED"),
        "school_name": school_name,
        "school_address": school_address,
        "student_name": f"{student.first_name} {student.last_name}" if student else "Student Record",
        "admission_number": student.admission_number if student else "N/A",
        "class_name": (student.class_name if student else None) or "N/A",
        "roll_number": (student.roll_number if student else None) or "—",
        "fee_type": actual_fee_type,
        "billing_month": actual_month,
        "amount_paid": float(amt),
        "currency": "BDT",
        "payment_method": clean_method,
        "sender_ref": getattr(payment, "bank_reference", getattr(payment, "sender_number_or_wallet", "N/A")),
        "date": dt_str
    }


# ----------------------------------------------------------------------------------------
# 1. Financial KPI Summary
# ----------------------------------------------------------------------------------------
@router.get("/summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_SUMMARY_READ]))
):
    now = datetime.datetime.now(datetime.timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = today_start.replace(day=1)

    # 1. Total Collection Today (Only COMPLETED payments)
    today_collection = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.payment_status == "COMPLETED",
            FeePayment.created_at >= today_start
        ).scalar() or 0.0),
        0.0,
        "finance.summary.today"
    )

    # 2. Total Collection This Month
    month_collection = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.payment_status == "COMPLETED",
            FeePayment.created_at >= month_start
        ).scalar() or 0.0),
        0.0,
        "finance.summary.month"
    )

    # 3. Pending Invoices Total
    pending_dues = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(Invoice.total_amount - Invoice.discount_amount - Invoice.paid_amount), 0)).filter(
            Invoice.tenant_id == str(tenant_id),
            Invoice.status.in_([InvoiceStatus.ISSUED.value, InvoiceStatus.PARTIALLY_PAID.value, InvoiceStatus.OVERDUE.value])
        ).scalar() or 0.0),
        0.0,
        "finance.summary.pending_dues"
    )

    # 4. Total Completed Transactions Today
    transactions_today = optional_query(
        db,
        lambda: db.query(FeePayment).filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.payment_status == "COMPLETED",
            FeePayment.created_at >= today_start
        ).count(),
        0,
        "finance.summary.tx_today"
    )

    # 5. Cumulative Total Revenue (All-time completed payments, does NOT reset monthly)
    cumulative_revenue = optional_query(
        db,
        lambda: float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.payment_status == "COMPLETED"
        ).scalar() or 0.0),
        0.0,
        "finance.summary.cumulative_revenue"
    )

    current_month_name = now.strftime("%B %Y")

    return {
        # Frontend contract properties
        "collected_today": today_collection,
        "transactions_today": transactions_today,
        "this_month_collection": month_collection,
        "total_revenue": cumulative_revenue,
        "cumulative_revenue": cumulative_revenue,
        "current_month_label": f"{current_month_name} Collection",

        # Standard canonical properties
        "today_collection": today_collection,
        "month_collection": month_collection,
        "total_pending_dues": pending_dues,
        "currency": "BDT",
        "timestamp": now.isoformat()
    }


# ----------------------------------------------------------------------------------------
# 2. Fee Collection Ledger & Historical Archives
# ----------------------------------------------------------------------------------------
@router.get("/ledger")
@router.get("/payments")
def get_finance_ledger(
    search: Optional[str] = None,
    student_id: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    limit: int = 150,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_PAYMENTS_READ]))
):
    query = db.query(FeePayment).filter(FeePayment.tenant_id == str(tenant_id))

    if student_id:
        try:
            s_uid = uuid.UUID(str(student_id))
            query = query.filter(FeePayment.student_id == s_uid)
        except (ValueError, AttributeError):
            pass

    if search and search.strip():
        s_term = f"%{search.strip()}%"
        query = query.outerjoin(Student, FeePayment.student_id == Student.id).filter(
            or_(
                FeePayment.transaction_id.ilike(s_term),
                FeePayment.receipt_no.ilike(s_term),
                FeePayment.notes.ilike(s_term),
                Student.first_name.ilike(s_term),
                Student.last_name.ilike(s_term),
                Student.admission_number.ilike(s_term)
            )
        )

    if year and month:
        import calendar
        _, last_day = calendar.monthrange(year, month)
        start_dt = datetime.datetime(year, month, 1, 0, 0, 0, tzinfo=datetime.timezone.utc)
        end_dt = datetime.datetime(year, month, last_day, 23, 59, 59, tzinfo=datetime.timezone.utc)
        query = query.filter(FeePayment.created_at >= start_dt, FeePayment.created_at <= end_dt)

    date_col = getattr(FeePayment, "created_at", getattr(FeePayment, "payment_date", FeePayment.id))
    try:
        payments = query.order_by(date_col.desc()).limit(limit).all()
    except Exception as e:
        logger.warning(f"Error querying FeePayment ledger: {e}")
        db.rollback()
        payments = []

    results = []
    for p in payments:
        try:
            st_uuid = uuid.UUID(str(p.student_id))
        except (ValueError, AttributeError):
            st_uuid = p.student_id
        st = db.query(Student).filter(Student.id == st_uuid, Student.tenant_id == str(tenant_id)).first()

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
            "student_id": str(p.student_id),
            "receipt_no": rec,
            "student_name": student_name,
            "admission_number": adm_no,
            "class_name": cls_name,
            "fee_type": fee_name,
            "billing_month": month_name,
            "amount_paid": amt,
            "currency": "BDT",
            "payment_method": sanitize_payment_method(getattr(p, "payment_method", "CASH")),
            "payment_status": getattr(p, "payment_status", "COMPLETED"),
            "transaction_id": trx,
            "sender_number_or_wallet": getattr(p, "bank_reference", getattr(p, "sender_number_or_wallet", "N/A")),
            "payment_date": formatted_date
        })

    return results


@router.get("/reports/monthly")
def get_monthly_finance_report(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_SUMMARY_READ]))
):
    """
    Generates historical, printable monthly fee collection report with category and payment method breakdown.
    """
    from zoneinfo import ZoneInfo
    import calendar

    now = datetime.datetime.now(ZoneInfo("Asia/Dhaka"))
    target_year = year or now.year
    target_month = month or now.month

    _, last_day = calendar.monthrange(target_year, target_month)
    start_dt = datetime.datetime(target_year, target_month, 1, 0, 0, 0, tzinfo=ZoneInfo("Asia/Dhaka"))
    end_dt = datetime.datetime(target_year, target_month, last_day, 23, 59, 59, tzinfo=ZoneInfo("Asia/Dhaka"))

    payments = (
        db.query(FeePayment)
        .filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.payment_status == "COMPLETED",
            FeePayment.created_at >= start_dt,
            FeePayment.created_at <= end_dt
        )
        .order_by(FeePayment.created_at.desc())
        .all()
    )

    total_collected = sum(float(getattr(p, "amount", 0.0)) for p in payments)
    total_tx = len(payments)

    by_type: Dict[str, Dict[str, Any]] = {}
    by_method: Dict[str, Dict[str, Any]] = {}
    itemized = []

    for p in payments:
        meta = getattr(p, "metadata_payload", {}) or {}
        notes_str = getattr(p, "notes", "") or ""
        ftype = meta.get("fee_type") or getattr(p, "fee_type", None) or (notes_str.split(" - ")[0] if " - " in notes_str else "Monthly Tuition Fee")
        method = sanitize_payment_method(getattr(p, "payment_method", "CASH"))
        amt = float(getattr(p, "amount", 0.0))

        if ftype not in by_type:
            by_type[ftype] = {"category": ftype, "amount": 0.0, "count": 0}
        by_type[ftype]["amount"] += amt
        by_type[ftype]["count"] += 1

        if method not in by_method:
            by_method[method] = {"method": method, "amount": 0.0, "count": 0}
        by_method[method]["amount"] += amt
        by_method[method]["count"] += 1

        st = db.query(Student).filter(Student.id == p.student_id, Student.tenant_id == str(tenant_id)).first()
        itemized.append({
            "receipt_no": getattr(p, "receipt_no", getattr(p, "receipt_number", "REC-PENDING")),
            "transaction_id": getattr(p, "transaction_id", getattr(p, "provider_transaction_id", "N/A")),
            "student_id": str(p.student_id),
            "student_name": f"{st.first_name} {st.last_name}" if st else "Student Record",
            "admission_number": st.admission_number if st else "N/A",
            "class_name": st.class_name if st else "N/A",
            "fee_type": ftype,
            "amount": amt,
            "payment_method": method,
            "date": p.created_at.strftime("%d %b, %Y") if p.created_at else "N/A"
        })

    inst = get_institution_profile(db, tenant_id)
    month_label = start_dt.strftime("%B %Y")

    return {
        "year": target_year,
        "month": target_month,
        "month_name": month_label,
        "total_collected": total_collected,
        "total_transactions": total_tx,
        "currency": "BDT",
        "breakdown_by_category": list(by_type.values()),
        "breakdown_by_method": list(by_method.values()),
        "itemized_transactions": itemized,
        "institution": {
            "name": inst.name,
            "address": inst.address,
            "phone": inst.phone,
            "logo_url": inst.logo_url
        },
        "generated_at": now.isoformat()
    }


@router.get("/students/{student_id}/history")
def get_student_fee_history(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_claims),
    _=Depends(require_roles(["admin", "superadmin", "finance_officer", "accountant", "teacher", "guardian", "student"]))
):
    """
    Returns student-specific historical fee records, completed receipts, and invoice status.
    Strictly verifies ownership/scope to eliminate horizontal BOLA/IDOR (SEC-AUDIT-IDOR-01).
    """
    st = db.query(Student).filter(Student.id == student_id, Student.tenant_id == str(tenant_id)).first()
    if not st:
        raise HTTPException(status_code=404, detail="Student record not found in this institution")

    # Enforce Scope Authorization (SEC-AUDIT-IDOR-01)
    security_guard.verify_student_scope(
        current_user_role=current_user.get("role"),
        current_user_id=current_user.get("user_id"),
        student=st,
        db=db
    )

    payments = (
        db.query(FeePayment)
        .filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.student_id == student_id
        )
        .order_by(FeePayment.created_at.desc())
        .all()
    )

    invoices = (
        db.query(Invoice)
        .filter(
            Invoice.tenant_id == str(tenant_id),
            Invoice.student_id == student_id
        )
        .order_by(Invoice.created_at.desc())
        .all()
    )

    total_paid = sum(float(getattr(p, "amount", 0.0)) for p in payments if getattr(p, "payment_status", "COMPLETED") == "COMPLETED")
    total_due = sum(float(inv.total_amount - inv.discount_amount - inv.paid_amount) for inv in invoices if inv.status in (InvoiceStatus.ISSUED.value, InvoiceStatus.PARTIALLY_PAID.value, InvoiceStatus.OVERDUE.value))

    payment_history = []
    for p in payments:
        meta = getattr(p, "metadata_payload", {}) or {}
        notes_str = getattr(p, "notes", "") or ""
        fee_name = meta.get("fee_type") or getattr(p, "fee_type", None) or (notes_str.split(" - ")[0] if " - " in notes_str else "Tuition Fee")
        p_date = getattr(p, "created_at", getattr(p, "payment_date", datetime.datetime.now()))
        formatted_date = p_date.strftime("%d %b, %Y") if isinstance(p_date, (datetime.datetime, datetime.date)) else "N/A"

        payment_history.append({
            "id": str(p.id),
            "receipt_no": getattr(p, "receipt_no", getattr(p, "receipt_number", "REC-PENDING")),
            "transaction_id": getattr(p, "transaction_id", getattr(p, "provider_transaction_id", "N/A")),
            "fee_type": fee_name,
            "amount": float(getattr(p, "amount", 0.0)),
            "payment_method": sanitize_payment_method(getattr(p, "payment_method", "CASH")),
            "payment_status": getattr(p, "payment_status", "COMPLETED"),
            "date": formatted_date
        })

    invoice_list = [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "title": inv.title,
            "total_amount": float(inv.total_amount),
            "paid_amount": float(inv.paid_amount),
            "due_amount": float(inv.total_amount - inv.discount_amount - inv.paid_amount),
            "due_date": str(inv.due_date) if inv.due_date else None,
            "status": inv.status
        }
        for inv in invoices
    ]

    return {
        "student": {
            "id": str(st.id),
            "first_name": st.first_name,
            "last_name": st.last_name,
            "admission_number": st.admission_number,
            "class_name": st.class_name,
            "roll_number": st.roll_number,
            "shift": st.shift,
            "section": st.section
        },
        "total_paid": total_paid,
        "total_due": max(0.0, total_due),
        "currency": "BDT",
        "payment_history": payment_history,
        "invoices": invoice_list
    }


# ----------------------------------------------------------------------------------------
# 3. Fee Collection Endpoint (BLK-P0-08 Hardened)
# ----------------------------------------------------------------------------------------
@router.post("/collect", status_code=status.HTTP_201_CREATED)
async def collect_student_fee(
    payload: CollectFeePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_PAYMENTS_RECORD])),
    current_user: User = Depends(get_current_user),
):
    """
    Records student fee payment with:
    - Concurrency row locking
    - BLK-P0-08 client assertion rejection (unverified MFS marks PENDING)
    - Cashier context verification for cash desk collections
    - Automatic invoice linkage and balance deduction
    """
    student = db.query(Student).filter(
        Student.id == payload.student_id, 
        Student.tenant_id == str(tenant_id)
    ).with_for_update().first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found.")

    target_month = payload.billing_month.strip()
    target_type = payload.fee_type.strip()

    # Duplicate check for exact same month & fee type
    existing_payments = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        FeePayment.student_id == student.id,
        FeePayment.payment_status.in_(["COMPLETED", "PENDING"])
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
            "receipt": format_receipt_payload(existing_idemp, student, school, db, str(tenant_id))
        }

    year = datetime.date.today().year
    receipt_no = f"REC-{year}-{uuid.uuid4().hex[:6].upper()}"
    clean_p_method = sanitize_payment_method(payload.payment_method)

    # 🚀 BLK-P0-08 Remediation: Provider Processing & Verification
    provider = PaymentProviderFactory.get_provider(clean_p_method)
    exec_result = await provider.process_payment(
        tenant_id=str(tenant_id),
        amount=Decimal(str(payload.amount_paid)),
        receipt_number=receipt_no,
        client_metadata={
            "cashier_user_id": str(current_user.id),
            "transaction_id": payload.transaction_id,
            "bKash_trx_id": payload.transaction_id,
            "nagad_trx_id": payload.transaction_id,
            "bank_reference": payload.sender_number_or_wallet,
        }
    )

    if not exec_result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment execution failed: {exec_result.message}"
        )

    resolved_trx_id = exec_result.transaction_id or f"TRX-{uuid.uuid4().hex[:10].upper()}"
    resolved_status = exec_result.status  # "COMPLETED" or "PENDING"

    # Invoice Linkage & Balance Application
    linked_invoice = None
    if payload.invoice_id:
        linked_invoice = db.query(Invoice).filter(
            Invoice.id == payload.invoice_id,
            Invoice.tenant_id == str(tenant_id)
        ).with_for_update().first()
        if not linked_invoice:
            raise HTTPException(status_code=404, detail="Invoice record not found.")
        if linked_invoice.status in (InvoiceStatus.PAID.value, InvoiceStatus.CANCELLED.value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot apply payment to invoice with status '{linked_invoice.status}'."
            )

        # If payment is already COMPLETED (e.g. verified cash desk), apply immediately
        if resolved_status == "COMPLETED":
            linked_invoice.paid_amount = (linked_invoice.paid_amount or Decimal("0.00")) + Decimal(str(payload.amount_paid))
            net_payable = linked_invoice.total_amount - (linked_invoice.discount_amount or Decimal("0.00"))
            if linked_invoice.paid_amount >= net_payable:
                linked_invoice.status = InvoiceStatus.PAID.value
            else:
                linked_invoice.status = InvoiceStatus.PARTIALLY_PAID.value

    # Metadata payload safely stores billing month and fee type
    metadata = {
        "fee_type": target_type,
        "billing_month": target_month,
        "collected_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "provider_response": exec_result.raw_response
    }

    new_payment = FeePayment(
        tenant_id=str(tenant_id),
        student_id=str(student.id),
        invoice_id=linked_invoice.id if linked_invoice else None,
        amount=Decimal(str(payload.amount_paid)),
        currency="BDT",
        payment_method=clean_p_method,
        payment_status=resolved_status,
        receipt_number=receipt_no,
        provider_transaction_id=resolved_trx_id,
        bank_reference=payload.sender_number_or_wallet or resolved_trx_id,
        collected_by_user_id=str(current_user.id) if clean_p_method == "CASH" else None,
        idempotency_key=resolved_idemp,
        metadata_payload=metadata,
        notes=f"{target_type} - {target_month}"
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()

    return {
        "message": (
            "Fee collected successfully"
            if resolved_status == "COMPLETED"
            else "Payment registered with status PENDING. Awaiting provider confirmation or signed webhook callback."
        ),
        "receipt": format_receipt_payload(new_payment, student, school, db, str(tenant_id))
    }


# ----------------------------------------------------------------------------------------
# 4. Cryptographic Provider Webhook Callback Endpoint
# ----------------------------------------------------------------------------------------
@router.post("/webhook/{provider_name}", status_code=status.HTTP_200_OK)
async def payment_webhook_callback(
    provider_name: str,
    request: Request,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
):
    """
    Receives and processes asynchronous webhook notifications from MFS payment gateways.
    Strictly enforces cryptographic signature verification (HMAC-SHA256).
    """
    signature = x_signature or x_webhook_signature
    body_bytes = await request.body()

    try:
        provider = PaymentProviderFactory.get_provider(provider_name)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unsupported webhook provider '{provider_name}'.")

    secret = getattr(provider, "webhook_secret", getattr(provider, "store_passwd", "")) or ""
    if not secret.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Webhook signing secret for '{provider_name}' is not configured.",
        )
    if not provider.verify_webhook_signature(body_bytes, signature or "", secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security Policy Violation: Cryptographic webhook signature verification failed."
        )

    import json
    try:
        data = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON webhook payload.")

    trx_id = data.get("transaction_id") or data.get("trx_id")
    receipt_no = data.get("receipt_no") or data.get("receipt_number")
    provider_status = (data.get("status") or "").upper()

    payment = None
    if receipt_no:
        payment = db.query(FeePayment).filter(
            FeePayment.receipt_number == receipt_no,
            FeePayment.tenant_id == str(tenant_id)
        ).with_for_update().first()
    elif trx_id:
        payment = db.query(FeePayment).filter(
            FeePayment.provider_transaction_id == trx_id,
            FeePayment.tenant_id == str(tenant_id)
        ).with_for_update().first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment record matching webhook parameters not found.")

    # Idempotent handling
    if payment.payment_status == "COMPLETED":
        return {"status": "ALREADY_COMPLETED", "receipt_number": payment.receipt_number}

    if provider_status in ("COMPLETED", "SUCCESS", "PAID"):
        payment.payment_status = "COMPLETED"
        payment.is_reconciled = True
        payment.reconciled_at = datetime.datetime.now(datetime.timezone.utc)
        if trx_id:
            payment.provider_transaction_id = trx_id

        # Update linked invoice
        if payment.invoice_id:
            invoice = db.query(Invoice).filter(
                Invoice.id == payment.invoice_id,
                Invoice.tenant_id == str(tenant_id)
            ).with_for_update().first()
            if invoice:
                invoice.paid_amount = (invoice.paid_amount or Decimal("0.00")) + payment.amount
                net_payable = invoice.total_amount - (invoice.discount_amount or Decimal("0.00"))
                if invoice.paid_amount >= net_payable:
                    invoice.status = InvoiceStatus.PAID.value
                else:
                    invoice.status = InvoiceStatus.PARTIALLY_PAID.value

        db.commit()
        return {
            "status": "ACKNOWLEDGED",
            "receipt_number": payment.receipt_number,
            "payment_status": "COMPLETED"
        }

    elif provider_status in ("FAILED", "CANCELLED"):
        payment.payment_status = "FAILED"
        db.commit()
        return {
            "status": "ACKNOWLEDGED",
            "receipt_number": payment.receipt_number,
            "payment_status": "FAILED"
        }

    return {"status": "IGNORED", "receipt_number": payment.receipt_number}


# ----------------------------------------------------------------------------------------
# 5. Invoicing Architecture Endpoints
# ----------------------------------------------------------------------------------------
@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_INVOICES_CREATE]))
):
    """
    Creates an authoritative student billing invoice with line items.
    Calculates amounts using Decimal fixed precision.
    """
    student = db.query(Student).filter(
        Student.id == payload.student_id,
        Student.tenant_id == str(tenant_id)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this institution.")

    # Calculate item totals
    total_amount = Decimal("0.00")
    for item in payload.items:
        item_amt = Decimal(str(item.amount))
        total_amount += item_amt

    discount = Decimal(str(payload.discount_amount or "0.00"))
    if discount > total_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount amount cannot exceed total invoice amount."
        )

    year = datetime.date.today().year
    inv_number = f"INV-{year}-{uuid.uuid4().hex[:6].upper()}"

    invoice = Invoice(
        tenant_id=str(tenant_id),
        student_id=str(student.id),
        invoice_number=inv_number,
        title=payload.title or "Monthly Tuition Invoice",
        billing_month=payload.billing_month,
        total_amount=total_amount,
        paid_amount=Decimal("0.00"),
        discount_amount=discount,
        currency=payload.currency or "BDT",
        status=InvoiceStatus.ISSUED.value,
        due_date=payload.due_date,
    )
    db.add(invoice)
    db.flush()

    for item in payload.items:
        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            tenant_id=str(tenant_id),
            description=item.description,
            quantity=item.quantity or 1,
            unit_price=item.unit_price or item.amount,
            amount=item.amount,
        )
        db.add(line_item)

    db.commit()
    db.refresh(invoice)
    return invoice


@router.get("/invoices", response_model=List[InvoiceResponse])
def list_invoices(
    student_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.FINANCE_INVOICES_READ]))
):
    query = db.query(Invoice).filter(Invoice.tenant_id == str(tenant_id))
    if student_id:
        query = query.filter(Invoice.student_id == str(student_id))
    if status_filter:
        query = query.filter(Invoice.status == status_filter.upper())

    return query.order_by(Invoice.created_at.desc()).limit(100).all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
def get_invoice_details(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.tenant_id == str(tenant_id)
    ).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice record not found.")

    user_role = (claims.get("role") or "").lower()
    user_id = claims.get("user_id")

    # Resource-Level Access Control (IDOR / BOLA Guard)
    if user_role == "guardian":
        try:
            u_uid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
        except (ValueError, TypeError):
            u_uid = None
        guardian = db.query(Guardian).filter(
            (Guardian.id == u_uid) | (Guardian.user_id == u_uid),
            Guardian.tenant_id == str(tenant_id)
        ).first()

        if not guardian:
            raise HTTPException(status_code=403, detail="Access denied: No guardian profile associated.")

        try:
            st_uuid = uuid.UUID(str(invoice.student_id))
        except (ValueError, AttributeError):
            st_uuid = invoice.student_id

        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.guardian_id == guardian.id,
            GuardianStudentLink.student_id == st_uuid,
            GuardianStudentLink.tenant_id == str(tenant_id),
            GuardianStudentLink.verification_status == "VERIFIED",
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Access denied: You are not authorized to view this invoice.")

    elif user_role == "student":
        try:
            st_uuid = uuid.UUID(str(invoice.student_id))
        except (ValueError, AttributeError):
            st_uuid = invoice.student_id
        student = db.query(Student).filter(Student.id == st_uuid, Student.tenant_id == str(tenant_id)).first()
        if not student or str(student.user_id) != str(user_id):
            raise HTTPException(status_code=403, detail="Access denied: Students can only view their own invoices.")

    elif not has_permission(user_role, Permission.FINANCE_INVOICES_READ):
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions to view invoices.")

    return invoice


# ----------------------------------------------------------------------------------------
# 6. Receipts
# ----------------------------------------------------------------------------------------
@router.get("/receipts/{payment_id}")
def get_payment_receipt_record(
    payment_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    user_role = (claims.get("role") or "").lower()
    if user_role not in ("admin", "superadmin", "teacher", "finance_officer", "accountant", "guardian", "student"):
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions to view receipt.")

    payment = security_guard.get_or_404_tenant_resource(
        db=db,
        model_class=FeePayment,
        resource_id=payment_id,
        current_tenant_id=tenant_id,
        resource_name="Fee Payment"
    )

    try:
        st_uuid = uuid.UUID(str(payment.student_id))
    except (ValueError, AttributeError):
        st_uuid = payment.student_id
    student = db.query(Student).filter(
        Student.id == st_uuid,
        Student.tenant_id == str(tenant_id)
    ).first()
    if user_role in ("guardian", "student"):
        if not student:
            raise HTTPException(status_code=403, detail="Forbidden: Receipt student record could not be verified.")
        user_id_str = str(claims.get("user_id") or "")
        security_guard.verify_student_scope(user_role, user_id_str, student, db)
    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()

    return format_receipt_payload(payment, student, school, db, str(tenant_id))


# ----------------------------------------------------------------------------------------
# 7. Append-Only Ledger Reversal (Separation of Duties)
# ----------------------------------------------------------------------------------------
class PaymentReversalPayload(BaseModel):
    payment_id: uuid.UUID
    reason: str = Field(..., min_length=5, json_schema_extra={"example": "Accidental double billing by cashier"})


@router.post("/reversal", status_code=status.HTTP_200_OK)
def reverse_payment_transaction(
    payload: PaymentReversalPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
    claims: dict = Depends(require_permissions([Permission.FINANCE_REFUNDS_APPROVE]))
):
    """
    Append-Only Ledger Reversal with strict separation of duties.
    Only authorized administrators (with finance.refunds.approve) can execute reversals.
    Prevents double-reversal via row locking and reverses invoice balances if linked.
    """
    original_payment = db.query(FeePayment).filter(
        FeePayment.id == payload.payment_id,
        FeePayment.tenant_id == str(tenant_id)
    ).with_for_update().first()

    if not original_payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    if original_payment.is_reversed or original_payment.payment_status in ["REVERSED", "ADJUSTED"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Transaction already reversed or adjusted."
        )

    now = datetime.datetime.now(datetime.timezone.utc)
    reversal_receipt_no = f"REV-{datetime.date.today().year}-{uuid.uuid4().hex[:6].upper()}"
    reversal_idemp = f"IDEMP-REV-{uuid.uuid4().hex[:12]}"

    # 1. Flag Original Payment as REVERSED
    original_payment.is_reversed = True
    original_payment.payment_status = "REVERSED"
    original_payment.reversal_reason = payload.reason
    original_payment.reversed_by_user_id = str(current_user.id)
    original_payment.reversed_at = now

    # 2. Revert invoice balance if payment was linked
    if original_payment.invoice_id:
        invoice = db.query(Invoice).filter(
            Invoice.id == original_payment.invoice_id,
            Invoice.tenant_id == str(tenant_id)
        ).with_for_update().first()
        if invoice:
            invoice.paid_amount = max(Decimal("0.00"), (invoice.paid_amount or Decimal("0.00")) - original_payment.amount)
            net_payable = invoice.total_amount - (invoice.discount_amount or Decimal("0.00"))
            if invoice.paid_amount <= Decimal("0.00"):
                invoice.status = InvoiceStatus.ISSUED.value
            elif invoice.paid_amount < net_payable:
                invoice.status = InvoiceStatus.PARTIALLY_PAID.value

    # 3. Append Negative Ledger Balancing Entry
    reversal_entry = FeePayment(
        tenant_id=str(tenant_id),
        student_id=str(original_payment.student_id),
        invoice_id=original_payment.invoice_id,
        amount=-abs(original_payment.amount),
        currency="BDT",
        payment_method=original_payment.payment_method,
        payment_status="ADJUSTED",
        receipt_number=reversal_receipt_no,
        provider_transaction_id=f"REV-FOR-{original_payment.receipt_number}",
        idempotency_key=reversal_idemp,
        notes=f"Reversal Adjustment: {payload.reason} (Ref: {original_payment.receipt_number})",
        reversal_reference_id=original_payment.id,
        metadata_payload={
            "original_receipt": original_payment.receipt_number,
            "reversal_reason": payload.reason,
            "reversed_by": str(current_user.id)
        }
    )

    db.add(reversal_entry)
    db.commit()

    return {
        "message": "Payment transaction reversed cleanly in append-only ledger.",
        "original_receipt": original_payment.receipt_number,
        "reversal_receipt": reversal_receipt_no,
        "adjusted_amount": float(reversal_entry.amount),
        "status": "REVERSED"
    }


# ----------------------------------------------------------------------------------------
# 8. Hard Delete Blocker
# ----------------------------------------------------------------------------------------
@router.delete("/{payment_id}")
def block_payment_delete():
    raise HTTPException(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        detail="Financial Compliance Violation: Hard deletes are strictly prohibited on fee records. Use /reversal for accounting adjustments."
    )
