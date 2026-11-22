import uuid
import enum

from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, JSON, Enum as SAEnum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False) # e.g. "Example Education Trust"
    institution_type = Column(String(50), default="school") # "school", "academy", "college"
    
    # Enabled features for this workspace
    enabled_modules = Column(JSON, default=lambda: [
        "attendance", "students", "finance", "exams", "notices", "routine", "ai_copilot"
    ])
    
    address = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WorkspaceType(str, enum.Enum):
    SCHOOL = "school"
    ACADEMY = "academy"

class Workspace(Base):
    __tablename__ = "workspaces"
    __table_args__ = (
        UniqueConstraint("tenant_id", "code", name="uq_workspaces_tenant_id_code"),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id = Column(String(64), index=True, nullable=False) # Organization level ID (e.g. Example Trust)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True)
    workspace_type = Column(SAEnum(WorkspaceType, native_enum=True), nullable=False)
    name = Column(String(150), nullable=False) # "Example International School" or "Example Academic Care"
    code = Column(String(50), nullable=True)
    
    # Feature Entitlements
    enabled_modules = Column(JSON().with_variant(JSONB, "postgresql"), default=lambda: [
        "attendance", "students", "finance", "exams", "notices"
    ])
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class WorkspaceMembership(Base):
    """
    Allows the same physical User (Teacher or Student) to belong to BOTH School and Academy
    with completely separated roles, permissions, and scoped identities.
    """
    __tablename__ = "workspace_memberships"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(64), index=True, nullable=False)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False) # e.g. "teacher" in School, "faculty" in Academy
    is_active = Column(Boolean, default=True)

# Backward-compatibility alias
InstitutionalMembership = WorkspaceMembership