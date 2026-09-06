import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Notice(Base):
    __tablename__ = "notices"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    memo_no = Column(String, nullable=True) # স্মারক নং (e.g. KS/NOTICE/2026/04)
    raw_prompt = Column(String, nullable=False)
    title = Column(String, nullable=False)
    
    # 3 Distinct Multi-Channel Outputs
    official_notice = Column(Text, nullable=False)  # For print & notice board
    guardian_sms = Column(Text, nullable=False)     # For WhatsApp / SMS
    social_copy = Column(Text, nullable=False)      # For Facebook / Website
    
    status = Column(String, default="Published")    # Draft, Published, Archived
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())