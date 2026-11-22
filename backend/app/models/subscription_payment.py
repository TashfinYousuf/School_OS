# backend/app/models/subscription_payment.py
import uuid
from sqlalchemy import Column, DateTime, Index, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base


class SubscriptionPayment(Base):
    __tablename__ = "subscription_payments"
    __table_args__ = (
        Index(
            "uq_sub_payment_trx",
            "gateway",
            "transaction_id",
            unique=True,
            postgresql_where=text("transaction_id IS NOT NULL")
        ),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    payment_reference = Column(String(64), nullable=False, unique=True, index=True)
    plan_key = Column(String(64), nullable=False)
    billing_cycle = Column(String(16), nullable=False)  # monthly | annual
    gateway = Column(String(32), nullable=False)        # BKASH | NAGAD | SSLCOMMERZ
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(16), nullable=False, default="PENDING")  # PENDING | SUBMITTED | PAID | REJECTED | REVERSED
    transaction_id = Column(String(128), nullable=True)
    created_by = Column(String(64), nullable=True)
    submitted_by = Column(String(64), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(64), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)