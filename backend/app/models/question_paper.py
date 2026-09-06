import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class QuestionPaper(Base):
    __tablename__ = "question_papers"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    title = Column(String, nullable=False) # e.g., "Half Yearly Examination - 2026"
    class_name = Column(String, index=True, nullable=False)
    subject = Column(String, index=True, nullable=False)
    total_marks = Column(Integer, default=50)
    duration = Column(String, default="1.5 Hours")
    instructions = Column(String, default="Answer all the questions. Figures in the margin indicate full marks.")
    
    # Paper Content
    content = Column(Text, nullable=False) # Formatted text with questions & marks
    status = Column(String, default="Draft") # Draft, Finalized
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())