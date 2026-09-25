# backend/app/models/approval.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class ApprovalTask(Base):
    """
    Action Center: Holds AI generated tasks that require Human Approval.
    """
    __tablename__ = "approval_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String, index=True, nullable=False)
    
    title = Column(String, index=True, nullable=False)
    action_type = Column(String, nullable=False)
    
    # The actual content that the admin can EDIT before approving
    payload_content = Column(String, nullable=False)
    
    risk_level = Column(String, default="Medium", nullable=False) # Medium, High
    status = Column(String, default="Pending", nullable=False) # Pending, Approved, Rejected, Edited
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)