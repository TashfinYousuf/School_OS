import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.academic import ClassRoutine, DailyLessonLog

router = APIRouter(tags=["AcademicOS & Routine"])

# Clean Gemini API Client
clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)


# --- 1. Pydantic Schemas (Both naming conventions supported) ---
class RoutineSlotBase(BaseModel):
    class_name: str
    day_of_week: str
    period_number: str
    start_time: str
    end_time: str
    subject: str
    teacher_name: str
    room_number: Optional[str] = "Room 1"

class RoutineSlotCreate(RoutineSlotBase):
    pass

class RoutineCreatePayload(RoutineSlotBase):
    pass

class RoutineSlotResponse(RoutineSlotBase):
    id: uuid.UUID
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True

# Alias for backward compatibility
RoutineItemResponse = RoutineSlotResponse

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


# --- 2. Endpoints ---

# A. Get Routine by Class (Direct URL Path)
@router.get("/class/{class_name}", response_model=List[RoutineSlotResponse])
def get_class_routine_by_path(
    class_name: str,
    day_of_week: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"]))
):
    query = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == str(tenant_id),
        ClassRoutine.class_name == class_name
    )
    if day_of_week:
        query = query.filter(ClassRoutine.day_of_week == day_of_week)
        
    return query.order_by(ClassRoutine.period_number.asc()).all()


# B. Get Routine (Query Parameter Path)
@router.get("/routine", response_model=List[RoutineSlotResponse])
def get_class_routine_by_query(
    class_name: Optional[str] = Query(None),
    day_of_week: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"]))
):
    query = db.query(ClassRoutine).filter(ClassRoutine.tenant_id == str(tenant_id))

    if class_name:
        query = query.filter(ClassRoutine.class_name == class_name)
    if day_of_week:
        query = query.filter(ClassRoutine.day_of_week == day_of_week)

    return query.order_by(ClassRoutine.day_of_week.asc(), ClassRoutine.start_time.asc()).all()


# C. Create Routine Slot (Supports POST / and POST /routine)
@router.post("/", response_model=RoutineSlotResponse, status_code=status.HTTP_201_CREATED)
@router.post("/routine", response_model=RoutineSlotResponse, status_code=status.HTTP_201_CREATED)
def create_routine_slot(
    payload: RoutineSlotCreate,
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


# D. Delete Routine Slot (Supports DELETE /{slot_id} and DELETE /routine/{slot_id})
@router.delete("/{slot_id}", status_code=status.HTTP_200_OK)
@router.delete("/routine/{slot_id}", status_code=status.HTTP_200_OK)
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
        raise HTTPException(status_code=404, detail="Routine slot not found.")

    db.delete(slot)
    db.commit()
    return {"message": "Routine slot removed successfully"}


# E. AI Lecture Blueprint Generator (TeacherOS Copilot)
@router.post("/generate-lecture", dependencies=[Depends(require_roles(["admin", "teacher"]))])
def generate_lecture_blueprint(payload: GenerateLecturePayload):
    system_instruction = (
        "You are an NCTB Curriculum Specialist for Kids Shine International School. "
        "Create a concise 1-page structured lecture outline: "
        "1. Core Learning Objectives (3 bullet points) "
        "2. Essential Concept Summary "
        "3. In-class Activity / Example Problem "
        "4. 1 Homework Exercise. "
        "Respond in cleanly formatted text (Bangla or English matching query)."
    )
    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
        )
        prompt = f"Class: {payload.class_name}\nSubject: {payload.subject}\nTopic: {payload.topic_title}"
        response = chat.send_message(prompt)
        return {"blueprint": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")


# F. Save Daily Lesson Log (Anti-Drift Curriculum Record)
@router.post("/save-lesson", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin", "teacher"]))])
def save_daily_lesson_log(
    payload: SaveLessonPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    lesson = DailyLessonLog(
        tenant_id=str(tenant_id),
        class_name=payload.class_name,
        subject=payload.subject,
        teacher_name=payload.teacher_name,
        topic_title=payload.topic_title,
        lecture_summary=payload.lecture_summary,
        homework_assigned=payload.homework_assigned,
        submission_deadline=payload.submission_deadline,
        date=datetime.date.today()
    )
    db.add(lesson)
    db.commit()
    db.refresh(lesson)
    return {"message": "Lesson log saved to curriculum audit trail", "id": str(lesson.id)}


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
    return {"message": "Lesson log successfully saved to curriculum audit trail", "id": log.id}

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