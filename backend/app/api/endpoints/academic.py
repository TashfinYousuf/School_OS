import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, require_roles, get_current_user
from app.models.academic import ClassRoutine, DailyLessonLog, GradeLevel, Subject, StudentEnrollmentHistory
from app.models.student import Student
from app.models.audit import AuditLog
from app.schemas.academic import (
    GradeLevelResponse,
    GradeLevelCreate,
    SubjectResponse,
    AcademicClassItem,
    BulkPromotionRequest,
    BulkPromotionResponse,
)
from app.services.institution import get_institution_profile
from app.services.ai_gateway import (
    ai_gateway,
    AIGenerationError,
    AIBudgetExceededError,
    PromptInjectionDetected,
)
from app.services.curriculum_rag import curriculum_rag

router = APIRouter()

# Clean Gemini API Client
from app.core.ai_client import ai_client


# Standard Bangladesh NCTB Curriculum Grades (Play to Class 12)
NCTB_DEFAULT_GRADES = [
    {"name": "Play", "description": "Early Childhood Education (Playgroup)"},
    {"name": "Nursery", "description": "Pre-Primary Foundation Stage"},
    {"name": "KG", "description": "Kindergarten Foundation Stage"},
    {"name": "Class 1", "description": "Primary Stage (NCTB Baseline)"},
    {"name": "Class 2", "description": "Primary Stage (NCTB Baseline)"},
    {"name": "Class 3", "description": "Primary Stage (NCTB Baseline)"},
    {"name": "Class 4", "description": "Primary Stage (NCTB Baseline)"},
    {"name": "Class 5", "description": "Primary Terminal Stage (PSC Level)"},
    {"name": "Class 6", "description": "Junior Secondary Stage (NCTB Curriculum)"},
    {"name": "Class 7", "description": "Junior Secondary Stage (NCTB Curriculum)"},
    {"name": "Class 8", "description": "Junior Secondary Terminal Stage (JSC Level)"},
    {"name": "Class 9", "description": "Secondary Stage (SSC Science/Commerce/Humanities)"},
    {"name": "Class 10", "description": "Secondary Terminal Stage (SSC Board Exam)"},
    {"name": "Class 11", "description": "Higher Secondary / Intermediate 1st Year (HSC)"},
    {"name": "Class 12", "description": "Higher Secondary / Intermediate 2nd Year (HSC Board Exam)"},
]

CANONICAL_ACADEMIC_CLASSES = [
    AcademicClassItem(
        class_name="Play",
        name_bn="প্লে",
        grade_numeric=0,
        tier="pre_primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "Rose"],
    ),
    AcademicClassItem(
        class_name="Nursery",
        name_bn="নার্সারি",
        grade_numeric=0,
        tier="pre_primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "Lotus"],
    ),
    AcademicClassItem(
        class_name="KG",
        name_bn="কেজি",
        grade_numeric=0,
        tier="pre_primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "Tulip"],
    ),
    AcademicClassItem(
        class_name="Class 1",
        name_bn="প্রথম শ্রেণি",
        grade_numeric=1,
        tier="primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B"],
    ),
    AcademicClassItem(
        class_name="Class 2",
        name_bn="দ্বিতীয় শ্রেণি",
        grade_numeric=2,
        tier="primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B"],
    ),
    AcademicClassItem(
        class_name="Class 3",
        name_bn="তৃতীয় শ্রেণি",
        grade_numeric=3,
        tier="primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B"],
    ),
    AcademicClassItem(
        class_name="Class 4",
        name_bn="চতুর্থ শ্রেণি",
        grade_numeric=4,
        tier="primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B"],
    ),
    AcademicClassItem(
        class_name="Class 5",
        name_bn="পঞ্চম শ্রেণি",
        grade_numeric=5,
        tier="primary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B"],
    ),
    AcademicClassItem(
        class_name="Class 6",
        name_bn="ষষ্ঠ শ্রেণি",
        grade_numeric=6,
        tier="junior_secondary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B", "C"],
    ),
    AcademicClassItem(
        class_name="Class 7",
        name_bn="সপ্তম শ্রেণি",
        grade_numeric=7,
        tier="junior_secondary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B", "C"],
    ),
    AcademicClassItem(
        class_name="Class 8",
        name_bn="অষ্টম শ্রেণি",
        grade_numeric=8,
        tier="junior_secondary",
        supported_groups=[],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B", "C"],
    ),
    AcademicClassItem(
        class_name="Class 9",
        name_bn="নবম শ্রেণি",
        grade_numeric=9,
        tier="secondary",
        supported_groups=["Science", "Humanities", "Business Studies"],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B", "Science-A", "Commerce-A"],
    ),
    AcademicClassItem(
        class_name="Class 10",
        name_bn="দশম শ্রেণি",
        grade_numeric=10,
        tier="secondary",
        supported_groups=["Science", "Humanities", "Business Studies"],
        supported_shifts=["Morning", "Day"],
        default_sections=["A", "B", "Science-A", "Commerce-A"],
    ),
    AcademicClassItem(
        class_name="Class 11",
        name_bn="একাদশ শ্রেণি",
        grade_numeric=11,
        tier="higher_secondary",
        supported_groups=["Science", "Humanities", "Business Studies"],
        supported_shifts=["Morning", "Day"],
        default_sections=["Science-1", "Arts-1", "Commerce-1"],
    ),
    AcademicClassItem(
        class_name="Class 12",
        name_bn="দ্বাদশ শ্রেণি",
        grade_numeric=12,
        tier="higher_secondary",
        supported_groups=["Science", "Humanities", "Business Studies"],
        supported_shifts=["Morning", "Day"],
        default_sections=["Science-1", "Arts-1", "Commerce-1"],
    ),
]


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
    section: Optional[str] = "A"
    shift: Optional[str] = "Morning"
    group: Optional[str] = None

class RoutineSlotCreate(RoutineSlotBase):
    pass

class RoutineCreatePayload(RoutineSlotBase):
    pass

class RoutineSlotResponse(RoutineSlotBase):
    id: uuid.UUID
    tenant_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

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

# 0. Curriculum Grades (NCTB Class 1 to 10 Range)
@router.get("/grades", response_model=List[GradeLevelResponse])
def get_curriculum_grades(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"]))
):
    """
    Returns authentic curriculum grade levels for this tenant.
    Auto-provisions NCTB Class 1 to Class 10 curriculum grades if not yet initialized.
    """
    try:
        t_uuid = uuid.UUID(str(tenant_id))
    except (ValueError, AttributeError):
        t_uuid = uuid.uuid4()

    existing = db.query(GradeLevel).filter(GradeLevel.tenant_id == t_uuid).order_by(GradeLevel.name.asc()).all()
    if existing:
        return existing

    # Auto-seed NCTB standard Class 1 to 10 grades for this tenant
    seeded = []
    for g in NCTB_DEFAULT_GRADES:
        lvl = GradeLevel(
            id=uuid.uuid4(),
            tenant_id=t_uuid,
            name=g["name"],
            description=g["description"]
        )
        db.add(lvl)
        seeded.append(lvl)

    db.commit()
    for lvl in seeded:
        db.refresh(lvl)

    return seeded


@router.post("/grades", response_model=GradeLevelResponse, status_code=status.HTTP_201_CREATED)
def create_curriculum_grade(
    payload: GradeLevelCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Creates a custom curriculum grade level scoped strictly to this tenant.
    """
    try:
        t_uuid = uuid.UUID(str(tenant_id))
    except (ValueError, AttributeError):
        t_uuid = uuid.uuid4()

    new_grade = GradeLevel(
        id=uuid.uuid4(),
        tenant_id=t_uuid,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None
    )
    db.add(new_grade)
    db.commit()
    db.refresh(new_grade)
    return new_grade


@router.get("/classes", response_model=List[AcademicClassItem])
def get_academic_classes(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student", "guardian"]))
):
    """
    Returns the canonical and tenant-configured Class 1–12 academic levels,
    including SSC and HSC specialized streams (Science, Humanities, Business Studies).
    """
    return CANONICAL_ACADEMIC_CLASSES


@router.post("/promote", response_model=BulkPromotionResponse)
def bulk_promote_students(
    payload: BulkPromotionRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user=Depends(get_current_user),
    _=Depends(require_roles(["admin"]))
):
    """
    Bulk promotes or transitions students between academic years and classes.
    Preserves historical enrollment in student_enrollment_history before updating active student record.
    Supports dry_run preview.
    """
    tid = str(tenant_id)
    details = []
    promoted_count = 0
    retained_count = 0
    transferred_count = 0

    for item in payload.students:
        student = db.query(Student).filter(Student.id == item.student_id, Student.tenant_id == tid).first()
        if not student:
            continue

        status_action = (item.status or "PROMOTED").upper()
        if status_action == "PROMOTED":
            promoted_count += 1
            target_class = payload.to_class
        elif status_action == "RETAINED":
            retained_count += 1
            target_class = payload.from_class
        else:
            transferred_count += 1
            target_class = payload.to_class

        detail_entry = {
            "student_id": str(student.id),
            "name": f"{student.first_name} {student.last_name}",
            "previous_class": student.class_name,
            "previous_roll": student.roll_number,
            "previous_section": student.section,
            "new_class": target_class,
            "new_roll": item.to_roll or student.roll_number,
            "new_section": item.to_section or student.section or "A",
            "new_group": item.to_group or student.group,
            "status": status_action,
        }
        details.append(detail_entry)

        if not payload.dry_run:
            # 1. Archive prior academic enrollment history
            history_rec = StudentEnrollmentHistory(
                tenant_id=tid,
                student_id=student.id,
                academic_year=payload.from_academic_year,
                class_name=student.class_name or payload.from_class,
                section=student.section or "A",
                roll_number=student.roll_number,
                group=student.group,
                shift=student.shift or "Morning",
                promotion_status=status_action,
                remarks=f"Transitioned from {payload.from_academic_year} to {payload.to_academic_year}",
            )
            db.add(history_rec)

            # 2. Update active student record
            student.class_name = target_class
            student.academic_year = payload.to_academic_year
            if item.to_section:
                student.section = item.to_section
            if item.to_roll:
                student.roll_number = item.to_roll
            if item.to_group:
                student.group = item.to_group

    if not payload.dry_run:
        audit_log = AuditLog(
            tenant_id=tid,
            user_id=str(current_user.id) if current_user else None,
            action="BULK_STUDENT_PROMOTION",
            entity="StudentEnrollmentHistory",
            entity_id=payload.to_class,
            details={
                "from_year": payload.from_academic_year,
                "to_year": payload.to_academic_year,
                "from_class": payload.from_class,
                "to_class": payload.to_class,
                "promoted_count": promoted_count,
                "retained_count": retained_count,
                "transferred_count": transferred_count,
            }
        )
        db.add(audit_log)
        db.commit()

    return BulkPromotionResponse(
        from_academic_year=payload.from_academic_year,
        to_academic_year=payload.to_academic_year,
        from_class=payload.from_class,
        to_class=payload.to_class,
        dry_run=payload.dry_run,
        promoted_count=promoted_count,
        retained_count=retained_count,
        transferred_count=transferred_count,
        details=details
    )


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
    tid = str(tenant_id)
    room_to_check = payload.room_number or "Room 1"

    # 1. Conflict Check: Teacher Allocation Collision
    teacher_conflict = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == tid,
        ClassRoutine.day_of_week == payload.day_of_week,
        ClassRoutine.period_number == payload.period_number,
        ClassRoutine.teacher_name == payload.teacher_name
    ).first()
    if teacher_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Teacher Conflict: Educator '{payload.teacher_name}' is already assigned to class '{teacher_conflict.class_name}' on {payload.day_of_week} ({payload.period_number})."
        )

    # 2. Conflict Check: Room Allocation Collision
    room_conflict = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == tid,
        ClassRoutine.day_of_week == payload.day_of_week,
        ClassRoutine.period_number == payload.period_number,
        ClassRoutine.room_number == room_to_check
    ).first()
    if room_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room Conflict: '{room_to_check}' is already occupied by class '{room_conflict.class_name}' on {payload.day_of_week} ({payload.period_number})."
        )

    # 3. Conflict Check: Duplicate Class Period Collision
    class_conflict = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == tid,
        ClassRoutine.class_name == payload.class_name,
        ClassRoutine.day_of_week == payload.day_of_week,
        ClassRoutine.period_number == payload.period_number
    ).first()
    if class_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Class Schedule Conflict: Class '{payload.class_name}' already has subject '{class_conflict.subject}' assigned for {payload.period_number} on {payload.day_of_week}."
        )

    slot = ClassRoutine(
        tenant_id=tid,
        class_name=payload.class_name,
        day_of_week=payload.day_of_week,
        period_number=payload.period_number,
        start_time=payload.start_time,
        end_time=payload.end_time,
        subject=payload.subject,
        teacher_name=payload.teacher_name,
        room_number=room_to_check
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
def generate_lecture_blueprint(payload: GenerateLecturePayload, db: Session = Depends(get_db), tenant_id: str = Depends(get_current_tenant_id)):
    school_name = get_institution_profile(db, tenant_id).name
    
    # 1. Prompt Injection Sanitization
    for txt in [payload.topic_title, payload.subject, payload.class_name]:
        try:
            ai_gateway.sanitize_input(txt)
        except PromptInjectionDetected:
            raise HTTPException(status_code=400, detail="Potential prompt injection or invalid characters detected.")

    # 2. RAG Curriculum Grounding
    grounding = curriculum_rag.format_grounding_context(
        db=db,
        tenant_id=str(tenant_id),
        subject=payload.subject,
        class_name=payload.class_name,
        query=payload.topic_title,
        limit=3
    )

    system_instruction = (
        f"You are an authoritative NCTB Curriculum Specialist for {school_name}. "
        "Create a concise 1-page structured lecture outline: "
        "1. Core Learning Objectives (3 bullet points) "
        "2. Essential Concept Summary grounded in curriculum "
        "3. In-class Activity / Example Problem "
        "4. 1 Homework Exercise. "
        "Respond in cleanly formatted text (Bangla or English matching query)."
    )
    prompt = (
        f"Grounding Material:\n{grounding}\n\n"
        f"Class: {payload.class_name}\nSubject: {payload.subject}\nTopic: {payload.topic_title}"
    )
    try:
        response_text = ai_gateway.execute_with_failover(
            db=db,
            tenant_id=str(tenant_id),
            feature="lecture_blueprint",
            system_instruction=system_instruction,
            prompt=prompt,
            temperature=0.3
        )
        return {"blueprint": response_text}
    except AIBudgetExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
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
    school_name: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Generates a 1-page structured lecture handout, classroom tasks, and homework.
    Protected with prompt sanitization, RAG context, and FinOps budgeting.
    """
    if not school_name:
        inst = get_institution_profile(db, tenant_id)
        school_name = inst.name if inst else "SchoolOS Academy"
    for txt in [payload.topic_title, payload.subject, payload.class_name]:
        try:
            ai_gateway.sanitize_input(txt)
        except PromptInjectionDetected:
            raise HTTPException(status_code=400, detail="Potential prompt injection or invalid characters detected.")

    grounding = curriculum_rag.format_grounding_context(
        db=db,
        tenant_id=str(tenant_id),
        subject=payload.subject,
        class_name=payload.class_name,
        query=payload.topic_title,
        limit=3
    )

    system_instruction = (
        "You are an expert primary/secondary curriculum educator for Bangladesh. "
        "Create a comprehensive 1-page teaching handout containing: "
        "1. Core Concepts & Lesson Summary (সহজ ও সাবলীল ব্যাখ্যা) "
        "2. Classroom Interactive Tasks (শ্রেণির কাজ) "
        "3. Homework Questions with Submission Guidelines (বাড়ির কাজ). "
        "Use English or Bangla matching the subject. Maintain clear headings."
    )

    prompt = (
        f"Institution: {school_name}\n"
        f"Grounding Material:\n{grounding}\n\n"
        f"Class: {payload.class_name}\n"
        f"Subject: {payload.subject}\n"
        f"Topic to Cover: {payload.topic_title}\n\n"
        "Draft the full teaching handout now."
    )

    try:
        response_text = ai_gateway.execute_with_failover(
            db=db,
            tenant_id=str(tenant_id),
            feature="lecture_materials",
            system_instruction=system_instruction,
            prompt=prompt,
            temperature=0.3
        )
        return {
            "topic_title": payload.topic_title,
            "handout_content": response_text
        }
    except AIBudgetExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
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