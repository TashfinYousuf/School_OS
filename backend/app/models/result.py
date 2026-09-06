import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class StudentResult(Base):
    __tablename__ = "student_results"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    exam_term = Column(String, index=True, nullable=False) # e.g. "Half Yearly 2026"
    class_name = Column(String, index=True, nullable=False)
    
    subject = Column(String, nullable=False)
    marks_obtained = Column(Float, nullable=False)
    highest_marks = Column(Float, default=100.0)
    grade = Column(String, nullable=False)      # A+, A, A-, B, C, F
    grade_point = Column(Float, nullable=False) # 5.0, 4.0, etc.
    
    remarks = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())