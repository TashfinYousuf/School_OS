import uuid

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, load_only
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.deps import get_current_tenant_id, require_roles
from app.models.users import Teacher
from app.models.tenant import User

router = APIRouter()

# --- Pydantic Schemas ---
class TeacherResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: Optional[str] = None
    designation: Optional[str] = "Senior Teacher"
    phone_number: Optional[str] = ""
    assigned_class: Optional[str] = "Unassigned"
    subjects_taught: Optional[str] = ""
    status: Optional[str] = "Active"

    class Config:
        from_attributes = True

class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: Optional[str] = "Teacher@123"
    designation: Optional[str] = "Senior Teacher"
    phone_number: Optional[str] = ""
    assigned_class: Optional[str] = "Unassigned"
    subjects_taught: Optional[str] = ""

class TeacherUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    designation: Optional[str] = None
    phone_number: Optional[str] = None
    assigned_class: Optional[str] = None
    subjects_taught: Optional[str] = None
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

    # 1. Create User account with role as plain string
    new_user = User(
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        tenant_id=str(tenant_id),
        role="teacher"
    )
    db.add(new_user)
    db.flush()

    # 2. Create Teacher profile (do NOT pass email or password here)
    new_teacher = Teacher(
        tenant_id=str(tenant_id),
        user_id=new_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        designation=payload.designation or "Senior Teacher",
        phone_number=payload.phone_number or "",
        assigned_class=payload.assigned_class or "Unassigned",
        subjects_taught=payload.subjects_taught or "",
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

    # Linked User cleanup
    if teacher.user_id:
        user = db.query(User).filter(User.id == teacher.user_id).first()
        if user:
            db.delete(user)

    db.delete(teacher)
    db.commit()
    return {"message": f"Teacher {teacher.first_name} {teacher.last_name} removed successfully"}