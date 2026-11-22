from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class UserBase(BaseModel):
    email: str = Field(..., title="User's email address")
    is_active: bool = True
    role: Optional[str] = "teacher"

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, title="Password (Plain text)")
    tenant_id: Optional[UUID] = Field(None, title="The ID of the school this user belongs to")

class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    username: Optional[str] = None
    phone_number: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
