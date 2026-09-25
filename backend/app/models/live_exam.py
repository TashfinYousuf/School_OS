import uuid
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class LiveExam(Base):
    """
    Timed Academy MCQ Exam with Negative Marking.
    """
    __tablename__ = "live_exams"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), index=True, nullable=False)
    program_id = Column(UUID(as_uuid=True), ForeignKey("academic_programs.id", ondelete="SET NULL"), nullable=True)
    
    title = Column(String(200), nullable=False)          # "Physics Paper 1 - Dynamics & Vectors"
    total_marks = Column(Float, default=25.0)
    duration_minutes = Column(Integer, default=30)
    negative_marking_rate = Column(Float, default=0.25)  # Deduct 0.25 per wrong answer
    
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    is_published = Column(Boolean, default=True)
    
    # Stores question bank items: [{id, question, options: [A,B,C,D], correct_option: "B", explanation}]
    questions_payload = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ExamSubmission(Base):
    """
    Real-time student paper evaluation, rank, and score ledger.
    """
    __tablename__ = "exam_submissions"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    exam_id = Column(UUID(as_uuid=True), ForeignKey("live_exams.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    
    correct_count = Column(Integer, default=0)
    wrong_count = Column(Integer, default=0)
    unattempted_count = Column(Integer, default=0)
    
    obtained_score = Column(Float, default=0.0)          # correct * 1 - wrong * 0.25
    accuracy_percentage = Column(Float, default=0.0)
    assigned_rank = Column(Integer, nullable=True)       # Dynamic Batch Rank
    
    student_answers = Column(JSON, default=dict)         # {"q1": "A", "q2": "C"}
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())