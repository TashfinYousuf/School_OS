import uuid

from datetime import datetime, timezone
from sqlalchemy import Column, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

# The base class for all our SQLAlchemy models
Base = declarative_base()

class BaseModel(Base):
    """
    An abstract base model that provides common columns for all tables.
    This saves us from writing id, created_at, and deleted_at repeatedly.
    """
    __abstract__ = True # Tells SQLAlchemy not to create a table for this class

    # Using UUIDs for security and scalability (SaaS standard)
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Soft delete column. If this is not null, the record is considered deleted.
    deleted_at = Column(DateTime(timezone=True), nullable=True)

class TenantAwareModel(BaseModel):
    """
    An abstract base model specifically for tables that belong to a tenant (School).
    Ensures every child table has a tenant_id for Row-Level Security isolation.
    """
    __abstract__ = True
    
    # We will define the actual ForeignKey constraint in the child classes 
    # to avoid circular import issues in this abstract base.
    # tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)