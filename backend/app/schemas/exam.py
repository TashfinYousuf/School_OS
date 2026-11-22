from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, Dict, Union
from uuid import UUID
from datetime import date

# --- Exam Schemas ---
class ExamBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    term: str = Field(..., min_length=2, max_length=50)
    status: str = Field(default="SCHEDULED", max_length=32)
    academic_year: str = Field(default="2026", max_length=20)
    class_name: Optional[str] = Field(None, max_length=50)
    subject: str = Field(default="General", max_length=100)
    max_marks: float = Field(default=100.0, ge=1.0)
    pass_marks: float = Field(default=33.0, ge=0.0)
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ExamCreate(ExamBase):
    pass

class ExamStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(DRAFT|SCHEDULED|IN_PROGRESS|MARKS_SUBMITTED|UNDER_REVIEW|APPROVED|PUBLISHED)$")

class ExamResponse(ExamBase):
    id: UUID
    tenant_id: str

    model_config = ConfigDict(from_attributes=True)

# --- Result & Competency Schemas ---
class ExamResultBase(BaseModel):
    student_id: Union[UUID, str]
    exam_id: UUID
    subject_id: Optional[UUID] = None
    marks_obtained: float
    grade: Optional[str] = None
    competency_scores: Optional[Dict[str, float]] = None # {"Logic": 90.0}

class ExamResultCreate(ExamResultBase):
    pass

class ExamResultResponse(ExamResultBase):
    id: UUID
    tenant_id: str
    ai_evaluation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
