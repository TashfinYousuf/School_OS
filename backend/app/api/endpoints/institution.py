import csv
import io
import uuid
import datetime

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, EmailStr

from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.tenant import SchoolProfile, Tenant
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.schemas.institution import InstitutionProfile
from app.services.institution import DEFAULT_NAME, get_institution_profile, invalidate_institution_cache

router = APIRouter()

class SchoolProfileOut(BaseModel):
    tenant_id: str
    school_name: str
    name: str                          # school_name er alias, InstitutionProvider eta pore
    tagline: Optional[str] = None
    eiin_or_code: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    academic_year: Optional[str] = None
    school_code: Optional[str] = None
    logo_url: Optional[str] = None


class ProfileUpdatePayload(BaseModel):
    school_name: Optional[str] = Field(None, min_length=2, max_length=120)
    tagline: Optional[str] = Field(None, max_length=160)
    eiin_or_code: Optional[str] = Field(None, max_length=32)
    address: Optional[str] = Field(None, max_length=255)
    contact_phone: Optional[str] = Field(None, max_length=20)
    contact_email: Optional[EmailStr] = None
    academic_year: Optional[str] = Field(None, pattern=r"^\d{4}(-\d{4})?$")

def _out(p: InstitutionProfile) -> SchoolProfileOut:
    return SchoolProfileOut(
        tenant_id=p.tenant_id, school_name=p.name, name=p.name, tagline=p.tagline,
        eiin_or_code=p.eiin_or_code, address=p.address, contact_phone=p.phone,
        contact_email=p.email, academic_year=p.academic_year,
        school_code=p.school_code, logo_url=p.logo_url,
    )


@router.get("/profile", response_model=SchoolProfileOut)
def get_school_profile(
    response: Response,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),    # require_roles ENTE deliberately nei: student o guardian nijer school er nam dekhbe
):
    response.headers["Cache-Control"] = "no-store"
    return _out(get_institution_profile(db, tenant_id))  # read-only, kono row toiri hoy na


@router.patch("/profile")
def update_school_profile(
    payload: ProfileUpdatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    tid = str(tenant_id)
    # None field gulo ignore hoy. Clear korte "" pathao
    data = {k: (v.strip() if isinstance(v, str) else v)
            for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update.")

    profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == tid).first()
    if profile is None:
        profile = SchoolProfile(
            tenant_id=tid, school_name=data.get("school_name") or DEFAULT_NAME,
            address="", contact_phone="", contact_email="",
            academic_year=str(datetime.date.today().year),
        )
        db.add(profile)

    for field, value in data.items():
        setattr(profile, field, value)

    if "school_name" in data:                    # tenants.school_name o ek transaction e sync
        try:
            tenant = db.query(Tenant).filter(Tenant.id == uuid.UUID(tid)).first()
        except ValueError:
            tenant = None
        if tenant is not None and hasattr(tenant, "school_name"):
            tenant.school_name = data["school_name"]

    db.commit()
    invalidate_institution_cache(tid)            # na korle 60 sec purono nam dekhabe
    return {"message": "Institutional profile updated", "profile": _out(get_institution_profile(db, tid))}


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
            verification_status="VERIFIED",
            verification_method="ADMIN_CSV_IMPORT",
            is_primary_contact=True
        )
        db.add(link)
        imported_count += 1

    db.commit()
    return {
        "message": "Migration completed successfully",
        "imported_records": imported_count,
        "duplicates_skipped": skipped_duplicates
    }