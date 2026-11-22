import uuid
import datetime
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class PushSubscriptionRecord(Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    role = Column(String(30), default="teacher")
    subscription_data = Column(JSONB, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class NotificationOutbox(Base):
    """
    Transactional Outbox for Guaranteed Email and SMS Delivery.
    Ensures that domain state mutations and dispatch intent commit in the same transaction,
    preventing dual-write discrepancies and phantom notifications.
    """
    __tablename__ = "notification_outbox"
    __table_args__ = (
        Index("ix_notification_outbox_tenant_status", "tenant_id", "status"),
        Index("ix_notification_outbox_pending_dispatch", "status", "next_retry_at"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    channel = Column(String(32), nullable=False)  # EMAIL, SMS, PUSH
    recipient = Column(String(255), nullable=False)  # email or phone
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(String(32), default="PENDING", nullable=False, index=True)  # PENDING, SENT, FAILED, DEAD_LETTER
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    provider = Column(String(32), nullable=True)
    provider_message_id = Column(String(255), nullable=True)
    metadata_payload = Column(JSONB, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.datetime.now(datetime.timezone.utc), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=True)
