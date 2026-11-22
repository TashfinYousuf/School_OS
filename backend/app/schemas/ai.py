# backend/app/schemas/ai.py
import re
from uuid import UUID
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ValidatedMCQItem(BaseModel):
    id: str
    question: str = Field(..., max_length=1000)
    options: List[str]
    correct_option: str
    explanation: str = Field(..., max_length=1500)

    @field_validator("question", "explanation")
    @classmethod
    def validate_no_markup(cls, v: str) -> str:
        if re.search(r"<\s*script[^>]*>|javascript:|onerror\s*=|onload\s*=", v, re.IGNORECASE):
            raise ValueError("Disallowed markup or script vectors detected in AI content.")
        return v

    @field_validator("options")
    @classmethod
    def validate_options(cls, v: List[str]) -> List[str]:
        if len(v) != 4:
            raise ValueError("Each MCQ must have exactly 4 options.")
        if len(set(opt.strip().lower() for opt in v)) != 4:
            raise ValueError("Options must be unique.")
        return [opt.strip() for opt in v]

    @field_validator("correct_option")
    @classmethod
    def validate_correct_option(cls, v: str, info) -> str:
        opts = [o.strip() for o in info.data.get("options", [])]
        if v.strip() not in opts:
            raise ValueError(f"Integrity failure: correct_option '{v}' must be identical to one of the 4 options.")
        return v.strip()


class CreativeQuestionStem(BaseModel):
    stem_scenario: str = Field(..., description="Stimulus / Scenario in Bengali or English")
    sub_questions: List[Dict[str, Any]] = Field(
        ...,
        description="Standard NCTB 4-part structure: a (Knowledge 1), b (Comprehension 2), c (Application 3), d (Higher Order 4)"
    )


class QuestionPaperGenerateRequest(BaseModel):
    class_name: str = Field(..., min_length=1, max_length=50)
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=200)
    total_marks: int = Field(default=50, ge=10, le=100)
    duration: str = Field(default="1.5 Hours", max_length=50)
    mcq_count: int = Field(default=5, ge=0, le=30)
    cq_count: int = Field(default=2, ge=0, le=10)


class QuestionPaperStructure(BaseModel):
    title: str
    class_name: str
    subject: str
    total_marks: int
    duration: str
    instructions: str
    mcqs: List[ValidatedMCQItem] = Field(default_factory=list)
    creative_questions: List[CreativeQuestionStem] = Field(default_factory=list)
    answer_key: Dict[str, str] = Field(default_factory=dict)
    status: str = "Draft"


class LessonActivityItem(BaseModel):
    phase: str # Warm-up, Direct Instruction, Guided Practice, Formative Assessment
    duration_minutes: int
    teacher_action: str
    student_action: str


class LessonBlueprintGenerateRequest(BaseModel):
    class_name: str = Field(..., min_length=1, max_length=50)
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=200)
    duration_minutes: int = Field(default=45, ge=15, le=180)
    target_competency: Optional[str] = None


class LessonBlueprintStructure(BaseModel):
    topic: str
    class_name: str
    subject: str
    duration_minutes: int
    learning_objectives: List[str]
    materials_needed: List[str]
    activities: List[LessonActivityItem]
    assessment_strategy: str
    homework: str
    status: str = "Draft"


class SocraticDialogueRequest(BaseModel):
    subject: str = Field(..., max_length=100)
    topic: str = Field(..., max_length=200)
    student_query: str = Field(..., min_length=3, max_length=800)
    current_step: int = Field(default=1, ge=1, le=5)


class SocraticDialogueResponse(BaseModel):
    pedagogical_concept: str
    guiding_response: str
    probing_question: str
    hint_level: int
    is_solution_revealed: bool = False


class CurriculumChunkCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=200)
    class_name: str = Field(..., min_length=1, max_length=50)
    subject: str = Field(..., min_length=1, max_length=100)
    chapter: Optional[str] = Field(None, max_length=100)
    content: str = Field(..., min_length=10)
    chunk_index: int = Field(default=0, ge=0)
    is_global_curriculum: bool = False
    metadata_payload: Optional[Dict[str, Any]] = None


class CurriculumChunkResponse(BaseModel):
    id: UUID
    tenant_id: Optional[str] = None
    title: str
    class_name: str
    subject: str
    chapter: Optional[str] = None
    content: str
    chunk_index: int
    is_global_curriculum: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AIBudgetStatusResponse(BaseModel):
    tenant_id: str
    monthly_token_limit: int
    used_tokens_current_cycle: int
    remaining_tokens: int
    usage_percentage: float
    is_hard_locked: bool
    monthly_budget_usd: int


class CurriculumCitation(BaseModel):
    chunk_id: str
    document_title: str
    class_name: str
    subject: str
    chapter: str
    chunk_index: int
    excerpt: str


class CurriculumQueryRequest(BaseModel):
    subject: str = Field(..., min_length=2, max_length=100)
    class_name: str = Field(..., min_length=1, max_length=50)
    question: str = Field(..., min_length=3, max_length=1000)
    limit: Optional[int] = Field(default=4, ge=1, le=10)


class CurriculumQueryResponse(BaseModel):
    question: str
    answer: str
    subject: str
    class_name: str
    grounding_count: int
    citations: List[CurriculumCitation]

