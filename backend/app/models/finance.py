from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

class PaymentMethod(str, Enum):
    CASH = "CASH"
    BANK_TRANSFER = "BANK_TRANSFER"
    BKASH = "BKASH"
    NAGAD = "NAGAD"

class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVERSED = "REVERSED"

class FeePayment(Base):
    __tablename__ = "fee_payments"
    __table_args__ = {'extend_existing': True}

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    student_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True) # string/UUID safe
    
    # Financial Precision
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="BDT", nullable=False)
    
    # Clean Fiat Rail Abstraction
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, name="payment_method_enum", native_enum=True),
        nullable=False,
        index=True
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status_enum", native_enum=True),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True
    )
    
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index("ix_fee_payments_tenant_method_status", "tenant_id", "payment_method", "payment_status"),
        Index("ix_fee_payments_tenant_created_at", "tenant_id", "created_at"),
        {'extend_existing': True}
    )