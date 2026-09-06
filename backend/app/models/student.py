import uuid
from sqlalchemy import Column, String, DateTime, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Student(Base):
    """
    Central Student Registry for SchoolOS.
    """
    __tablename__ = "students"
    __table_args__ = {'extend_existing': True}
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    # user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    admission_number = Column(String, index=True, nullable=False)
    class_name = Column(String, index=True, nullable=True) # e.g. "Class 5"
    section = Column(String, nullable=True)                # e.g. "A"
    roll_number = Column(String, nullable=True)
    birth_certificate_no = Column(String, nullable=True)  # IPEMIS requirement
    gender = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String, nullable=True)
    status = Column(String, default="Active")              # Active, Transferred, Graduated
    created_at = Column(DateTime(timezone=True), default=func.now())