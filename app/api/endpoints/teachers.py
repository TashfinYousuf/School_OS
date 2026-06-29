from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User
from app.models.users import Teacher
from app.schemas.teacher import TeacherCreate, TeacherResponse

# --- Magic Tenant Middleware ---
from app.api.deps import get_current_tenant_id

router = APIRouter()

@router.post("/", response_model=TeacherResponse, status_code=status.HTTP_201_CREATED)
def create_teacher(
    teacher_in: TeacherCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Add a new Teacher to the school. Creates both User login and Teacher profile.
    """
    # 1. Check if email already exists in this school
    existing_user = db.query(User).filter(User.email == teacher_in.email, User.tenant_id == tenant_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered in this school.")

    # 2. Create User account
    new_user = User(
        email=teacher_in.email,
        password_hash=get_password_hash(teacher_in.password),
        tenant_id=tenant_id
    )
    db.add(new_user)
    db.flush() 

    # 3. Create Teacher Profile
    new_teacher = Teacher(
        tenant_id=tenant_id,
        user_id=new_user.id,
        first_name=teacher_in.first_name,
        last_name=teacher_in.last_name,
        designation=teacher_in.designation
    )
    db.add(new_teacher)
    
    db.commit()
    db.refresh(new_teacher)
    return new_teacher

@router.get("/", response_model=List[TeacherResponse])
def get_teachers(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Get a list of all teachers in the logged-in user's school.
    """
    teachers = db.query(Teacher).filter(Teacher.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return teachers