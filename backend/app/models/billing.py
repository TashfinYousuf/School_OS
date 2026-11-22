# backend/app/models/billing.py
"""
SaaS Subscription Billing & Feature Entitlement Domain Models.
Strictly segregated from Academic Finance (app/models/finance.py - student fees/invoices).
"""
import uuid
import datetime
from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    Boolean,
    Integer,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class SubscriptionPlan(Base):
    """
    Authoritative SaaS Subscription Plan Catalog.
    """
    __tablename__ = "subscription_plans"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    category = Column(String(32), nullable=False)  # school | academy | unified
    price_bdt = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="BDT", nullable=False)
    billing_period = Column(String(16), default="month", nullable=False)
    max_students = Column(Integer, default=100, nullable=False)
    ai_quota = Column(Integer, default=50, nullable=False)
    features = Column(JSONB, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PlanVersion(Base):
    """
    Immutable Version History for SaaS Plans.
    Preserves historical plan pricing and quotas for existing subscriptions.
    """
    __tablename__ = "plan_versions"
    __table_args__ = (
        UniqueConstraint("plan_code", "version_number", name="uq_plan_version_number"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_code = Column(String(64), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    price_bdt = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="BDT", nullable=False)
    features_snapshot = Column(JSONB, default=dict, nullable=False)
    effective_from = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BillingInvoice(Base):
    """
    SaaS Tenant Subscription Invoices.
    Distinct Bounded Context from student tuition invoices (app.models.finance.Invoice).
    """
    __tablename__ = "billing_invoices"
    __table_args__ = (
        Index("ix_billing_invoices_tenant_status", "tenant_id", "status"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), nullable=True)
    invoice_number = Column(String(64), unique=True, nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="BDT", nullable=False)
    status = Column(String(20), default="ISSUED", nullable=False)  # DRAFT | ISSUED | PAID | VOID | UNCOLLECTIBLE
    billing_cycle = Column(String(20), default="monthly", nullable=False)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    line_items = relationship("BillingInvoiceLineItem", back_populates="invoice", cascade="all, delete-orphan")


class BillingInvoiceLineItem(Base):
    """
    Line items on a SaaS billing invoice (e.g. plan license fee, proration, add-on).
    """
    __tablename__ = "billing_invoice_line_items"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    billing_invoice_id = Column(UUID(as_uuid=True), ForeignKey("billing_invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(255), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    invoice = relationship("BillingInvoice", back_populates="line_items")


class BillingWebhookEvent(Base):
    """
    Replay-Protected Webhook Event Ledger for Payment Gateways.
    Guarantees strict once-only execution for provider callbacks (bKash, Nagad, SSLCommerz).
    """
    __tablename__ = "billing_webhook_events"
    __table_args__ = (
        UniqueConstraint("gateway", "event_id", name="uq_billing_webhook_gateway_event"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    gateway = Column(String(32), nullable=False)
    event_id = Column(String(128), nullable=False, index=True)
    signature_hash = Column(String(256), nullable=False)
    payload = Column(JSONB, nullable=False)
    processed = Column(Boolean, default=False, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class TenantEntitlement(Base):
    """
    Granular feature flags and resource quotas per tenant.
    Enforces SaaS entitlement gating for features such as AI Copilot, WhatsApp Hub, NCTB Grading, OMR Scanner.
    """
    __tablename__ = "tenant_entitlements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "feature_key", name="uq_tenant_feature_entitlement"),
        Index("ix_tenant_entitlements_lookup", "tenant_id", "feature_key", "is_enabled"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    feature_key = Column(String(64), nullable=False)
    is_enabled = Column(Boolean, default=True, nullable=False)
    quota_limit = Column(Integer, nullable=True)
    quota_used = Column(Integer, default=0, nullable=False)
    valid_until = Column(DateTime(timezone=True), nullable=True)
    metadata_payload = Column(JSONB, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BillingAuditLog(Base):
    """
    Append-Only Audit Ledger for SaaS Subscription and Billing Operations.
    Captures plan upgrades, state transitions, dunning grace periods, and administrative overrides.
    """
    __tablename__ = "billing_audit_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), nullable=False, index=True)
    actor_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)
    old_state = Column(JSONB, default=dict, nullable=False)
    new_state = Column(JSONB, default=dict, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

