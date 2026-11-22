import uuid
from datetime import date, datetime
from typing import List, Optional, Any
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, load_only
from pydantic import BaseModel, ConfigDict

from app.core.security import get_password_hash
from app.api.deps import get_db, get_current_tenant_id, get_current_user, require_roles
from app.models.users import Teacher
from app.models.tenant import User
from app.models.academic import ClassRoutine
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.core.db_utils import count_rows

router = APIRouter()

# --- Pydantic Schemas ---
class TeacherResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    name_bn: Optional[str] = None
    email: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = "Senior Teacher"
    department: Optional[str] = None
    employment_type: Optional[str] = "Permanent"
    joining_date: Optional[date] = None
    phone_number: Optional[str] = ""
    assigned_class: Optional[str] = "Unassigned"
    subjects_taught: Optional[str] = ""
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Any]] = []
    experience: Optional[List[Any]] = []
    cv_url: Optional[str] = None
    bio: Optional[str] = None
    attendance_today: Optional[str] = "Pending"
    status: Optional[str] = "Active"

    model_config = ConfigDict(from_attributes=True)

class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    name_bn: Optional[str] = None
    email: str
    password: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = "Senior Teacher"
    department: Optional[str] = None
    employment_type: Optional[str] = "Permanent"
    joining_date: Optional[date] = None
    phone_number: Optional[str] = ""
    assigned_class: Optional[str] = "Unassigned"
    subjects_taught: Optional[str] = ""
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Any]] = []
    experience: Optional[List[Any]] = []
    cv_url: Optional[str] = None
    bio: Optional[str] = None

class TeacherUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name_bn: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    joining_date: Optional[date] = None
    phone_number: Optional[str] = None
    assigned_class: Optional[str] = None
    subjects_taught: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Any]] = None
    experience: Optional[List[Any]] = None
    cv_url: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None

# --- Endpoints ---

@router.get("/", response_model=List[TeacherResponse])
def list_teachers(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns faculty list. load_only ensures we only select the verified 
    columns from User (email, id) without blowing up on optional name columns.
    """
    teachers = (
        db.query(Teacher)
        .options(
            joinedload(Teacher.user).load_only(User.id, User.email)
        )
        .filter(Teacher.tenant_id == str(tenant_id))
        .order_by(Teacher.first_name.asc())
        .all()
    )
    return teachers

@router.get("/me/workload")
def get_my_workload(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns workload, timetable, and classroom metrics for the authenticated educator.
    """
    teacher = (
        db.query(Teacher)
        .options(joinedload(Teacher.user))
        .filter(Teacher.tenant_id == str(tenant_id), Teacher.user_id == current_user.id)
        .first()
    )
    if not teacher and current_user.role == "admin":
        teacher = (
            db.query(Teacher)
            .options(joinedload(Teacher.user))
            .filter(Teacher.tenant_id == str(tenant_id))
            .first()
        )

    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher profile not found for current user.")

    dhaka_now = datetime.now(ZoneInfo("Asia/Dhaka"))
    today_day = dhaka_now.strftime("%A")
    today_date = dhaka_now.date()

    slots = (
        db.query(ClassRoutine)
        .filter(
            ClassRoutine.tenant_id == str(tenant_id),
            (
                ClassRoutine.teacher_name.ilike(f"%{teacher.first_name}%") |
                ClassRoutine.teacher_name.ilike(f"%{teacher.last_name}%")
            )
        )
        .order_by(ClassRoutine.period_number.asc())
        .all()
    )

    today_slots = [s for s in slots if s.day_of_week.lower() == today_day.lower()]

    assigned_class_students = 0
    att_present = 0
    att_absent = 0
    if teacher.assigned_class and teacher.assigned_class != "Unassigned":
        assigned_class_students = count_rows(
            db,
            db.query(Student).filter(
                Student.tenant_id == str(tenant_id),
                Student.class_name == teacher.assigned_class,
                Student.status == "Active"
            )
        )
        events = (
            db.query(AttendanceEvent)
            .filter(
                AttendanceEvent.tenant_id == str(tenant_id),
                AttendanceEvent.date == today_date,
                AttendanceEvent.class_id == teacher.assigned_class
            )
            .all()
        )
        att_present = sum(1 for e in events if e.status.lower() == "present")
        att_absent = sum(1 for e in events if e.status.lower() in ("absent", "late"))

    return {
        "teacher_id": str(teacher.id),
        "first_name": teacher.first_name,
        "last_name": teacher.last_name,
        "name_bn": teacher.name_bn,
        "email": teacher.email,
        "employee_id": teacher.employee_id,
        "designation": teacher.designation or "Senior Teacher",
        "department": teacher.department or "General",
        "assigned_class": teacher.assigned_class or "Unassigned",
        "subjects_taught": teacher.subjects_taught or "",
        "day_of_week": today_day,
        "today_periods_count": len(today_slots),
        "total_weekly_periods": len(slots),
        "today_schedule": [
            {
                "id": str(s.id),
                "class_name": s.class_name,
                "section": s.section,
                "shift": s.shift,
                "day_of_week": s.day_of_week,
                "period_number": s.period_number,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "subject": s.subject,
                "room_number": s.room_number,
            }
            for s in today_slots
        ],
        "assigned_class_student_count": assigned_class_students,
        "assigned_class_attendance_summary": {
            "present": att_present,
            "absent": att_absent,
            "total_marked": att_present + att_absent,
            "rate_pct": round((att_present / assigned_class_students * 100), 1) if assigned_class_students > 0 else 0
        }
    }

@router.get("/{teacher_id}/profile-360")
def get_teacher_profile_360(
    teacher_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns comprehensive 360-degree educator dossier.
    """
    teacher = (
        db.query(Teacher)
        .options(joinedload(Teacher.user))
        .filter(Teacher.id == teacher_id, Teacher.tenant_id == str(tenant_id))
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    slots = (
        db.query(ClassRoutine)
        .filter(
            ClassRoutine.tenant_id == str(tenant_id),
            (
                ClassRoutine.teacher_name.ilike(f"%{teacher.first_name}%") |
                ClassRoutine.teacher_name.ilike(f"%{teacher.last_name}%")
            )
        )
        .order_by(ClassRoutine.day_of_week.asc(), ClassRoutine.period_number.asc())
        .all()
    )

    assigned_class_students = 0
    if teacher.assigned_class and teacher.assigned_class != "Unassigned":
        assigned_class_students = count_rows(
            db,
            db.query(Student).filter(
                Student.tenant_id == str(tenant_id),
                Student.class_name == teacher.assigned_class,
                Student.status == "Active"
            )
        )

    weekly_routine: dict = {}
    for s in slots:
        day = s.day_of_week
        if day not in weekly_routine:
            weekly_routine[day] = []
        weekly_routine[day].append({
            "id": str(s.id),
            "class_name": s.class_name,
            "section": s.section,
            "shift": s.shift,
            "period_number": s.period_number,
            "start_time": s.start_time,
            "end_time": s.end_time,
            "subject": s.subject,
            "room_number": s.room_number,
        })

    return {
        "teacher": {
            "id": str(teacher.id),
            "first_name": teacher.first_name,
            "last_name": teacher.last_name,
            "name_bn": teacher.name_bn,
            "email": teacher.email,
            "employee_id": teacher.employee_id,
            "designation": teacher.designation or "Senior Teacher",
            "department": teacher.department or "General",
            "employment_type": teacher.employment_type or "Permanent",
            "joining_date": str(teacher.joining_date) if teacher.joining_date else None,
            "phone_number": teacher.phone_number or "",
            "assigned_class": teacher.assigned_class or "Unassigned",
            "subjects_taught": teacher.subjects_taught or "",
            "address": teacher.address,
            "emergency_contact": teacher.emergency_contact,
            "qualifications": teacher.qualifications or [],
            "experience": teacher.experience or [],
            "cv_url": teacher.cv_url,
            "bio": teacher.bio,
            "attendance_today": teacher.attendance_today or "Pending",
            "status": teacher.status or "Active",
            "created_at": str(teacher.created_at) if teacher.created_at else None,
        },
        "workload": {
            "total_weekly_periods": len(slots),
            "unique_subjects": list(set(s.subject for s in slots if s.subject)),
            "assigned_class_student_count": assigned_class_students,
            "weekly_routine": weekly_routine,
        }
    }

@router.post("/", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(
    payload: TeacherCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    """
    Creates a User credential account and links it to the new Teacher profile.
    """
    existing_user = db.query(User).filter(
        User.email == payload.email, 
        User.tenant_id == str(tenant_id)
    ).first()
    
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists.")

    import secrets
    raw_password = payload.password or secrets.token_urlsafe(12)
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(raw_password),
        tenant_id=str(tenant_id),
        role="teacher",
        is_active=True
    )
    db.add(new_user)
    db.flush()

    new_teacher = Teacher(
        tenant_id=str(tenant_id),
        user_id=new_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        name_bn=payload.name_bn,
        employee_id=payload.employee_id,
        designation=payload.designation or "Senior Teacher",
        department=payload.department,
        employment_type=payload.employment_type or "Permanent",
        joining_date=payload.joining_date,
        phone_number=payload.phone_number or "",
        assigned_class=payload.assigned_class or "Unassigned",
        subjects_taught=payload.subjects_taught or "",
        address=payload.address,
        emergency_contact=payload.emergency_contact,
        qualifications=payload.qualifications or [],
        experience=payload.experience or [],
        cv_url=payload.cv_url,
        bio=payload.bio,
        status="Active"
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    return new_teacher

@router.patch("/{teacher_id}", response_model=TeacherResponse)
def update_teacher(
    teacher_id: uuid.UUID,
    payload: TeacherUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    teacher = (
        db.query(Teacher)
        .options(joinedload(Teacher.user))
        .filter(Teacher.id == teacher_id, Teacher.tenant_id == str(tenant_id))
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(teacher, field, value)

    db.commit()
    db.refresh(teacher)
    return teacher

@router.delete("/{teacher_id}")
def delete_teacher(
    teacher_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    teacher = db.query(Teacher).filter(
        Teacher.id == teacher_id, 
        Teacher.tenant_id == str(tenant_id)
    ).first()
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Teacher not found")

    user_to_delete = None
    if teacher.user_id:
        user_to_delete = db.query(User).filter(User.id == teacher.user_id).first()

    # Delete teacher profile FIRST to eliminate FK constraint conflict
    teacher_name = f"{teacher.first_name} {teacher.last_name}"
    db.delete(teacher)
    db.flush()

    if user_to_delete:
        db.delete(user_to_delete)

    db.commit()
    return {"message": f"Teacher {teacher_name} removed successfully"}
