import csv
import io
import uuid

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.tenant import SchoolProfile
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship

router = APIRouter()

class ProfileUpdatePayload(BaseModel):
    school_name: str
    tagline: Optional[str] = None
    eiin_or_code: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    academic_year: Optional[str] = "2027"

@router.get("/profile")
def get_school_profile(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    if not profile:
        # Default initialization for tenant
        profile = SchoolProfile(
            tenant_id=str(tenant_id),
            school_name="Kids Shine International School",
            tagline="Towards a Bright Future",
            eiin_or_code="KS-091",
            address="Kandirpar, Cumilla, Bangladesh",
            academic_year="2027"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile

@router.patch("/profile")
def update_school_profile(
    payload: ProfileUpdatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    if not profile:
        profile = SchoolProfile(tenant_id=str(tenant_id))
        db.add(profile)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return {"message": "Institutional profile updated", "profile": profile}

@router.post("/import-students-csv", status_code=status.HTTP_201_CREATED)
async def bulk_import_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    """
    Parses an uploaded CSV file containing rows:
    first_name, last_name, admission_number, class_name, roll_number, guardian_name, guardian_phone
    and executes an atomic batch ingestion with smart guardian linkage.
    """
    if not file.filename.endswith(('.csv', '.txt')):
        raise HTTPException(status_code=400, detail="Only CSV formatted spreadsheets are supported.")

    content = await file.read()
    try:
        decoded = content.decode('utf-8-sig')
    except UnicodeDecodeError:
        decoded = content.decode('latin-1')

    reader = csv.DictReader(io.StringIO(decoded))
    
    # Required CSV Columns Validation
    required_cols = {"first_name", "last_name", "admission_number", "class_name", "guardian_phone"}
    if not required_cols.issubset(set(reader.fieldnames or [])):
        raise HTTPException(
            status_code=400, 
            detail=f"CSV missing mandatory columns: {required_cols - set(reader.fieldnames or [])}"
        )

    imported_count = 0
    skipped_duplicates = 0

    for row in reader:
        adm_no = row["admission_number"].strip()
        if not adm_no:
            continue

        # Duplicate admission number check
        exists = db.query(Student).filter(
            Student.tenant_id == str(tenant_id),
            Student.admission_number == adm_no
        ).first()

        if exists:
            skipped_duplicates += 1
            continue

        phone = row.get("guardian_phone", "").strip() or "017XXXXXXXX"
        guardian_full_name = row.get("guardian_name", "").strip() or "Guardian"
        parts = guardian_full_name.split(" ", 1)
        g_first = parts[0]
        g_last = parts[1] if len(parts) > 1 else ""

        # Find or create Guardian by phone
        guardian = db.query(Guardian).filter(
            Guardian.tenant_id == str(tenant_id),
            Guardian.phone_number == phone
        ).first()

        if not guardian:
            guardian = Guardian(
                tenant_id=str(tenant_id),
                first_name=g_first,
                last_name=g_last,
                phone_number=phone
            )
            db.add(guardian)
            db.flush()

        student = Student(
            tenant_id=str(tenant_id),
            first_name=row["first_name"].strip(),
            last_name=row["last_name"].strip(),
            admission_number=adm_no,
            class_name=row.get("class_name", "Play").strip(),
            roll_number=row.get("roll_number", "").strip() or None,
            status="Active"
        )
        db.add(student)
        db.flush()

        link = GuardianStudentLink(
            tenant_id=str(tenant_id),
            guardian_id=guardian.id,
            student_id=student.id,
            relationship_type=GuardianRelationship.FATHER,
            is_primary_contact="Yes"
        )
        db.add(link)
        imported_count += 1

    db.commit()
    return {
        "message": "Migration completed successfully",
        "imported_records": imported_count,
        "duplicates_skipped": skipped_duplicates
    }