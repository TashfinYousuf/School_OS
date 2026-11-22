# backend/app/models/learning.py
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base


class StudySession(Base):
    """
    Personal student study room session tracker.
    Records duration, session goals, active mode, and notes.
    """
    __tablename__ = "study_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(150), nullable=True)
    mode = Column(String(32), default="study_room", nullable=False)  # study_room, tutor, practice, doubt_solver, debate
    duration_seconds = Column(Integer, default=0, nullable=False)
    goals = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class StudyFlashcard(Base):
    """
    Spaced-repetition revision flashcard for student mastery.
    """
    __tablename__ = "study_flashcards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(150), nullable=True)
    front_text = Column(Text, nullable=False)
    back_text = Column(Text, nullable=False)
    mastery_level = Column(Integer, default=0, nullable=False)  # 0 to 5
    review_due_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class PracticeAttempt(Base):
    """
    Tracks MCQ and written practice questions attempted in the Practice Center.
    """
    __tablename__ = "practice_attempts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(150), nullable=True)
    question_type = Column(String(32), default="mcq", nullable=False)  # mcq, written, socratic
    question_data = Column(JSONB, default=dict, nullable=False)
    student_answer = Column(Text, nullable=True)
    is_correct = Column(Boolean, default=False, nullable=False)
    score = Column(Numeric(5, 2), default=0.0, nullable=False)
    feedback = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class AIConversation(Base):
    """
    Persistent conversation session between a student and the AI Learning Studio tutor.
    Maintains subject/topic context, chat history, and tokens consumed.
    """
    __tablename__ = "ai_conversations"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    subject = Column(String(100), nullable=False)
    topic = Column(String(150), nullable=True)
    title = Column(String(255), nullable=False)
    mode = Column(String(32), default="socratic_tutor", nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class AIMessage(Base):
    """
    Individual message in an AI learning conversation thread.
    Stores multimodal attachments (image, PDF, text), role, and token budget metrics.
    """
    __tablename__ = "ai_messages"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String(64), nullable=False, index=True)
    sender_role = Column(String(20), nullable=False)  # student, assistant, system
    content = Column(Text, nullable=False)
    tokens_used = Column(Integer, default=0, nullable=False)
    attachment_url = Column(String(500), nullable=True)
    attachment_type = Column(String(50), nullable=True)  # image, pdf, text
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

