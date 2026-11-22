import uuid
from sqlalchemy import Column, String, Date, DateTime, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base, SafeUUID

class Student(Base):
    """
    Central Student Registry for EducationOS / EducationOS.
    """
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'admission_number', name='uq_tenant_admission_number'),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(SafeUUID, index=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)

    # Academic & Registry Identification
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    first_name_bn = Column(String(100), nullable=True)
    last_name_bn = Column(String(100), nullable=True)
    name_bn = Column(String(200), nullable=True)
    admission_number = Column(String(50), index=True, nullable=False)
    class_name = Column(String(50), index=True, nullable=True)  # e.g. "Class 5", "Play"
    section = Column(String(50), nullable=True, default="A")
    roll_number = Column(String(50), nullable=True)
    group = Column(String(50), nullable=True, index=True) # Science, Humanities, Business Studies
    shift = Column(String(50), nullable=True, default="Morning") # Morning, Day
    academic_year = Column(String(20), nullable=True, default="2026", index=True)

    # Demographics & IPEMIS Requirements
    gender = Column(String(20), nullable=True, default="Male")
    date_of_birth = Column(Date, nullable=True)
    blood_group = Column(String(10), nullable=True)
    birth_certificate_no = Column(String(50), nullable=True)

    # Profile & Contact Expansion (Student 360)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(50), nullable=True)
    previous_school = Column(String(150), nullable=True)
    photo_url = Column(String(500), nullable=True)
    disciplinary_notes = Column(Text, nullable=True)
    health_notes = Column(Text, nullable=True)

    # Lifecycle Status
    status = Column(String(20), default="Active", index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)