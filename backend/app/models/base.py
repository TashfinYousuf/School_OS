import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, TypeDecorator
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

class SafeUUIDValue(str):
    """String subclass that also compares equal to uuid.UUID objects."""
    def __eq__(self, other):
        if isinstance(other, uuid.UUID):
            return str(other) == str(self)
        return super().__eq__(other)

    def __hash__(self):
        return super().__hash__()

    @property
    def hex(self):
        """Cross-dialect compatibility with SQLite UUID type processor."""
        return str(self).replace("-", "")


class SafeUUID(TypeDecorator):
    """
    Cross-dialect UUID type ensuring string coercion to UUID on bind,
    and SafeUUIDValue on result. Compatible with PostgreSQL native UUID and SQLite test engines.
    """
    impl = UUID(as_uuid=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return uuid.UUID(value)
            except (ValueError, AttributeError):
                return value
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return SafeUUIDValue(str(value))


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