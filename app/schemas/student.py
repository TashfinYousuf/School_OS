from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import date

class StudentAdmission(BaseModel):
    """Payload for admitting a new student (Creates User + Student Profile)"""
    # User Account Info
    email: EmailStr = Field(..., title="Student's Login Email")
    password: str = Field(..., min_length=6, title="Login Password")
    
    # Profile Info
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    admission_number: str = Field(..., max_length=50)
    date_of_birth: Optional[date] = None

class StudentResponse(BaseModel):
    """Response schema after successful admission"""
    id: UUID
    user_id: UUID
    tenant_id: UUID
    first_name: str
    last_name: str
    admission_number: str

    model_config = ConfigDict(from_attributes=True)