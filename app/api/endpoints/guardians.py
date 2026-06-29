from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User
from app.models.users import Guardian, Student, StudentGuardian
from app.schemas.guardian import GuardianCreate, GuardianResponse, StudentGuardianLink

# --- The Magic Middleware ---
from app.api.deps import get_current_tenant_id

router = APIRouter()

@router.post("/", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
def create_guardian(
    guardian_in: GuardianCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Create a Guardian profile along with their User login account.
    """
    # 1. Check if email already exists
    existing_user = db.query(User).filter(User.email == guardian_in.email, User.tenant_id == tenant_id).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered in this school.")

    # 2. Create User account
    new_user = User(
        email=guardian_in.email,
        password_hash=get_password_hash(guardian_in.password),
        tenant_id=tenant_id
    )
    db.add(new_user)
    db.flush() 

    # 3. Create Guardian Profile
    new_guardian = Guardian(
        tenant_id=tenant_id,
        user_id=new_user.id,
        first_name=guardian_in.first_name,
        last_name=guardian_in.last_name
    )
    db.add(new_guardian)
    
    db.commit()
    db.refresh(new_guardian)
    return new_guardian


@router.post("/{guardian_id}/link-student/{student_id}", status_code=status.HTTP_201_CREATED)
def link_guardian_to_student(
    guardian_id: UUID,
    student_id: UUID,
    link_in: StudentGuardianLink,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Link a Guardian to a Student (e.g., declare as Father or Mother).
    """
    # 1. Verify Guardian exists and belongs to the same school
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id, Guardian.tenant_id == tenant_id).first()
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found in this school.")
        
    # 2. Verify Student exists and belongs to the same school
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tenant_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school.")

    # 3. Check if link already exists
    existing_link = db.query(StudentGuardian).filter(
        StudentGuardian.guardian_id == guardian_id, 
        StudentGuardian.student_id == student_id
    ).first()
    
    if existing_link:
        raise HTTPException(status_code=400, detail="This guardian is already linked to this student.")

    # 4. Create the Link (Junction Table record)
    new_link = StudentGuardian(
        tenant_id=tenant_id,
        guardian_id=guardian_id,
        student_id=student_id,
        relationship_type=link_in.relationship_type,
        is_primary=link_in.is_primary
    )
    
    db.add(new_link)
    db.commit()
    
    return {"status": "success", "message": f"Successfully linked {guardian.first_name} as {link_in.relationship_type} of {student.first_name}"}