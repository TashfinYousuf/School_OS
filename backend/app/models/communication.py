import uuid
from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Message(Base):
    """
    Unified Inbox: Stores messages from WhatsApp, Web, and Messenger.
    """
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    channel = Column(String, index=True) # e.g., "WhatsApp", "Website", "Messenger"
    sender_info = Column(String) # e.g., "+8801700000000" or "Guardian S-101"
    
    content = Column(Text, nullable=False) # The actual message from the user
    
    # AI Processing fields
    intent = Column(String, nullable=True) # e.g., "Admission Query", "Complaint"
    ai_draft = Column(Text, nullable=True) # AI's suggested reply
    risk_level = Column(String, default="Low") # Low (Auto-reply), High (Human review)
    
    status = Column(String, default="Pending") # Pending, Auto-Replied, Escalated, Resolved
    created_at = Column(DateTime(timezone=True), default=func.now())