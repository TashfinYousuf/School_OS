import uuid
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamResult
from app.schemas.exam import ExamCreate, ExamResponse, ExamResultCreate, ExamResultResponse
from app.core.database import get_db
from app.api.deps import get_current_tenant_id

router = APIRouter()

# --- Exams (Terms) ---
@router.post("/", response_model=ExamResponse)
def create_exam(
    exam_in: ExamCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    new_exam = Exam(**exam_in.model_dump(), tenant_id=tenant_id)
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)
    return new_exam

@router.get("/", response_model=List[ExamResponse])
def get_exams(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    return db.query(Exam).filter(Exam.tenant_id == tenant_id).all()

# --- Competency Results ---
@router.post("/results/", response_model=ExamResultResponse)
def submit_competency_result(
    result_in: ExamResultCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    # Future AI Hook: Generate `ai_evaluation` based on competency_scores
    ai_feedback = "Strong analytical skills detected. Needs focus on creative writing."
    
    new_result = ExamResult(
        **result_in.model_dump(),
        tenant_id=tenant_id,
        ai_evaluation=ai_feedback
    )
    db.add(new_result)
    db.commit()
    db.refresh(new_result)
    return new_result