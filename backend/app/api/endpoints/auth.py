import uuid

from datetime import timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.tenant import User
from app.models.users import Teacher
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.tenant import User, SchoolProfile

router = APIRouter()

class StaffLoginPayload(BaseModel):
    email: str
    password: str

class GuardianLoginPayload(BaseModel):
    admission_number: str
    phone_number: str

class SchoolRegistrationPayload(BaseModel):
    school_name: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    contact_phone: str
    address: str

class StudentLoginPayload(BaseModel):
    admission_number: str
    password: str

# 1. Staff & Teacher Authentication (Email + Password)
@router.post("/staff", status_code=status.HTTP_200_OK)
@router.post("/access-token", status_code=status.HTTP_200_OK)
def login_staff(
    payload: StaffLoginPayload,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    # Resolve Display Name and Verified Role
    display_name = "Staff Member"
    actual_role = (user.role or "teacher").lower()

    if actual_role == "teacher":
        teacher_rec = db.query(Teacher).filter(Teacher.user_id == user.id).first()
        if teacher_rec:
            display_name = f"{teacher_rec.first_name} {teacher_rec.last_name}".strip()
        else:
            display_name = f"{user.first_name or ''} {user.last_name or 'Teacher'}".strip()
    elif actual_role == "admin":
        display_name = f"{user.first_name or 'Principal'} {user.last_name or 'Admin'}".strip()

    token = create_access_token(data={
    "sub": str(user.id),
    "tenant_id": str(user.tenant_id),
    "role": actual_role
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": actual_role,
        "name": display_name,
        "tenant_id": str(user.tenant_id)
    }

# 2. Guardian Authentication (Student Admission ID + Registered Phone)
@router.post("/guardian", status_code=status.HTTP_200_OK)
def login_guardian(
    payload: GuardianLoginPayload,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(
        Student.admission_number == payload.admission_number.strip()
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Student with this Admission ID does not exist."
        )

    # Fetch Linked Primary Guardian
    link = db.query(GuardianStudentLink).filter(GuardianStudentLink.student_id == student.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="No registered guardian record linked to this student."
        )

    guardian = db.query(Guardian).filter(Guardian.id == link.guardian_id).first()
    if not guardian:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guardian profile missing.")

    # Match phone number (Sanitized last 11 digits)
    clean_input = payload.phone_number.replace("+", "").replace("-", "").replace(" ", "")[-11:]
    clean_db = guardian.phone_number.replace("+", "").replace("-", "").replace(" ", "")[-11:]

    if clean_input != clean_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Mobile number does not match institutional records for this student."
        )

    token = create_access_token(data={
        "sub": str(guardian.id),
        "tenant_id": str(student.tenant_id),
        "role": "guardian"
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "guardian",
        "name": f"{guardian.first_name} {guardian.last_name} (Guardian)",
        "tenant_id": str(student.tenant_id),
        "student_id": str(student.id)
    }


@router.post("/register-school", status_code=status.HTTP_201_CREATED)
def register_new_school_tenant(
    payload: SchoolRegistrationPayload,
    db: Session = Depends(get_db)
):
    """
    Provisions a new School Tenant, sets up branding profile, 
    and creates the Root Administrator in one atomic transaction.
    """
    # 1. Check if email already registered
    existing_user = db.query(User).filter(User.email == payload.admin_email.lower().strip()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="An administrator with this email already exists."
        )

    # 2. Generate unique institutional tenant UUID
    new_tenant_id = str(uuid.uuid4())

    # 3. Create Institutional School Profile
    school_profile = SchoolProfile(
        tenant_id=new_tenant_id,
        school_name=payload.school_name.strip(),
        address=payload.address.strip(),
        contact_phone=payload.contact_phone.strip(),
        contact_email=payload.admin_email.lower().strip(),
        academic_year="2026"
    )
    db.add(school_profile)

    # 4. Create Root Administrator User
    parts = payload.admin_name.strip().split(" ", 1)
    first_name = parts[0]
    last_name = parts[1] if len(parts) > 1 else ""

    admin_user = User(
        tenant_id=new_tenant_id,
        email=payload.admin_email.lower().strip(),
        password_hash=get_password_hash(payload.admin_password),
        first_name=first_name,
        last_name=last_name,
        role="admin",
        is_active=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # 5. Issue Token for immediate login
    token = create_access_token(data={
        "sub": str(admin_user.id),
        "tenant_id": new_tenant_id,
        "role": "admin"
    })

    return {
        "message": "Institution registered successfully",
        "access_token": token,
        "token_type": "bearer",
        "role": "admin",
        "name": f"{admin_user.first_name} {admin_user.last_name}".strip(),
        "tenant_id": new_tenant_id
    }


@router.post("/student", status_code=status.HTTP_200_OK)
def login_student(
    payload: StudentLoginPayload,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(
        Student.admission_number == payload.admission_number.strip()
    ).first()

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No student found with this Admission ID."
        )

    # Simple & Bulletproof Default Student Credential:
    # Birth Certificate No, Roll Number, or Standard Institutional PIN "123456"
    valid_passwords = [
        student.birth_certificate_no or "",
        f"KS{student.roll_number}" if student.roll_number else "",
        "123456", # Institutional default student pin
        "Student@2026"
    ]

    if payload.password.strip() not in [p for p in valid_passwords if p]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect student access PIN or password."
        )

    token = create_access_token(data={
        "sub": str(student.id),
        "tenant_id": student.tenant_id,
        "role": "student"
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "student",
        "name": f"{student.first_name} {student.last_name}",
        "tenant_id": student.tenant_id,
        "student_id": str(student.id)
    }