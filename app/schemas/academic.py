from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID

# --- Class Schemas ---
class ClassBase(BaseModel):
    class_name: str = Field(..., title="Name of the class (e.g. Class 1, Class 10)", max_length=50)

class ClassCreate(ClassBase):
    pass

class ClassResponse(ClassBase):
    id: UUID
    tenant_id: UUID
    
    model_config = ConfigDict(from_attributes=True)

# --- Subject Schemas ---
class SubjectBase(BaseModel):
    subject_code: Optional[str] = None
    subject_name: str = Field(..., max_length=100)
    is_optional: bool = False

class SubjectCreate(SubjectBase):
    pass

class SubjectResponse(SubjectBase):
    id: UUID
    tenant_id: UUID

    model_config = ConfigDict(from_attributes=True)

# --- NEW: Academic Session Schemas ---
class AcademicSessionBase(BaseModel):
    session_year: str = Field(..., title="Year (e.g., 2026, 2026-2027)", max_length=10)
    is_current: bool = False

class AcademicSessionCreate(AcademicSessionBase):
    pass

class AcademicSessionResponse(AcademicSessionBase):
    id: UUID
    tenant_id: UUID
    
    model_config = ConfigDict(from_attributes=True)