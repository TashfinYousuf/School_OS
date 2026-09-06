import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base

class Tenant(Base):
    """
    Represents a School in our SaaS platform.
    """
    __tablename__ = "tenants"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    school_name = Column(String(255), nullable=False)
    domain = Column(String(100), unique=True, index=True)
    address = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    # 🚀 Fix: explicit foreign_keys prevents ambiguity and mapper failure
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan", foreign_keys="[User.tenant_id]")
    roles = relationship("Role", back_populates="tenant", foreign_keys="[Role.tenant_id]")


class Role(Base):
    """
    Custom roles for each tenant.
    """
    __tablename__ = "roles"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    permissions = Column(JSONB, nullable=False, default=list)

    tenant = relationship("Tenant", back_populates="roles", foreign_keys=[tenant_id])
    # Note: User uses string-based RBAC (role = Column(String)), so no direct ORM relationship here.


class User(Base):
    """
    Global user model. A user belongs to a specific tenant (School).
    """
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='unique_tenant_email'),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # 🚀 Fix: role is strictly a String column, never overwritten by relationship
    role = Column(String, nullable=False, default="admin")

    is_active = Column(Boolean, default=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    tenant = relationship("Tenant", back_populates="users", foreign_keys=[tenant_id])


class SchoolProfile(Base):
    __tablename__ = "school_profiles"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    school_name = Column(String, nullable=False, default="Kids Shine International School")
    tagline = Column(String, nullable=True, default="Towards a Bright Future")
    eiin_or_code = Column(String, nullable=True, default="KS-091")
    address = Column(String, nullable=True, default="Kandirpar, Cumilla, Bangladesh")
    contact_phone = Column(String, nullable=True, default="+88017XXXXXXXX")
    contact_email = Column(String, nullable=True, default="office@kidsshine.edu.bd")
    academic_year = Column(String, nullable=False, default="2027")
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())