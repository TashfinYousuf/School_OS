from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User
from app.models.users import Student
from app.schemas.student import StudentAdmission, StudentResponse

# --- The Magic Middleware ---
from app.api.deps import get_current_tenant_id

router = APIRouter()

@router.post("/admission/", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def admit_student(
    student_in: StudentAdmission,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id) # টোকেন থেকে স্কুলের আইডি নিচ্ছে
):
    """
    Admit a new student. This creates both a User account and a Student profile.
    """
    # 1. Check if email already exists in this school
    existing_user = db.query(User).filter(User.email == student_in.email, User.tenant_id == tenant_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="This email is already registered in this school.")

    # 2. Check if admission number is unique in this school
    existing_student = db.query(Student).filter(Student.admission_number == student_in.admission_number, Student.tenant_id == tenant_id).first()
    if existing_student:
        raise HTTPException(status_code=400, detail="This admission number is already in use.")

    # 3. Create User account first
    new_user = User(
        email=student_in.email,
        password_hash=get_password_hash(student_in.password),
        tenant_id=tenant_id
    )
    db.add(new_user)
    db.flush() # ডেটাবেসে পুশ করে ID জেনারেট করে আনবে, কিন্তু ফাইনাল সেভ করবে না

    # 4. Create Student Profile and link with User ID
    new_student = Student(
        tenant_id=tenant_id,
        user_id=new_user.id,
        first_name=student_in.first_name,
        last_name=student_in.last_name,
        admission_number=student_in.admission_number,
        date_of_birth=student_in.date_of_birth
    )
    db.add(new_student)
    
    # 5. Commit both transactions together
    db.commit()
    db.refresh(new_student)

    return new_student


@router.get("/", response_model=List[StudentResponse])
def get_students(
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Get all students for the logged-in user's school.
    """
    students = db.query(Student).filter(Student.tenant_id == tenant_id).offset(skip).limit(limit).all()
    return students