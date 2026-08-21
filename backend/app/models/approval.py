import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class ApprovalTask(Base):
    """
    Action Center: Holds AI generated tasks that require Human Approval.
    """
    __tablename__ = "approval_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    title = Column(String, index=True) # e.g., "Draft: Parent Notice regarding Tuition"
    action_type = Column(String) # e.g., "notice.draft", "student.deletion"
    
    # The actual content that the admin can EDIT before approving
    payload_content = Column(String) 
    
    risk_level = Column(String, default="Medium") # Medium, High
    status = Column(String, default="Pending") # Pending, Approved, Rejected, Edited
    
    created_at = Column(DateTime(timezone=True), default=func.now())