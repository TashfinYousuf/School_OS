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

    model_config = ConfigDict(from_attributes=True)

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

    model_config = ConfigDict(from_attributes=True)


# --- Class 1–12 Canonical Structure & Catalogue ---
class AcademicClassItem(BaseModel):
    class_name: str
    name_bn: str
    grade_numeric: int
    tier: str # pre_primary, primary, junior_secondary, secondary, higher_secondary
    supported_groups: List[str] = [] # e.g. ["Science", "Humanities", "Business Studies"]
    supported_shifts: List[str] = ["Morning", "Day"]
    default_sections: List[str] = ["A", "B"]


class PromotionStudentItem(BaseModel):
    student_id: UUID
    to_section: Optional[str] = "A"
    to_roll: Optional[str] = None
    to_group: Optional[str] = None
    status: Optional[str] = "PROMOTED" # PROMOTED, RETAINED, TRANSFERRED


class BulkPromotionRequest(BaseModel):
    from_academic_year: str = Field(..., max_length=20)
    to_academic_year: str = Field(..., max_length=20)
    from_class: str = Field(..., max_length=50)
    to_class: str = Field(..., max_length=50)
    students: List[PromotionStudentItem] = Field(..., max_length=500)
    dry_run: bool = True


class BulkPromotionResponse(BaseModel):
    from_academic_year: str
    to_academic_year: str
    from_class: str
    to_class: str
    dry_run: bool
    promoted_count: int
    retained_count: int
    transferred_count: int
    details: List[dict]
