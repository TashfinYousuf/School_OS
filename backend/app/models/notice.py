import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Date, Text, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import synonym
from app.models.base import Base

class Notice(Base):
    __tablename__ = "notices"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    
    memo_no = Column(String(64), nullable=True) # স্মারক নং (e.g. KS/NOTICE/2026/04)
    raw_prompt = Column(String(500), nullable=True)
    title = Column(String(255), nullable=False)
    
    # 3 Distinct Multi-Channel Outputs
    official_notice = Column(Text, nullable=True)  # For print & notice board
    guardian_sms = Column(Text, nullable=True)     # For WhatsApp / SMS
    social_copy = Column(Text, nullable=True)      # For Facebook / Website
    
    # Core content for standard CRUD
    content = Column(Text, nullable=True)
    
    # Audience Targeting
    target_audience = Column(String(50), default="ALL", nullable=False) # ALL, PARENTS, TEACHERS, STUDENTS
    target_class = Column(String(50), nullable=True) # None = all classes
    
    # Publication Lifecycle
    status = Column(String(32), default="Published", nullable=False)    # Draft, Published, Archived
    is_published = Column(Boolean, default=True, nullable=False)
    expiry_date = Column(Date, nullable=True)
    
    created_by = Column(String(64), nullable=True)
    created_by_user_id = Column(UUID(as_uuid=True), nullable=True)
    published_at = Column(DateTime(timezone=True), default=func.now())
    created_at = Column(DateTime(timezone=True), default=func.now())


class NoticeAcknowledgement(Base):
    """
    Tracks notice read and acknowledgement receipts per user.
    """
    __tablename__ = "notice_acknowledgements"
    __table_args__ = (
        UniqueConstraint("tenant_id", "notice_id", "user_id", name="uq_notice_ack_user"),
        {"extend_existing": True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    notice_id = Column(UUID(as_uuid=True), ForeignKey("notices.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    acknowledged_at = Column(DateTime(timezone=True), default=func.now())
