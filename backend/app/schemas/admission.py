# backend/app/schemas/admission.py
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field


class AdmissionSessionBase(BaseModel):
    academic_year: str = Field(default="2026", max_length=20)
    session_name: str = Field(..., min_length=1, max_length=100)
    admission_model: str = Field(default="MODEL_B", pattern="^(MODEL_A|MODEL_B)$")
    status: str = Field(default="OPEN", pattern="^(DRAFT|OPEN|CLOSED|ARCHIVED)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    application_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    final_admission_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    class_fees: Optional[Dict[str, Any]] = None
    max_seats: Optional[Dict[str, Any]] = None
    eligibility_criteria: Optional[str] = None
    entrance_exam_date: Optional[datetime] = None
    entrance_exam_venue: Optional[str] = None


class AdmissionSessionCreate(AdmissionSessionBase):
    pass


class AdmissionSessionUpdate(BaseModel):
    session_name: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(DRAFT|OPEN|CLOSED|ARCHIVED)$")
    admission_model: Optional[str] = Field(None, pattern="^(MODEL_A|MODEL_B)$")
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    application_fee: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    final_admission_fee: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    class_fees: Optional[Dict[str, Any]] = None
    max_seats: Optional[Dict[str, Any]] = None
    eligibility_criteria: Optional[str] = None
    entrance_exam_date: Optional[datetime] = None
    entrance_exam_venue: Optional[str] = None


class AdmissionSessionResponse(AdmissionSessionBase):
    id: uuid.UUID
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdmissionApplicationBase(BaseModel):
    session_id: Optional[uuid.UUID] = None
    admission_model: Optional[str] = Field(default="MODEL_B", max_length=20)
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name_bn: Optional[str] = Field(None, max_length=100)
    last_name_bn: Optional[str] = Field(None, max_length=100)
    name_bn: Optional[str] = Field(None, max_length=200)
    class_name: str = Field(..., min_length=1, max_length=50)
    academic_year: str = Field(default="2026", max_length=20)
    shift: Optional[str] = Field("Morning", max_length=50)
    group: Optional[str] = Field(None, max_length=50)
    desired_section: Optional[str] = Field(None, max_length=50)
    date_of_birth: Optional[date] = None
    gender: str = Field(default="Male", max_length=20)
    blood_group: Optional[str] = Field(None, max_length=10)
    nationality: Optional[str] = Field("Bangladeshi", max_length=50)
    religion: Optional[str] = Field(None, max_length=50)
    birth_registration_number: Optional[str] = Field(None, max_length=50)
    previous_school: Optional[str] = Field(None, max_length=150)
    
    father_name_en: Optional[str] = Field(None, max_length=150)
    father_name_bn: Optional[str] = Field(None, max_length=150)
    mother_name_en: Optional[str] = Field(None, max_length=150)
    mother_name_bn: Optional[str] = Field(None, max_length=150)
    guardian_name: str = Field(..., min_length=1, max_length=150)
    guardian_relationship: str = Field(default="Father", max_length=50)
    guardian_phone: str = Field(..., min_length=7, max_length=50)
    guardian_email: Optional[str] = Field(None, max_length=100)
    guardian_nid: Optional[str] = Field(None, max_length=50)
    
    present_address: Optional[str] = None
    permanent_address: Optional[str] = None
    address: Optional[str] = None
    division: Optional[str] = Field(None, max_length=50)
    district: Optional[str] = Field(None, max_length=50)
    upazila: Optional[str] = Field(None, max_length=50)
    union_ward: Optional[str] = Field(None, max_length=50)
    
    previous_board: Optional[str] = Field(None, max_length=50)
    previous_roll: Optional[str] = Field(None, max_length=50)
    previous_gpa: Optional[str] = Field(None, max_length=20)
    declaration_accepted: bool = Field(default=False)
    application_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    final_admission_fee: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))


class AdmissionApplicationCreate(AdmissionApplicationBase):
    documents_metadata: Optional[Dict[str, Any]] = None


class AdmissionApplicationUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    class_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_relationship: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[str] = None
    address: Optional[str] = None
    documents_metadata: Optional[Dict[str, Any]] = None


class AdmissionReviewPayload(BaseModel):
    notes: Optional[str] = None


class AdmissionRejectPayload(BaseModel):
    rejection_reason: str = Field(..., min_length=3, max_length=500)


class AdmissionEnrollPayload(BaseModel):
    section: Optional[str] = Field(default="A", max_length=20)
    roll_number: Optional[str] = Field(None, max_length=50)
    custom_admission_number: Optional[str] = Field(None, max_length=50)


class AdmissionExamSchedulePayload(BaseModel):
    exam_date: Optional[datetime] = None
    venue: Optional[str] = Field(None, max_length=200)
    roll_number: Optional[str] = Field(None, max_length=50)


class AdmissionExamScorePayload(BaseModel):
    score: Decimal = Field(..., ge=Decimal("0.00"), le=Decimal("100.00"))
    marks_details: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class AdmissionSelectionPayload(BaseModel):
    selection_status: str = Field(..., pattern="^(SELECTED|WAITLISTED|NOT_SELECTED)$")
    notes: Optional[str] = None


class AdmissionManualPaymentSubmitPayload(BaseModel):
    fee_category: str = Field(default="APPLICATION_FEE", pattern="^(APPLICATION_FEE|FINAL_ADMISSION_FEE)$")
    payment_method: str = Field(..., min_length=2, max_length=50)
    transaction_reference: str = Field(..., min_length=3, max_length=100)
    amount_paid: Optional[Decimal] = Field(None, ge=Decimal("0.00"))
    notes: Optional[str] = None


class AdmissionPaymentVerifyPayload(BaseModel):
    fee_category: str = Field(default="APPLICATION_FEE", pattern="^(APPLICATION_FEE|FINAL_ADMISSION_FEE)$")
    payment_method: Optional[str] = Field("Cash Counter", max_length=50)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class AdmissionReceiptResponse(BaseModel):
    id: uuid.UUID
    tenant_id: str
    receipt_number: str
    application_id: uuid.UUID
    student_id: Optional[uuid.UUID] = None
    invoice_id: Optional[uuid.UUID] = None
    amount_paid: Decimal
    currency: str = "BDT"
    payment_method: str
    transaction_reference: str
    fee_category: str
    receipt_payload: Dict[str, Any]
    issued_by_user_id: Optional[str] = None
    issued_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdmissionApplicationResponse(AdmissionApplicationBase):
    id: uuid.UUID
    tenant_id: str
    application_number: str
    status: str
    rejection_reason: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by_user_id: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    enrolled_student_id: Optional[uuid.UUID] = None
    payment_status: str
    invoice_id: Optional[uuid.UUID] = None
    final_fee_payment_status: Optional[str] = "PENDING"
    final_invoice_id: Optional[uuid.UUID] = None
    admit_card_number: Optional[str] = None
    entrance_exam_roll: Optional[str] = None
    entrance_exam_score: Optional[Decimal] = None
    entrance_exam_details: Optional[Dict[str, Any]] = None
    selection_status: Optional[str] = "PENDING"
    documents_metadata: Optional[Dict[str, Any]] = None
    submitted_at: Optional[datetime] = None
    enrolled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


