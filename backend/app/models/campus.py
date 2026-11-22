import uuid
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class CampusBranch(Base):
    __tablename__ = "campus_branches"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    branch_name = Column(String(150), nullable=False)    # "Main Campus"
    address = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    branch_code = Column(String(20), nullable=False)     # "MAIN-CAMPUS"
    is_main_branch = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())