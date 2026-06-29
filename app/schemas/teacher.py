from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from uuid import UUID

class TeacherCreate(BaseModel):
    """Payload for adding a new teacher account"""
    email: EmailStr = Field(..., title="Teacher's Login Email")
    password: str = Field(..., min_length=6, title="Login Password")
    
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    designation: Optional[str] = Field(None, description="e.g., Senior Math Teacher")

class TeacherResponse(BaseModel):
    """Response schema after teacher creation"""
    id: UUID
    user_id: UUID
    tenant_id: UUID
    first_name: str
    last_name: str
    designation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)