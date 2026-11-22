import uuid
import enum

from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Enum as SQLEnum, UniqueConstraint, Index, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.student import Student
from app.models.tenant import User
from app.models.base import Base, SafeUUID

class GuardianRelationship(str, enum.Enum):
    FATHER = "Father"
    MOTHER = "Mother"
    LEGAL_GUARDIAN = "Legal Guardian"

class GuardianStudentLink(Base):
    """
    Many-to-Many join table linking Guardians and Students with relationship roles.
    Maps to authoritative PostgreSQL table 'student_guardians'.
    """
    __tablename__ = "student_guardians"
    __table_args__ = (
        UniqueConstraint("tenant_id", "guardian_id", "student_id", name="uq_student_guardian_pair"),
        {'extend_existing': True},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(SafeUUID, index=True, nullable=False)
    guardian_id = Column(UUID(as_uuid=True), ForeignKey("guardians.id", ondelete="CASCADE"), nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(SQLEnum(GuardianRelationship), default=GuardianRelationship.FATHER, nullable=False)
    is_primary = Column(Boolean, default=True)
    is_primary_contact = Column(Boolean, nullable=False, default=True)
    verification_status = Column(String(32), default="VERIFIED", nullable=False)
    verification_method = Column(String(64), default="ADMISSION_RECORD", nullable=True)
    verified_at = Column(DateTime(timezone=True), default=func.now(), nullable=True)
    verified_by = Column(String(64), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

# Backward compatibility alias
StudentGuardian = GuardianStudentLink

class Guardian(Base):
    """
    Central Guardian Registry.
    """
    __tablename__ = "guardians"
    __table_args__ = (
        Index(
            "uq_guardians_tenant_phone",
            "tenant_id",
            "phone_number",
            unique=True,
            postgresql_where=text("phone_number IS NOT NULL AND trim(phone_number) <> '' AND phone_number <> 'N/A'"),
        ),
        {'extend_existing': True},
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(SafeUUID, index=True, nullable=False)

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
    students = relationship("GuardianStudentLink", backref="guardian", cascade="all, delete-orphan")