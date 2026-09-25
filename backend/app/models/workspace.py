import uuid
from sqlalchemy import Column, String, Boolean, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False) # e.g. "Kids Shine Education Trust"
    institution_type = Column(String(50), default="school") # "school", "academy", "college"
    
    # Enabled features for this workspace
    enabled_modules = Column(JSON, default=lambda: [
        "attendance", "students", "finance", "exams", "notices", "routine", "ai_copilot"
    ])
    
    address = Column(String(255), default="Nazrul Avenue, Kandirpar, Cumilla-3500")
    contact_phone = Column(String(50), default="+8801971122084")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())