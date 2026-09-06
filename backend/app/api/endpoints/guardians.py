from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.student import Student
from app.schemas.guardian import GuardianCreate, GuardianResponse, StudentGuardianLink
from app.api.deps import get_current_tenant_id, require_roles

router = APIRouter()

# Schema for Directory View
class GuardianDirectoryItem(BaseModel):
    id: UUID
    guardian_name: str
    phone_number: str
    relationship: str
    profession: Optional[str] = None
    student_name: str
    class_name: Optional[str] = None
    roll_number: Optional[str] = None
    admission_number: str


@router.post("/", response_model=GuardianResponse, status_code=status.HTTP_201_CREATED)
def create_guardian(
    guardian_in: GuardianCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    """
    Create a Guardian profile along with their User login credentials.
    """
    # 1. Check if email already exists
    existing_user = db.query(User).filter(
        User.email == guardian_in.email, 
        User.tenant_id == str(tenant_id)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered in this school.")

    # 2. Create User account
    new_user = User(
        email=guardian_in.email,
        password_hash=get_password_hash(guardian_in.password),
        tenant_id=str(tenant_id)
    )
    db.add(new_user)
    db.flush() 

    # 3. Create Guardian Profile
    phone = getattr(guardian_in, "phone_number", None) or "N/A"
    new_guardian = Guardian(
        tenant_id=str(tenant_id),
        user_id=new_user.id,
        first_name=guardian_in.first_name,
        last_name=guardian_in.last_name or "",
        email=guardian_in.email,
        phone_number=phone,
        profession=getattr(guardian_in, "profession", None),
        nid_number=getattr(guardian_in, "nid_number", None)
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
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    """
    Link a Guardian to a Student (Father, Mother, Legal Guardian).
    """
    guardian = db.query(Guardian).filter(Guardian.id == guardian_id, Guardian.tenant_id == str(tenant_id)).first()
    if not guardian:
        raise HTTPException(status_code=404, detail="Guardian not found in this school.")
        
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == str(tenant_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found in this school.")

    existing_link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian_id, 
        GuardianStudentLink.student_id == student_id
    ).first()
    
    if existing_link:
        raise HTTPException(status_code=400, detail="This guardian is already linked to this student.")

    rel_type = GuardianRelationship.FATHER
    try:
        rel_type = GuardianRelationship(link_in.relationship_type)
    except (ValueError, KeyError):
        pass

    new_link = GuardianStudentLink(
        tenant_id=str(tenant_id),
        guardian_id=guardian_id,
        student_id=student_id,
        relationship_type=rel_type,
        is_primary_contact="Yes" if link_in.is_primary else "No"
    )
    
    db.add(new_link)
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Successfully linked {guardian.first_name} as {link_in.relationship_type} of {student.first_name}"
    }


@router.get("/directory", response_model=List[GuardianDirectoryItem])
def get_guardian_directory(
    class_name: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Real phonebook query linking guardians with their enrolled children for the WhatsApp Hub.
    """
    query = db.query(Guardian, GuardianStudentLink, Student).join(
        GuardianStudentLink, Guardian.id == GuardianStudentLink.guardian_id
    ).join(
        Student, Student.id == GuardianStudentLink.student_id
    ).filter(
        Guardian.tenant_id == str(tenant_id),
        Student.status == "Active"
    )

    if class_name:
        query = query.filter(Student.class_name == class_name)
    if search:
        query = query.filter(
            (Guardian.first_name.ilike(f"%{search}%")) |
            (Guardian.last_name.ilike(f"%{search}%")) |
            (Guardian.phone_number.ilike(f"%{search}%")) |
            (Student.first_name.ilike(f"%{search}%")) |
            (Student.admission_number.ilike(f"%{search}%"))
        )

    records = query.order_by(Student.roll_number.asc()).all()

    return [
        {
            "id": g.id,
            "guardian_name": f"{g.first_name} {g.last_name}",
            "phone_number": g.phone_number,
            "relationship": link.relationship_type.value,
            "profession": g.profession,
            "student_name": f"{s.first_name} {s.last_name}",
            "class_name": s.class_name,
            "roll_number": s.roll_number,
            "admission_number": s.admission_number
        }
        for g, link, s in records
    ]