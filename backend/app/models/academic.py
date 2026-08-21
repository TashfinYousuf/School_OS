import uuid

from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import TenantAwareModel
from app.models.base import Base

class AcademicSession(TenantAwareModel):
    """
    Academic Sessions (e.g., 2026, 2027)
    """
    __tablename__ = "academic_sessions"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    session_year = Column(String(10), nullable=False)
    is_current = Column(Boolean, default=False)

class ClassModel(TenantAwareModel):
    """
    Classes in the school. 
    Named ClassModel because 'class' is a reserved keyword in Python.
    """
    __tablename__ = "classes"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    class_name = Column(String(50), nullable=False) # e.g., "Class 1", "Class 10"

class GradeLevel(Base):
    """Classes like Class 6, Class 7, etc."""
    __tablename__ = "grade_levels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    name = Column(String, index=True)  # e.g., "Class 6"
    description = Column(String, nullable=True)

    subjects = relationship("Subject", back_populates="grade")


class Subject(Base):
    """Subjects mapped to competencies for Vision 2030"""
    __tablename__ = "subjects"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), index=True, nullable=False)
    grade_id = Column(UUID(as_uuid=True), ForeignKey("grade_levels.id"), nullable=True) 
    
    name = Column(String, index=True)  # e.g., "General Science"
    is_nctb_standard = Column(Boolean, default=True)  # NCTB Baseline tracker
    core_competency = Column(String, nullable=True)  # e.g., "Scientific Logic, Critical Thinking"
    
    grade = relationship("GradeLevel", back_populates="subjects")