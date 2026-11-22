import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class StudentResult(Base):
    __tablename__ = "student_results"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    exam_term = Column(String(100), index=True, nullable=False) # e.g. "Half Yearly 2026"
    class_name = Column(String(50), index=True, nullable=False)
    
    subject = Column(String(100), nullable=False)
    marks_obtained = Column(Float, nullable=False)
    highest_marks = Column(Float, default=100.0, nullable=False)
    grade = Column(String(10), nullable=False)      # A+, A, A-, B, C, D, F
    grade_point = Column(Float, nullable=False)     # 5.0, 4.0, 3.5, 3.0, 2.0, 1.0, 0.0
    
    # Publication & Reproducible Snapshot
    is_published = Column(Boolean, default=False, nullable=False, index=True)
    grading_policy_version = Column(String(50), default="nctb_v2026", nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=True)
    
    remarks = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
