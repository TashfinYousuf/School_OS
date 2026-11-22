import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, UniqueConstraint, Index, text
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
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

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
        Index(
            'uq_users_tenant_username_active',
            'tenant_id',
            text('lower(username)'),
            unique=True,
            postgresql_where=text("username IS NOT NULL AND trim(username) <> ''"),
        ),
        Index(
            'uq_users_tenant_phone',
            'tenant_id',
            'phone_number',
            unique=True,
            postgresql_where=text("phone_number IS NOT NULL AND trim(phone_number) <> ''"),
        ),
        {'extend_existing': True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    
    # 🚀 Fix: role is strictly a String column, never overwritten by relationship; least-privilege default
    role = Column(String, nullable=False, default="student")

    is_active = Column(Boolean, default=True)
    username = Column(String(100), index=True, nullable=True)
    phone_number = Column(String(32), index=True, nullable=True)
    must_change_password = Column(Boolean, default=False, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_totp_secret = Column(String(255), nullable=True)
    mfa_recovery_codes = Column(JSONB, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    tenant = relationship("Tenant", back_populates="users", foreign_keys=[tenant_id])


class SchoolProfile(Base):
    __tablename__ = "school_profiles"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    school_name = Column(String, nullable=False)
    address = Column(String, nullable=True)
    tagline = Column(String, nullable=True)
    eiin_or_code = Column(String, nullable=True)
    contact_phone = Column(String, nullable=True)
    contact_email = Column(String, nullable=True)
    academic_year = Column(String, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())