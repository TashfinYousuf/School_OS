from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.academic import ClassModel, Subject, AcademicSession
from app.schemas.academic import (
    ClassCreate, ClassResponse, 
    SubjectCreate, SubjectResponse,
    AcademicSessionCreate, AcademicSessionResponse
)

# --- The Magic Middleware ---
from app.api.deps import get_current_tenant_id

router = APIRouter()

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
    Create a new Academic Session (e.g., "2026") for the school.
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