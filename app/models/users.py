from sqlalchemy import Column, String, Boolean, ForeignKey, Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import TenantAwareModel

class Guardian(TenantAwareModel):
    """
    Guardian profile model.
    """
    __tablename__ = "guardians"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=True)
    
    # Relationship to the User model (for auth/login)
    user = relationship("User")
    # Relationship to the junction table
    students = relationship("StudentGuardian", back_populates="guardian")

class Student(TenantAwareModel):
    """
    Student profile model.
    """
    __tablename__ = "students"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    admission_number = Column(String(50), nullable=False)
    date_of_birth = Column(Date, nullable=True)
    
    # Relationships
    user = relationship("User")
    guardians = relationship("StudentGuardian", back_populates="student")
    
    # Enforcing unique admission number per school (Tenant)
    __table_args__ = (
        UniqueConstraint('tenant_id', 'admission_number', name='unique_admission_per_school'),
    )

class StudentGuardian(TenantAwareModel):
    """
    Junction Table (Many-to-Many) with extra attributes.
    Connects multiple students to multiple guardians.
    """
    __tablename__ = "student_guardians"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), primary_key=True)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardians.id"), primary_key=True)
    
    # Extra attributes for the relationship
    relationship_type = Column(String(50), nullable=False) # e.g., 'Father', 'Mother', 'Uncle'
    is_primary = Column(Boolean, default=False)
    
    student = relationship("Student", back_populates="guardians")
    guardian = relationship("Guardian", back_populates="students")

class Teacher(TenantAwareModel):
    """
    Teacher profile model.
    """
    __tablename__ = "teachers"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    designation = Column(String(100), nullable=True) # e.g., "Senior Assistant Teacher"
    
    user = relationship("User")