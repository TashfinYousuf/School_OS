import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.finance import FeePayment
from app.models.student import Student
from app.models.tenant import SchoolProfile

router = APIRouter()

class CollectFeePayload(BaseModel):
    student_id: uuid.UUID
    fee_type: str
    billing_month: str
    amount_paid: float
    discount: Optional[float] = 0.0
    payment_method: str  # Cash, bKash, Nagad, Bank, Crypto
    transaction_id: Optional[str] = None # TrxID or Hash (Auto-generated for Cash)
    sender_number_or_wallet: Optional[str] = None
    currency: Optional[str] = "BDT"
    remarks: Optional[str] = None

class PaymentRecordItem(BaseModel):
    id: uuid.UUID
    receipt_no: str
    student_name: str
    admission_number: str
    class_name: Optional[str]
    fee_type: str
    billing_month: str
    amount_paid: float
    currency: str
    payment_method: str
    transaction_id: str
    sender_number_or_wallet: Optional[str]
    payment_date: datetime.datetime

    class Config:
        from_attributes = True

@router.get("/summary")
def get_finance_summary(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    today = datetime.date.today()
    
    total_collected_today = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.tenant_id == str(tenant_id),
        func.date(FeePayment.payment_date) == today
    ).scalar() or 0.0

    total_transactions_today = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        func.date(FeePayment.payment_date) == today
    ).count()

    total_revenue = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.tenant_id == str(tenant_id)
    ).scalar() or 0.0

    return {
        "collected_today": total_collected_today,
        "transactions_today": total_transactions_today,
        "total_revenue": total_revenue
    }

@router.get("/payments", response_model=List[PaymentRecordItem])
def list_fee_payments(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    query = db.query(FeePayment, Student).join(
        Student, Student.id == FeePayment.student_id
    ).filter(FeePayment.tenant_id == str(tenant_id))

    if search:
        query = query.filter(
            (Student.first_name.ilike(f"%{search}%")) |
            (Student.admission_number.ilike(f"%{search}%")) |
            (FeePayment.receipt_no.ilike(f"%{search}%")) |
            (FeePayment.transaction_id.ilike(f"%{search}%"))
        )

    records = query.order_by(FeePayment.payment_date.desc()).limit(100).all()

    output = []
    for pay, st in records:
        output.append({
            "id": pay.id,
            "receipt_no": pay.receipt_no,
            "student_name": f"{st.first_name} {st.last_name}",
            "admission_number": st.admission_number,
            "class_name": st.class_name,
            "fee_type": pay.fee_type,
            "billing_month": pay.billing_month,
            "amount_paid": pay.amount_paid,
            "currency": pay.currency,
            "payment_method": pay.payment_method,
            "transaction_id": pay.transaction_id,
            "sender_number_or_wallet": pay.sender_number_or_wallet,
            "payment_date": pay.payment_date
        })
    return output

@router.post("/collect", status_code=status.HTTP_201_CREATED)
def collect_student_fee(
    payload: CollectFeePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"]))
):
    student = db.query(Student).filter(
        Student.id == payload.student_id, 
        Student.tenant_id == str(tenant_id)
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    year = datetime.date.today().year
    receipt_no = f"REC-{year}-{uuid.uuid4().hex[:6].upper()}"

    # Generate or sanitize TrxID
    trx_id = payload.transaction_id
    if not trx_id or trx_id.strip() == "":
        if payload.payment_method == "Cash":
            trx_id = f"CASH-{uuid.uuid4().hex[:8].upper()}"
        else:
            trx_id = f"TRX-{uuid.uuid4().hex[:10].upper()}"

    new_payment = FeePayment(
        tenant_id=str(tenant_id),
        student_id=payload.student_id,
        receipt_no=receipt_no,
        fee_type=payload.fee_type,
        billing_month=payload.billing_month,
        amount_paid=payload.amount_paid,
        currency=payload.currency or "BDT",
        discount=payload.discount or 0.0,
        payment_method=payload.payment_method,
        transaction_id=trx_id.strip(),
        sender_number_or_wallet=payload.sender_number_or_wallet or "N/A",
        verification_status="Verified",
        remarks=payload.remarks,
        collected_by=claims["user_id"]
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    # Dynamic School Metadata for printable voucher
    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()

    return {
        "message": "Fee collected successfully",
        "receipt": {
            "receipt_no": new_payment.receipt_no,
            "transaction_id": new_payment.transaction_id,
            "school_name": school.school_name if school else "Kids Shine International School",
            "school_address": school.address if school else "Campus Office",
            "student_name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number,
            "class_name": student.class_name,
            "roll_number": student.roll_number or "—",
            "fee_type": new_payment.fee_type,
            "billing_month": new_payment.billing_month,
            "amount_paid": new_payment.amount_paid,
            "currency": new_payment.currency,
            "payment_method": new_payment.payment_method,
            "sender_ref": new_payment.sender_number_or_wallet,
            "date": new_payment.payment_date.strftime("%d %b, %Y • %I:%M %p")
        }
    }