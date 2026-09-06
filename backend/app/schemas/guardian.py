from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, Union
from uuid import UUID

class GuardianCreate(BaseModel):
    """Payload for creating a new guardian account"""
    email: EmailStr = Field(..., title="Guardian's Login Email")
    password: str = Field(..., min_length=6, title="Login Password")
    first_name: str = Field(..., max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)

class GuardianResponse(BaseModel):
    """Response schema after guardian creation"""
    id: UUID
    user_id: Optional[UUID] = None
    tenant_id: Union[UUID, str]
    first_name: str
    last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class StudentGuardianLink(BaseModel):
    """Payload to link a guardian with a student"""
    relationship_type: str = Field(..., description="e.g., Father, Mother, Uncle")
    is_primary: bool = Field(True, description="Is this the primary contact?")