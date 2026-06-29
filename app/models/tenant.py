from sqlalchemy import Column, String, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from app.models.base import BaseModel, TenantAwareModel

class Tenant(BaseModel):
    """
    Represents a School in our SaaS platform.
    """
    __tablename__ = "tenants"

    school_name = Column(String(255), nullable=False)
    domain = Column(String(100), unique=True, index=True) # e.g., kidsshine.schoolos.com
    address = Column(String(500), nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    roles = relationship("Role", back_populates="tenant")

class Role(TenantAwareModel):
    """
    Custom roles for each tenant with granular JSON-based permissions.
    """
    __tablename__ = "roles"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(50), nullable=False) # Super Admin, Teacher, etc.
    
    # Storing permissions as JSON for maximum flexibility
    # Example: ["view_finance", "edit_marks", "take_attendance"]
    permissions = Column(JSONB, nullable=False, default=list)

    # Relationships
    tenant = relationship("Tenant", back_populates="roles")
    users = relationship("User", back_populates="role")

class User(TenantAwareModel):
    """
    Global user model. A user ALWAYS belongs to a specific tenant (School).
    """
    __tablename__ = "users"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    role = relationship("Role", back_populates="users")

    # SaaS Crucial Fix: A user email must be unique WITHIN a tenant, not globally.
    __table_args__ = (
        UniqueConstraint('tenant_id', 'email', name='unique_tenant_email'),
    )