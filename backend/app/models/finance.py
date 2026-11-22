import enum
from decimal import Decimal
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Numeric, Boolean, Text, DateTime, Index, ForeignKey, UniqueConstraint, TypeDecorator
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, synonym, relationship
from app.models.base import Base, SafeUUID, SafeUUIDValue

class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    BKASH = "BKASH"
    NAGAD = "NAGAD"
    BANK = "BANK"
    SSLCOMMERZ = "SSLCOMMERZ"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVERSED = "REVERSED"
    REFUNDED = "REFUNDED"
    ADJUSTED = "ADJUSTED"

class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    OVERDUE = "OVERDUE"
    REFUNDED = "REFUNDED"


class Invoice(Base):
    """
    Authoritative student billing invoice enforcing numeric precision and state transitions.
    """
    __tablename__ = "invoices"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(150), default="Monthly Tuition Invoice", nullable=False)
    billing_month: Mapped[str] = mapped_column(String(50), nullable=False)

    # Fixed Numeric Precision (Decimal, never float)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BDT", nullable=False)

    status: Mapped[str] = mapped_column(String(32), default=InvoiceStatus.ISSUED.value, nullable=False, index=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    items: Mapped[List["InvoiceLineItem"]] = relationship("InvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[List["FeePayment"]] = relationship("FeePayment", back_populates="invoice")

    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoices_tenant_number"),
        Index("ix_invoices_tenant_student_status", "tenant_id", "student_id", "status"),
        {'extend_existing': True}
    )


class InvoiceLineItem(Base):
    """
    Granular invoice fee itemisation (e.g. Tuition Fee, Exam Fee, Lab Fee).
    """
    __tablename__ = "invoice_line_items"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, index=True)
    invoice_id: Mapped[UUID] = mapped_column(ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(default=1, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")

    __table_args__ = {'extend_existing': True}


class FeePayment(Base):
    __tablename__ = "fee_payments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    student_id: Mapped[UUID] = mapped_column(SafeUUID, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    invoice_id: Mapped[Optional[UUID]] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True, index=True, deferred=True)
    
    # Financial Precision
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BDT", nullable=False)
    amount_paid = synonym("amount")
    
    # Fiat Rail & Status
    payment_method: Mapped[str] = mapped_column(String(32), default=PaymentMethod.CASH.value, nullable=False, index=True)
    payment_status: Mapped[str] = mapped_column(String(32), default=PaymentStatus.PENDING.value, nullable=False, index=True)
    
    # Gateway & Reconciliation Records
    provider_transaction_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    bank_reference: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    collected_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    receipt_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    
    # Additional Context
    metadata_payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Idempotency & Audit
    idempotency_key: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reconciled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    # Append-Only Ledger Reversal Invariants (Sprint 3)
    is_reversed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reversal_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reversal_reference_id: Mapped[Optional[UUID]] = mapped_column(nullable=True)
    reversed_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reversed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    invoice: Mapped[Optional["Invoice"]] = relationship("Invoice", back_populates="payments")

    __table_args__ = (
        Index("ix_fee_payments_tenant_method_status", "tenant_id", "payment_method", "payment_status"),
        Index("ix_fee_payments_tenant_created_at", "tenant_id", "created_at"),
        {'extend_existing': True}
    )