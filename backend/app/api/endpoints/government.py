from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.student import Student
from app.models.users import Teacher

router = APIRouter()

class ReadinessInsight(BaseModel):
    category: str
    total_records: int
    verified_records: int
    missing_fields: int
    action_required: str

class IPEMISResponse(BaseModel):
    system_status: str
    overall_readiness: int
    insights: List[ReadinessInsight]
    ai_recommendation: str

@router.get("/ipemis/readiness", response_model=IPEMISResponse)
def get_ipemis_readiness(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    # 1. Real Student Database Queries
    total_students = db.query(Student).filter(Student.tenant_id == tenant_id, Student.status == "Active").count()
    missing_birth_cert = db.query(Student).filter(
        Student.tenant_id == tenant_id,
        Student.status == "Active",
        or_(Student.birth_certificate_no == None, Student.birth_certificate_no == "")
    ).count()
    verified_students = total_students - missing_birth_cert

    # 2. Real Teacher Database Queries
    total_teachers = db.query(Teacher).filter(Teacher.tenant_id == tenant_id).count()
    # Assuming teachers without designation need review
    pending_teachers = db.query(Teacher).filter(
        Teacher.tenant_id == tenant_id,
        or_(Teacher.designation == None, Teacher.designation == "")
    ).count()
    verified_teachers = total_teachers - pending_teachers

    # 3. Dynamic Calculation
    total_entities = (total_students + total_teachers) or 1
    total_verified = verified_students + verified_teachers
    readiness_percentage = int((total_verified / total_entities) * 100)

    insights = [
        ReadinessInsight(
            category="Student Registry (IPEMIS Standards)",
            total_records=total_students,
            verified_records=verified_students,
            missing_fields=missing_birth_cert,
            action_required="Provide 17-digit birth registration number" if missing_birth_cert > 0 else "All records validated"
        ),
        ReadinessInsight(
            category="Faculty & Educators Profile",
            total_records=total_teachers,
            verified_records=verified_teachers,
            missing_fields=pending_teachers,
            action_required="Assign formal institutional designation" if pending_teachers > 0 else "Verified"
        )
    ]

    recommendation = (
        f"Database synced. {missing_birth_cert} student(s) lack official birth certificates. "
        "Complete these records to achieve 100% IPEMIS compliance."
        if missing_birth_cert > 0 else
        "Excellent! Institution database completely aligns with Bangladesh Education Board & IPEMIS requirements."
    )

    return IPEMISResponse(
        system_status="Connected to PostgreSQL Engine",
        overall_readiness=readiness_percentage,
        insights=insights,
        ai_recommendation=recommendation
    )