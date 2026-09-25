import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class AcademicProgram(Base):
    """
    Core Coaching Program Entity (e.g., Engineering Admission, HSC 26 Care).
    """
    __tablename__ = "academic_programs"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    name = Column(String(150), nullable=False)           # "HSC '26 Academic Care"
    target_exam = Column(String(100), nullable=False)     # "HSC Board Exam / BUET Admission"
    course_fee = Column(Float, nullable=False, default=0.0)
    duration_months = Column(Integer, default=6)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AcademyBatch(Base):
    """
    Batches running under a Program with shift timing and seat capacity.
    """
    __tablename__ = "academy_batches"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    program_id = Column(UUID(as_uuid=True), ForeignKey("academic_programs.id", ondelete="CASCADE"), nullable=False)
    
    batch_name = Column(String(100), nullable=False)      # "Morning Shift - Batch Alpha"
    shift_time = Column(String(50), nullable=False)       # "08:00 AM - 11:30 AM"
    days_schedule = Column(String(100), nullable=False)    # "Sat, Mon, Wed"
    max_seat_capacity = Column(Integer, default=60)
    enrolled_count = Column(Integer, default=0)
    classroom_number = Column(String(50), default="Lecture Hall 1")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class BatchEnrollment(Base):
    """
    Mapping between Student and Academy Batch.
    """
    __tablename__ = "batch_enrollments"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("academy_batches.id", ondelete="CASCADE"), nullable=False)
    
    enrollment_roll = Column(String(50), nullable=True)   # Academy Specific Roll
    payment_status = Column(String(30), default="PAID")   # "PAID", "DUE", "PARTIAL"
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())