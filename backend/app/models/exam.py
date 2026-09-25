import uuid
from sqlalchemy import Column, String, Float, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base

class Exam(Base):
    """Term Exams or Assessments (e.g., Mid-Term 2026)"""
    __tablename__ = "exams"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    name = Column(String, index=True) # e.g., "Term 1 Assessment"
    term = Column(String) 

class ExamResult(Base):
    """Vision 2030: Competency Based Evaluation System"""
    __tablename__ = "exam_results"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    # Relationships
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False, index=True)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False)
    subject_id = Column(UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False)
    
    # 1. Traditional Metrics (Baseline)
    marks_obtained = Column(Float, nullable=False)
    grade = Column(String, nullable=True) # A+, A, B etc.
    
    # 2. Advanced Competency Metrics (The Future)
    # Storing data like: {"Critical Thinking": 85, "Problem Solving": 90, "Creativity": 75}
    competency_scores = Column(JSON, nullable=True) 
    
    # AI generated summary based on the competency scores
    ai_evaluation = Column(String, nullable=True)