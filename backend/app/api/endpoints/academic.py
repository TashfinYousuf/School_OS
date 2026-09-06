import uuid

from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from google import genai
from google.genai import types

from app.core.config import settings
from app.core.database import get_db
from app.models.academic import ClassModel, ClassRoutine, AcademicSession, GradeLevel, Subject, DailyLessonLog
from app.schemas.academic import (
    ClassCreate, ClassResponse, 
    SubjectCreate, SubjectResponse,
    AcademicSessionCreate, AcademicSessionResponse
)

from app.schemas.academic import GradeLevelCreate, GradeLevelResponse, SubjectCreate, SubjectResponse

# --- The Magic Middleware ---
from app.api.deps import get_current_tenant_id, require_roles

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

router = APIRouter()


class RoutineCreatePayload(BaseModel):
    class_name: str
    day_of_week: str
    period_number: str
    start_time: str
    end_time: str
    subject: str
    teacher_name: str
    room_number: Optional[str] = "Room 1"

class RoutineItemResponse(BaseModel):
    id: uuid.UUID
    class_name: str
    day_of_week: str
    period_number: str
    start_time: str
    end_time: str
    subject: str
    teacher_name: str
    room_number: str

    class Config:
        from_attributes = True

# --- Class Endpoints ---
@router.post("/classes/", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
def create_class(
    class_in: ClassCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    new_class = ClassModel(
        class_name=class_in.class_name,
        tenant_id=tenant_id 
    )
    db.add(new_class)
    db.commit()
    db.refresh(new_class)
    return new_class

@router.get("/classes/", response_model=List[ClassResponse])
def get_classes(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id) 
):
    classes = db.query(ClassModel).filter(ClassModel.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return classes


# --- NEW: Academic Session Endpoints ---
@router.post("/sessions/", response_model=AcademicSessionResponse, status_code=status.HTTP_201_CREATED)
def create_academic_session(
    session_in: AcademicSessionCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Create a new Academic Session (e.g., "2027") for the school.
    """
    new_session = AcademicSession(
        session_year=session_in.session_year,
        is_current=session_in.is_current,
        tenant_id=tenant_id
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/sessions/", response_model=List[AcademicSessionResponse])
def get_academic_sessions(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Get all academic sessions for the school.
    """
    sessions = db.query(AcademicSession).filter(AcademicSession.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return sessions


# --- Classes / Grade Levels ---
@router.post("/grades", response_model=GradeLevelResponse, status_code=status.HTTP_201_CREATED)
def create_grade(
    grade_in: GradeLevelCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    new_grade = GradeLevel(**grade_in.model_dump(), tenant_id=tenant_id)
    db.add(new_grade)
    db.commit()
    db.refresh(new_grade)
    return new_grade

@router.get("/grades", response_model=List[GradeLevelResponse])
def get_grades(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    return db.query(GradeLevel).filter(GradeLevel.tenant_id == tenant_id).offset(skip).limit(limit).all()

# --- Subjects & Core Competencies ---
@router.post("/grades/{grade_id}/subjects", response_model=SubjectResponse, status_code=status.HTTP_201_CREATED)
def create_subject(
    grade_id: uuid.UUID,
    subject_in: SubjectCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    # Verify if the grade belongs to this tenant
    grade = db.query(GradeLevel).filter(GradeLevel.id == grade_id, GradeLevel.tenant_id == tenant_id).first()
    if not grade:
        raise HTTPException(status_code=404, detail="Class/Grade not found")
    
    new_subject = Subject(**subject_in.model_dump(), grade_id=grade_id, tenant_id=tenant_id)
    db.add(new_subject)
    db.commit()
    db.refresh(new_subject)
    return new_subject


@router.get("/class/{class_name}", response_model=List[RoutineItemResponse])
def get_class_routine(
    class_name: str,
    day_of_week: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "guardian"]))
):
    query = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == str(tenant_id),
        ClassRoutine.class_name == class_name
    )
    if day_of_week:
        query = query.filter(ClassRoutine.day_of_week == day_of_week)
        
    return query.order_by(ClassRoutine.period_number.asc()).all()

@router.post("/", response_model=RoutineItemResponse, status_code=status.HTTP_201_CREATED)
def add_routine_slot(
    payload: RoutineCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    slot = ClassRoutine(
        tenant_id=str(tenant_id),
        class_name=payload.class_name,
        day_of_week=payload.day_of_week,
        period_number=payload.period_number,
        start_time=payload.start_time,
        end_time=payload.end_time,
        subject=payload.subject,
        teacher_name=payload.teacher_name,
        room_number=payload.room_number or "Room 1"
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot

@router.delete("/{slot_id}")
def delete_routine_slot(
    slot_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    slot = db.query(ClassRoutine).filter(
        ClassRoutine.id == slot_id, 
        ClassRoutine.tenant_id == str(tenant_id)
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Routine slot not found")
        
    db.delete(slot)
    db.commit()
    return {"message": "Routine slot removed"}

class GenerateLecturePayload(BaseModel):
    class_name: str
    subject: str
    topic_title: str

class SaveLessonPayload(BaseModel):
    class_name: str
    subject: str
    teacher_name: str
    topic_title: str
    lecture_summary: str
    homework_assigned: Optional[str] = None
    submission_deadline: Optional[str] = "Next Class"

@router.post("/lessons/generate-materials")
def generate_lecture_and_homework_ai(
    payload: GenerateLecturePayload,
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Generates a 1-page structured lecture handout, classroom tasks, and homework.
    """
    system_instruction = (
        "You are an expert primary/secondary curriculum educator for Bangladesh. "
        "Create a comprehensive 1-page teaching handout containing: "
        "1. Core Concepts & Lesson Summary (সহজ ও সাবলীল ব্যাখ্যা) "
        "2. Classroom Interactive Tasks (শ্রেণির কাজ) "
        "3. Homework Questions with Submission Guidelines (বাড়ির কাজ). "
        "Use English or Bangla matching the subject. Maintain clear headings."
    )

    prompt = (
        f"Institution: Kids Shine International School\n"
        f"Class: {payload.class_name}\n"
        f"Subject: {payload.subject}\n"
        f"Topic to Cover: {payload.topic_title}\n\n"
        "Draft the full teaching handout now."
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.3)
        )
        response = chat.send_message(prompt)
        return {
            "topic_title": payload.topic_title,
            "handout_content": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Handout Engine Error: {str(e)}")

@router.post("/lessons/log", status_code=status.HTTP_201_CREATED)
def record_daily_lesson(
    payload: SaveLessonPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    log = DailyLessonLog(
        tenant_id=str(tenant_id),
        class_name=payload.class_name,
        subject=payload.subject,
        teacher_name=payload.teacher_name,
        topic_title=payload.topic_title,
        lecture_summary=payload.lecture_summary,
        homework_assigned=payload.homework_assigned,
        submission_deadline=payload.submission_deadline
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"message": "Lesson log archived successfully", "id": log.id}

@router.get("/lessons/history")
def get_lesson_history(
    class_name: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "guardian"]))
):
    query = db.query(DailyLessonLog).filter(DailyLessonLog.tenant_id == str(tenant_id))
    if class_name:
        query = query.filter(DailyLessonLog.class_name == class_name)
    return query.order_by(DailyLessonLog.lesson_date.desc()).limit(30).all()