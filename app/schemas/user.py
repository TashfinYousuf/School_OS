from pydantic import BaseModel, EmailStr, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr = Field(..., title="User's email address")
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, title="Password (Plain text)")
    tenant_id: UUID = Field(..., title="The ID of the school this user belongs to")
    # role_id can be added later when we implement dynamic roles

class UserResponse(UserBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)