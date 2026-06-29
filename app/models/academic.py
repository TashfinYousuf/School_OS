from sqlalchemy import Column, String, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import TenantAwareModel

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

class Subject(TenantAwareModel):
    """
    Subjects taught in the school.
    """
    __tablename__ = "subjects"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    subject_code = Column(String(20), nullable=True)
    subject_name = Column(String(100), nullable=False)
    is_optional = Column(Boolean, default=False)