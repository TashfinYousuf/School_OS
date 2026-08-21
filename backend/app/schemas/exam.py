from pydantic import BaseModel
from typing import Optional, Dict
from uuid import UUID

# --- Exam Schemas ---
class ExamBase(BaseModel):
    name: str
    term: str

class ExamCreate(ExamBase):
    pass

class ExamResponse(ExamBase):
    id: UUID
    tenant_id: str

    class Config:
        from_attributes = True

# --- Result & Competency Schemas ---
class ExamResultBase(BaseModel):
    student_id: str
    exam_id: UUID
    subject_id: UUID
    marks_obtained: float
    grade: Optional[str] = None
    competency_scores: Optional[Dict[str, float]] = None # {"Logic": 90.0}

class ExamResultCreate(ExamResultBase):
    pass

class ExamResultResponse(ExamResultBase):
    id: UUID
    tenant_id: str
    ai_evaluation: Optional[str] = None

    class Config:
        from_attributes = True