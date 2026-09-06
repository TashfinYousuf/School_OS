from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
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
    session_year: str = Field(..., title="Year (e.g., 2027, 2027-2028)", max_length=10)
    is_current: bool = False

class AcademicSessionCreate(AcademicSessionBase):
    pass

class AcademicSessionResponse(AcademicSessionBase):
    id: UUID
    tenant_id: UUID
    
    model_config = ConfigDict(from_attributes=True)

# --- Subjects ---
class SubjectBase(BaseModel):
    name: str
    is_nctb_standard: bool = True
    core_competency: str

class SubjectCreate(SubjectBase):
    pass

class SubjectResponse(SubjectBase):
    id: UUID
    grade_id: UUID

    class Config:
        from_attributes = True

# --- Grade Levels (Classes) ---
class GradeLevelBase(BaseModel):
    name: str
    description: Optional[str] = None

class GradeLevelCreate(GradeLevelBase):
    pass

class GradeLevelResponse(GradeLevelBase):
    id: UUID
    tenant_id: UUID
    subjects: List[SubjectResponse] = []

    class Config:
        from_attributes = True