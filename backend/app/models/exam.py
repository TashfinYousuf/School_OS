import uuid
from sqlalchemy import Column, String, Float, ForeignKey, JSON, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class Exam(Base):
    """Term Exams or Assessments (e.g., Mid-Term 2026)"""
    __tablename__ = "exams"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    name = Column(String(150), index=True, nullable=False) # e.g., "Term 1 Assessment"
    term = Column(String(50), nullable=True) 
    
    # Stage 09 Exam Lifecycle
    status = Column(String(32), default="SCHEDULED", nullable=False, index=True) # DRAFT, SCHEDULED, IN_PROGRESS, MARKS_SUBMITTED, UNDER_REVIEW, APPROVED, PUBLISHED
    academic_year = Column(String(20), default="2026", nullable=False)
    class_name = Column(String(50), index=True, nullable=True)
    subject = Column(String(100), default="General", nullable=False)
    max_marks = Column(Float, default=100.0, nullable=False)
    pass_marks = Column(Float, default=33.0, nullable=False)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

class ExamResult(Base):
    """Vision 2030: Competency Based Evaluation System"""
    __tablename__ = "exam_results"
    __table_args__ = {'extend_existing': True}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    
    # Relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id = Column(UUID(as_uuid=True), nullable=True)
    
    # 1. Traditional Metrics (Baseline)
    marks_obtained = Column(Float, nullable=False)
    grade = Column(String(10), nullable=True) # A+, A, B etc.
    
    # 2. Advanced Competency Metrics (The Future)
    competency_scores = Column(JSON, nullable=True) 
    
    # AI generated summary based on the competency scores
    ai_evaluation = Column(String(500), nullable=True)
