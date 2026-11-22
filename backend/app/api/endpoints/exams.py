import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamResult
from app.models.student import Student
from app.schemas.exam import (
    ExamCreate,
    ExamResponse,
    ExamResultCreate,
    ExamResultResponse,
    ExamStatusUpdate,
)
from app.api.deps import get_db, get_current_tenant_id, require_roles

router = APIRouter()

# --- Exams (Terms) ---
@router.post("/", response_model=ExamResponse, status_code=status.HTTP_201_CREATED)
def create_exam(
    exam_in: ExamCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"])),
):
    new_exam = Exam(**exam_in.model_dump(), tenant_id=str(tenant_id))
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)
    return new_exam

@router.get("/", response_model=List[ExamResponse])
def get_exams(
    class_name: Optional[str] = None,
    term: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"])),
):
    query = db.query(Exam).filter(Exam.tenant_id == str(tenant_id))
    if class_name:
        query = query.filter(Exam.class_name == class_name)
    if term:
        query = query.filter(Exam.term == term)
    return query.order_by(Exam.created_at.desc()).all()

@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam_detail(
    exam_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"])),
):
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.tenant_id == str(tenant_id)).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    return exam

@router.post("/{exam_id}/status", response_model=ExamResponse)
def update_exam_status(
    exam_id: uuid.UUID,
    payload: ExamStatusUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """
    State transitions for exams:
    DRAFT -> SCHEDULED -> IN_PROGRESS -> MARKS_SUBMITTED -> UNDER_REVIEW -> APPROVED -> PUBLISHED
    """
    exam = db.query(Exam).filter(Exam.id == exam_id, Exam.tenant_id == str(tenant_id)).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")

    exam.status = payload.status
    db.commit()
    db.refresh(exam)
    return exam

# --- Competency Results ---
@router.post("/results/", response_model=ExamResultResponse, status_code=status.HTTP_201_CREATED)
def submit_competency_result(
    result_in: ExamResultCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"])),
):
    tid = str(tenant_id)
    try:
        exam_uuid = uuid.UUID(str(result_in.exam_id))
    except (ValueError, AttributeError):
        exam_uuid = result_in.exam_id

    exam = db.query(Exam).filter(Exam.id == exam_uuid, Exam.tenant_id == tid).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Associated exam not found in this institutional workspace.")

    # Post-publication lock invariant
    if exam.status == "PUBLISHED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Modifications locked: Exam is PUBLISHED. Corrections require formal administrative approval."
        )

    # Validate student belongs to tenant
    try:
        student_uuid = uuid.UUID(str(result_in.student_id))
    except (ValueError, AttributeError):
        student_uuid = result_in.student_id

    student = db.query(Student).filter(Student.id == student_uuid, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this institutional workspace.")

    # Boundary check for marks
    if result_in.marks_obtained < 0 or result_in.marks_obtained > exam.max_marks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid marks: {result_in.marks_obtained}. Must be between 0 and {exam.max_marks}."
        )

    ai_feedback = "Strong analytical skills detected. Needs focus on creative writing."
    
    new_result = ExamResult(
        tenant_id=tid,
        student_id=student_uuid,
        exam_id=exam_uuid,
        subject_id=result_in.subject_id,
        marks_obtained=result_in.marks_obtained,
        grade=result_in.grade,
        competency_scores=result_in.competency_scores,
        ai_evaluation=ai_feedback
    )
    db.add(new_result)
    db.commit()
    db.refresh(new_result)
    return new_result
