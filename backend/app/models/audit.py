import uuid
from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class AuditLog(Base):
    """
    Central Event Bus/Memory for SchoolOS.
    Stores every action for AI Context and System Auditing.
    """
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    timestamp = Column(DateTime(timezone=True), default=func.now(), index=True)
    actor_id = Column(String, index=True) # Who did it (e.g., Admin_01 or AI_Agent)
    action_type = Column(String, index=True) # e.g., "student.admitted", "attendance.marked"
    
    target_entity = Column(String) # e.g., "Student S-101"
    event_payload = Column(JSON, nullable=True) # The exact changes/data
    risk_level = Column(String, default="Low") # Low, Medium, High (For Human Approval Logic)