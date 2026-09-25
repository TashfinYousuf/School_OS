from typing import List, Optional
import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.models.finance import FeePayment
from app.schemas.student import (
    StudentBulkImportRequest,
    StudentBulkImportResponse
)

router = APIRouter()

# --- Schemas ---
class GuardianInput(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    relationship_type: GuardianRelationship = GuardianRelationship.FATHER
    profession: Optional[str] = None
    nid_number: Optional[str] = None

class StudentAdmissionPayload(BaseModel):
    first_name: str
    last_name: str
    admission_number: str
    class_name: str
    section: Optional[str] = "A"
    roll_number: Optional[str] = None
    gender: Optional[str] = "Male"
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    guardian: GuardianInput

class StudentListItem(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    admission_number: str
    class_name: Optional[str]
    roll_number: Optional[str]
    guardian_name: Optional[str]
    guardian_phone: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class StudentUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    status: Optional[str] = None

# --- Endpoints ---

@router.get("/", response_model=List[StudentListItem])
def list_students(
    class_name: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    query = db.query(Student).filter(Student.tenant_id == str(tenant_id), Student.status == "Active")

    if class_name:
        query = query.filter(Student.class_name == class_name)
    if search:
        search_filter = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Student.first_name.ilike(search_filter),
                Student.last_name.ilike(search_filter),
                Student.admission_number.ilike(search_filter)
            )
        )

    students = query.order_by(Student.roll_number.asc(), Student.admission_number.asc()).all()

    response = []
    for s in students:
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.student_id == s.id,
            GuardianStudentLink.tenant_id == str(tenant_id)
        ).first()
        
        guardian_name = None
        guardian_phone = None
        if link:
            g = db.query(Guardian).filter(Guardian.id == link.guardian_id).first()
            if g:
                guardian_name = f"{g.first_name} {g.last_name} ({link.relationship_type.value})"
                guardian_phone = g.phone_number

        response.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "admission_number": s.admission_number,
            "class_name": s.class_name,
            "roll_number": s.roll_number,
            "guardian_name": guardian_name,
            "guardian_phone": guardian_phone,
            "status": s.status,
            "created_at": s.created_at
        })
    return response

@router.post("/admit", status_code=status.HTTP_201_CREATED)
def admit_student(
    payload: StudentAdmissionPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    existing_student = db.query(Student).filter(
        Student.tenant_id == str(tenant_id),
        Student.admission_number == payload.admission_number.strip()
    ).first()
    if existing_student:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Admission ID '{payload.admission_number}' already exists in this institution."
        )

    # 1. Guardian Handling
    clean_phone = payload.guardian.phone_number.strip()
    guardian = db.query(Guardian).filter(
        Guardian.tenant_id == str(tenant_id),
        Guardian.phone_number == clean_phone
    ).first()

    if not guardian:
        guardian = Guardian(
            tenant_id=str(tenant_id),
            first_name=payload.guardian.first_name,
            last_name=payload.guardian.last_name,
            phone_number=clean_phone,
            profession=payload.guardian.profession,
            nid_number=payload.guardian.nid_number
        )
        db.add(guardian)
        db.flush()

    # 2. Student Handling
    student = Student(
        tenant_id=str(tenant_id),
        first_name=payload.first_name,
        last_name=payload.last_name,
        admission_number=payload.admission_number.strip(),
        class_name=payload.class_name,
        section=payload.section,
        roll_number=payload.roll_number,
        gender=payload.gender,
        date_of_birth=payload.date_of_birth,
        blood_group=payload.blood_group,
        birth_certificate_no=payload.birth_certificate_no,
        status="Active"
    )
    db.add(student)
    db.flush()

    # 3. Linkage
    link = GuardianStudentLink(
        tenant_id=str(tenant_id),
        guardian_id=guardian.id,
        student_id=student.id,
        relationship_type=payload.guardian.relationship_type,
        is_primary_contact="Yes"
    )
    db.add(link)
    db.commit()

    return {
        "message": "Student admitted successfully",
        "student_id": student.id,
        "admission_number": student.admission_number,
        "guardian_linked": f"{guardian.first_name} {guardian.last_name}"
    }

@router.post("/bulk-import", response_model=StudentBulkImportResponse, status_code=status.HTTP_201_CREATED)
def bulk_import_students(
    payload: StudentBulkImportRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    imported_count = 0
    skipped_count = 0
    errors = []

    for item in payload.students:
        adm = item.admission_number.strip()
        existing = db.query(Student).filter(
            Student.tenant_id == str(tenant_id),
            Student.admission_number == adm
        ).first()

        if existing:
            skipped_count += 1
            errors.append(f"Admission ID '{adm}' already registered (Skipped).")
            continue

        student = Student(tenant_id=str(tenant_id), **item.model_dump())
        db.add(student)
        imported_count += 1

    db.commit()
    return StudentBulkImportResponse(
        total_submitted=len(payload.students),
        imported_count=imported_count,
        skipped_count=skipped_count,
        errors=errors
    )

@router.patch("/{student_id}")
def update_student(
    student_id: uuid.UUID,
    payload: StudentUpdatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == str(tenant_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)
        
    db.commit()
    db.refresh(student)
    return {"message": "Student updated successfully", "student": student}

@router.delete("/{student_id}")
def delete_student(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == str(tenant_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    db.delete(student)
    db.commit()
    return {"message": f"Student {student.admission_number} removed successfully"}

@router.get("/{student_id}/profile-360")
def get_student_360_profile(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "guardian"]))
):
    student = db.query(Student).filter(
        Student.id == student_id, 
        Student.tenant_id == str(tenant_id)
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    # 1. Primary Guardian
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.student_id == student.id,
        GuardianStudentLink.tenant_id == str(tenant_id)
    ).first()
    guardian = db.query(Guardian).filter(Guardian.id == link.guardian_id).first() if link else None

    # 2. Attendance Stats (Native UUID Match)
    total_days = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.student_id == student.id
    ).count()
    
    present_days = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.student_id == student.id,
        AttendanceEvent.status == "Present"
    ).count()
    
    attendance_rate = round((present_days / total_days * 100), 1) if total_days > 0 else 100.0

    # 3. Fee Payments Ledger (Safe Column Fallback)
    date_col = getattr(FeePayment, "payment_date", getattr(FeePayment, "created_at", FeePayment.id))

    payments = db.query(FeePayment).filter(
        FeePayment.tenant_id == str(tenant_id),
        FeePayment.student_id == student.id
    ).order_by(date_col.desc()).limit(5).all()

    # 🚀 FIX: Correct Serialization (No AttributeError on p.fee_records)
    fee_records = []
    for p in payments:
        raw_date = getattr(p, "payment_date", getattr(p, "created_at", None))
        formatted_date = raw_date.strftime("%d %b, %Y") if raw_date else "—"
        
        fee_records.append({
            "receipt_no": p.receipt_no,
            "fee_type": p.fee_type,
            "month": p.billing_month,
            "amount": p.amount_paid,
            "date": formatted_date
        })

    # 4. Academic Grades
    results = db.query(StudentResult).filter(
        StudentResult.tenant_id == str(tenant_id),
        StudentResult.student_id == student.id
    ).all()

    avg_gpa = (sum(r.grade_point for r in results) / len(results)) if results else 0.0

    return {
        "student": {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number,
            "class_name": student.class_name,
            "roll_number": student.roll_number or "—",
            "gender": student.gender or "N/A",
            "blood_group": student.blood_group or "N/A",
            "birth_certificate_no": student.birth_certificate_no or "N/A",
            "status": student.status,
            "joined_at": student.created_at.strftime("%d %b, %Y") if student.created_at else "—"
        },
        "guardian": {
            "name": f"{guardian.first_name} {guardian.last_name}" if guardian else "Not Linked",
            "phone": guardian.phone_number if guardian else "N/A",
            "relationship": link.relationship_type.value if link else "Guardian",
            "profession": getattr(guardian, "profession", "Guardian") if guardian else "N/A"
        },
        "attendance": {
            "total_working_days": total_days,
            "present_days": present_days,
            "attendance_rate": attendance_rate
        },
        "fees": fee_records, # 🚀 FIX: cleanly mapped array
        "academics": {
            "average_gpa": round(avg_gpa, 2),
            "subjects_evaluated": len(results),
            "grades": [
                {
                    "subject": r.subject,
                    "marks": r.marks_obtained,
                    "grade": r.grade,
                    "term": r.exam_term
                }
                for r in results
            ]
        }
    }