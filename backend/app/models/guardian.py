import uuid
import enum

from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.student import Student
from app.models.tenant import User
from app.models.base import Base

class GuardianRelationship(str, enum.Enum):
    FATHER = "Father"
    MOTHER = "Mother"
    LEGAL_GUARDIAN = "Legal Guardian"

class GuardianStudentLink(Base):
    """
    Many-to-Many join table linking Guardians and Students with relationship roles.
    """
    __tablename__ = "guardian_students"
    __table_args__ = {'extend_existing': True} # Fix for redefinition error

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(SQLEnum(GuardianRelationship), default=GuardianRelationship.FATHER)
    is_primary_contact = Column(String, default="Yes") # "Yes" or "No"

class Guardian(Base):
    """
    Central Guardian Registry.
    """
    __tablename__ = "guardians"
    __table_args__ = {'extend_existing': True} # Fix for redefinition error

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)

    # 🚀 ForeignKey to users.id solves the mapper initialization error
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    user = relationship("User", foreign_keys=[user_id], backref="guardian_profile", lazy="joined")

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=True)
    phone_number = Column(String, index=True, nullable=True)
    email = Column(String, nullable=True)
    profession = Column(String, nullable=True)
    nid_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    # Relationships
    user = relationship("User")
    students = relationship("GuardianStudentLink", backref="guardian", cascade="all, delete-orphan")