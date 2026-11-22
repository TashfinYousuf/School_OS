from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import uuid

from app.api.deps import get_db, get_current_tenant_id, get_current_user_claims, require_roles
from app.models.result import StudentResult
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink

router = APIRouter()

class MarkEntryItem(BaseModel):
    student_id: uuid.UUID
    marks_obtained: float = Field(..., ge=0.0, le=100.0)
    remarks: Optional[str] = None

class BulkMarksPayload(BaseModel):
    exam_term: str
    class_name: str
    subject: str
    grading_policy_version: Optional[str] = "nctb_v2026"
    entries: List[MarkEntryItem]

class PublishResultsPayload(BaseModel):
    exam_term: str
    class_name: Optional[str] = None


def calculate_nctb_grade_decimal(marks: float) -> tuple[str, Decimal]:
    """
    Deterministic NCTB grading calculation using Decimal precision.
    A+ (80-100): 5.00
    A  (70-79):  4.00
    A- (60-69):  3.50
    B  (50-59):  3.00
    C  (40-49):  2.00
    D  (33-39):  1.00
    F  (0-32):   0.00
    """
    if marks >= 80:
        return "A+", Decimal("5.00")
    elif marks >= 70:
        return "A", Decimal("4.00")
    elif marks >= 60:
        return "A-", Decimal("3.50")
    elif marks >= 50:
        return "B", Decimal("3.00")
    elif marks >= 40:
        return "C", Decimal("2.00")
    elif marks >= 33:
        return "D", Decimal("1.00")
    else:
        return "F", Decimal("0.00")


@router.post("/bulk-submit")
def submit_class_marks(
    payload: BulkMarksPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Saves subject marks for an entire class and auto-computes NCTB grades.
    Blocks modifications if results have already been published.
    """
    tid = str(tenant_id)
    policy_ver = payload.grading_policy_version or "nctb_v2026"

    # Pre-flight check: verify no locked/published results for this subject/term
    published_check = db.query(StudentResult).filter(
        StudentResult.tenant_id == tid,
        StudentResult.exam_term == payload.exam_term,
        StudentResult.class_name == payload.class_name,
        StudentResult.subject == payload.subject,
        StudentResult.is_published == True
    ).first()

    if published_check:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Modifications locked: These results are already PUBLISHED. Correction approval required."
        )

    for entry in payload.entries:
        grade, gpa = calculate_nctb_grade_decimal(entry.marks_obtained)
        gpa_float = float(gpa)
        
        existing = db.query(StudentResult).filter(
            StudentResult.tenant_id == tid,
            StudentResult.student_id == entry.student_id,
            StudentResult.exam_term == payload.exam_term,
            StudentResult.subject == payload.subject
        ).first()

        if existing:
            existing.marks_obtained = entry.marks_obtained
            existing.grade = grade
            existing.grade_point = gpa_float
            existing.grading_policy_version = policy_ver
            existing.remarks = entry.remarks
        else:
            new_res = StudentResult(
                tenant_id=tid,
                student_id=entry.student_id,
                exam_term=payload.exam_term,
                class_name=payload.class_name,
                subject=payload.subject,
                marks_obtained=entry.marks_obtained,
                grade=grade,
                grade_point=gpa_float,
                grading_policy_version=policy_ver,
                is_published=False,
                remarks=entry.remarks
            )
            db.add(new_res)

    db.commit()
    return {"message": "Marks recorded and grades calculated successfully with policy version " + policy_ver}


@router.post("/publish")
def publish_exam_results(
    payload: PublishResultsPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Locks and officially publishes results for an entire term and optional class.
    """
    tid = str(tenant_id)
    query = db.query(StudentResult).filter(
        StudentResult.tenant_id == tid,
        StudentResult.exam_term == payload.exam_term
    )
    if payload.class_name:
        query = query.filter(StudentResult.class_name == payload.class_name)

    now = datetime.now(timezone.utc)
    updated_count = query.update(
        {"is_published": True, "published_at": now},
        synchronize_session="fetch"
    )
    db.commit()

    return {
        "message": f"Successfully published {updated_count} student result records for term '{payload.exam_term}'.",
        "published_count": updated_count,
        "published_at": now.isoformat()
    }


@router.get("/progress-card/{student_id}")
def get_student_progress_card(
    student_id: uuid.UUID,
    exam_term: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Generates data for printing official A4 Academic Progress Report Card.
    Enforces authorization:
    - Students can only view their own progress card.
    - Guardians can only view their linked children.
    - Teachers and Admins can view any student in the tenant.
    """
    tid = str(tenant_id)
    role = (claims.get("role") or "").lower()
    user_id = claims.get("user_id")

    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        req_uuid = uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        req_uuid = None

    # BOLA / Authorization Check
    if role == "student":
        owns_student = bool(
            req_uuid and (
                student.user_id == req_uuid
                or (student.user_id is None and student.id == req_uuid)
            )
        )
        if not owns_student:
            raise HTTPException(status_code=403, detail="Forbidden: You can only view your own report card.")
    elif role == "guardian":
        if not req_uuid:
            raise HTTPException(status_code=403, detail="Forbidden: Guardian identity invalid.")
        guardian = db.query(Guardian).filter(
            (Guardian.id == req_uuid) | (Guardian.user_id == req_uuid),
            Guardian.tenant_id == tid
        ).first()
        if not guardian:
            raise HTTPException(status_code=403, detail="Forbidden: Guardian profile not found.")
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.tenant_id == tid,
            GuardianStudentLink.guardian_id == guardian.id,
            GuardianStudentLink.student_id == student.id,
            GuardianStudentLink.verification_status == "VERIFIED",
        ).first()
        if not link:
            raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this student's report card.")
    elif role not in ("admin", "teacher", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions to view progress card.")

    query = db.query(StudentResult).filter(
        StudentResult.tenant_id == tid,
        StudentResult.student_id == student_id,
        StudentResult.exam_term == exam_term
    )

    # For students and guardians, only show PUBLISHED results
    if role in ("student", "guardian"):
        query = query.filter(StudentResult.is_published == True)

    results = query.all()

    total_marks = sum(r.marks_obtained for r in results)
    has_failed_subject = any(r.grade == "F" for r in results)

    if not results:
        overall_gpa = Decimal("0.00")
        final_grade = "N/A"
        evaluation_status = "PENDING"
    elif has_failed_subject:
        # Standard NCTB rule: Failing any subject fails the entire exam with GPA 0.00
        overall_gpa = Decimal("0.00")
        final_grade = "F"
        evaluation_status = "FAILED"
    else:
        gpa_sum = sum(Decimal(str(r.grade_point)) for r in results)
        raw_avg = gpa_sum / Decimal(len(results))
        overall_gpa = raw_avg.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        
        # Determine overall grade
        if overall_gpa >= Decimal("5.00"):
            final_grade = "A+"
        elif overall_gpa >= Decimal("4.00"):
            final_grade = "A"
        elif overall_gpa >= Decimal("3.50"):
            final_grade = "A-"
        elif overall_gpa >= Decimal("3.00"):
            final_grade = "B"
        elif overall_gpa >= Decimal("2.00"):
            final_grade = "C"
        elif overall_gpa >= Decimal("1.00"):
            final_grade = "D"
        else:
            final_grade = "F"
        evaluation_status = "PASSED"

    return {
        "student": {
            "id": str(student.id),
            "name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number,
            "roll_number": student.roll_number,
            "class_name": student.class_name
        },
        "exam_term": exam_term,
        "evaluation_status": evaluation_status,
        "results": [
            {
                "subject": r.subject,
                "marks_obtained": r.marks_obtained,
                "highest_marks": r.highest_marks,
                "grade": r.grade,
                "grade_point": r.grade_point,
                "grading_policy_version": r.grading_policy_version,
                "is_published": r.is_published
            }
            for r in results
        ],
        "total_marks": total_marks,
        "gpa": float(overall_gpa),
        "final_grade": final_grade,
    }
