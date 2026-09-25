import uuid
from sqlalchemy import Column, String, Date, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Student(Base):
    """
    Central Student Registry for EducationOS / SchoolOS.
    """
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'admission_number', name='uq_tenant_admission_number'),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)

    # Academic & Registry Identification
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    admission_number = Column(String(50), index=True, nullable=False)
    class_name = Column(String(50), index=True, nullable=True)  # e.g. "Class 5", "Play"
    section = Column(String(50), nullable=True, default="A")
    roll_number = Column(String(50), nullable=True)

    # Demographics & IPEMIS Requirements
    gender = Column(String(20), nullable=True, default="Male")
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String(10), nullable=True)
    birth_certificate_no = Column(String(50), nullable=True)

    # Lifecycle Status
    status = Column(String(20), default="Active", index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)