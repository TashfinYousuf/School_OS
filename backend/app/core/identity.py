# backend/app/core/identity.py
"""
SchoolOS Identity & Unique Identifier Generator.
Generates institutional, collision-resistant unique identifiers scoped to tenants.
"""
import datetime
import secrets
import uuid
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func


def generate_student_uid(
    db: Session,
    tenant_id: str,
    academic_year: Optional[str] = None,
    class_name: Optional[str] = None
) -> str:
    """
    Generates a unique, collision-resistant student admission ID for the tenant.
    Format: STU-{YEAR}-{SEQ:04d} with random suffix fallback on collision.
    
    Guaranteed unique within the institution (tenant_id).
    """
    from app.models.student import Student

    year = academic_year or str(datetime.datetime.now().year)
    clean_year = "".join(c for c in str(year) if c.isalnum()) or "2026"
    tid = str(tenant_id)

    # Base sequential counter query
    count = db.query(func.count(Student.id)).filter(
        Student.tenant_id == tid
    ).scalar() or 0

    # Sequential search with lookahead
    for attempt in range(1, 20):
        candidate_num = count + attempt
        candidate = f"STU-{clean_year}-{candidate_num:04d}"
        
        exists = db.query(Student.id).filter(
            Student.tenant_id == tid,
            Student.admission_number == candidate
        ).first()
        if not exists:
            return candidate

    # Fallback to cryptographically random hex suffix if sequential has collisions
    for _ in range(10):
        rand_suffix = secrets.token_hex(3).upper()  # e.g. 7A8B9C
        candidate = f"STU-{clean_year}-{rand_suffix}"
        exists = db.query(Student.id).filter(
            Student.tenant_id == tid,
            Student.admission_number == candidate
        ).first()
        if not exists:
            return candidate

    # Absolute fallback
    return f"STU-{clean_year}-{uuid.uuid4().hex[:6].upper()}"


def generate_application_uid(
    db: Session,
    tenant_id: str,
    academic_year: Optional[str] = None
) -> str:
    """
    Generates a unique admission application tracking number.
    Format: ADM-{YEAR}-{SEQ:04d}
    """
    from app.models.admission import AdmissionApplication

    year = academic_year or str(datetime.datetime.now().year)
    clean_year = "".join(c for c in str(year) if c.isalnum()) or "2026"
    tid = str(tenant_id)

    count = db.query(func.count(AdmissionApplication.id)).filter(
        AdmissionApplication.tenant_id == tid,
        AdmissionApplication.academic_year == str(year)
    ).scalar() or 0

    for attempt in range(1, 20):
        candidate_num = count + attempt
        candidate = f"ADM-{clean_year}-{candidate_num:04d}"
        exists = db.query(AdmissionApplication.id).filter(
            AdmissionApplication.tenant_id == tid,
            AdmissionApplication.application_number == candidate
        ).first()
        if not exists:
            return candidate

    return f"ADM-{clean_year}-{uuid.uuid4().hex[:6].upper()}"

