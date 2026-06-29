from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

# Shared properties
class TenantBase(BaseModel):
    school_name: str = Field(..., title="Name of the School", max_length=255)
    domain: Optional[str] = Field(None, title="Subdomain for the school", max_length=100)
    address: Optional[str] = None

# Properties to receive via API on creation (POST request)
class TenantCreate(TenantBase):
    pass

# Properties to return via API (Response)
class TenantResponse(TenantBase):
    id: UUID
    created_at: datetime
    
    # Allows Pydantic to read data directly from SQLAlchemy ORM models
    model_config = ConfigDict(from_attributes=True)