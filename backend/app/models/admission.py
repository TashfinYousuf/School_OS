# backend/app/models/admission.py
import uuid
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Column,
    String,
    Date,
    DateTime,
    Text,
    Numeric,
    ForeignKey,
    UniqueConstraint,
    Index,
    Boolean,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base, SafeUUID


class AdmissionSession(Base):
    """
    Configurable Institutional Admission Intake Session.
    Supports:
    - MODEL A: Application -> Application Fee -> Selection/Exam -> Final Admission Fee -> Enrollment
    - MODEL B: Direct Admission -> Document Submission -> Admission Fee -> Approval & Enrollment
    """
    __tablename__ = "admission_sessions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "academic_year", "session_name", name="uq_tenant_session_name"),
        Index("ix_admission_sessions_tenant", "tenant_id", "status"),
        {"extend_existing": True},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(20), default="2026", nullable=False)
    session_name: Mapped[str] = mapped_column(String(100), nullable=False)
    admission_model: Mapped[str] = mapped_column(String(20), default="MODEL_B", nullable=False) # MODEL_A or MODEL_B
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False) # DRAFT, OPEN, CLOSED, ARCHIVED

    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    application_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    final_admission_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    class_fees: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)
    max_seats: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)
    eligibility_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Model A entrance test configuration
    entrance_exam_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    entrance_exam_venue: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AdmissionApplication(Base):
    """
    Central Admission Application Entity.
    Manages prospective student intake lifecycle:
    DRAFT -> SUBMITTED -> UNDER_REVIEW -> EXAM_SCHEDULED -> SELECTED/WAITLISTED -> APPROVED -> ENROLLED
    """
    __tablename__ = "admission_applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "application_number", name="uq_tenant_admission_number"),
        Index("ix_admissions_tenant_status", "tenant_id", "status"),
        Index("ix_admissions_tenant_phone", "tenant_id", "guardian_phone"),
        {"extend_existing": True},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    admission_model: Mapped[str] = mapped_column(String(20), default="MODEL_B", nullable=False) # MODEL_A or MODEL_B
    application_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    
    # Lifecycle Status
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", nullable=False, index=True)
    academic_year: Mapped[str] = mapped_column(String(20), default="2026", nullable=False)
    class_name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    shift: Mapped[Optional[str]] = mapped_column(String(50), default="Morning", nullable=True)
    group: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    desired_section: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Student Demographics
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    first_name_bn: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_name_bn: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    name_bn: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[str] = mapped_column(String(20), default="Male", nullable=False)
    blood_group: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(50), default="Bangladeshi", nullable=True)
    religion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    birth_registration_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    previous_school: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    # Parent & Guardian Details
    father_name_en: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    father_name_bn: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    mother_name_en: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    mother_name_bn: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    guardian_name: Mapped[str] = mapped_column(String(150), nullable=False)
    guardian_relationship: Mapped[str] = mapped_column(String(50), default="Father", nullable=False)
    guardian_phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    guardian_email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    guardian_nid: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Geographic Address Hierarchy
    present_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    permanent_address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    division: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    district: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    upazila: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    union_ward: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Previous Academic Record
    previous_board: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    previous_roll: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    previous_gpa: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    declaration_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Model A Entrance Examination & Selection Details
    admit_card_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entrance_exam_roll: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    entrance_exam_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    entrance_exam_details: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)
    selection_status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False) # PENDING, SELECTED, WAITLISTED, NOT_SELECTED

    # Review & Approval Audit
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Enrollment Linkage (Created upon ENROLLED state)
    enrolled_student_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        SafeUUID, ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Financial Integration: Application Fee & Final Admission Fee
    application_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False) # PENDING, UNDER_REVIEW, VERIFIED, PAID
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )

    final_admission_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    final_fee_payment_status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    final_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )

    # Uploaded Document Metadata
    documents_metadata: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)

    # Timestamps
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    enrolled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class AdmissionReceipt(Base):
    """
    Immutable School Counter & Gateway Receipt Snapshot.
    Generated upon successful verification of an application fee or final admission fee.
    Guarantees idempotency and anti-fraud tamper resistance.
    """
    __tablename__ = "admission_receipts"
    __table_args__ = (
        UniqueConstraint("tenant_id", "receipt_number", name="uq_tenant_admission_receipt_number"),
        Index("ix_receipts_tenant_application", "tenant_id", "application_id"),
        {"extend_existing": True},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    receipt_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True) # e.g. RCP-2026-0001
    application_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("admission_applications.id", ondelete="CASCADE"), nullable=False
    )
    student_id: Mapped[Optional[uuid.UUID]] = mapped_column(SafeUUID, nullable=True)
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="BDT", nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="Cash Counter", nullable=False)
    transaction_reference: Mapped[str] = mapped_column(String(100), nullable=False)
    fee_category: Mapped[str] = mapped_column(String(50), default="APPLICATION_FEE", nullable=False)
    
    # Immutable server-side receipt payload
    receipt_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    issued_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
