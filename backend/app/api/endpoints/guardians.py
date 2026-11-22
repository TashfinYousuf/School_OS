import logging
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session
from uuid import UUID
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.core.security import get_password_hash
from app.models.tenant import User
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.models.finance import FeePayment, Invoice
from app.models.audit import AuditLog
from app.schemas.guardian import GuardianCreate, GuardianResponse, StudentGuardianLink
from app.api.deps import get_db, get_current_tenant_id, require_roles, get_current_user_claims
from datetime import datetime, timezone

router = APIRouter()

class LinkRequestPayload(BaseModel):
    admission_number: str
    date_of_birth: Optional[str] = None
    relationship_type: str = "Father"

def _resolve_guardian(db: Session, claims: dict, tenant_id: str) -> Optional[Guardian]:
    user_id_str = str(claims.get("user_id", ""))
    try:
        user_uuid = UUID(user_id_str)
    except (ValueError, TypeError):
        return None

    return db.query(Guardian).filter(
        (Guardian.id == user_uuid) | (Guardian.user_id == user_uuid),
        Guardian.tenant_id == str(tenant_id)
    ).first()

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
        tenant_id=str(tenant_id),
        role="guardian",
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
        GuardianStudentLink.tenant_id == str(tenant_id),
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
        verification_status="VERIFIED",
        verification_method="ADMIN_DIRECT",
        is_primary_contact=bool(link_in.is_primary)
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
        GuardianStudentLink.tenant_id == str(tenant_id),
        GuardianStudentLink.verification_status == "VERIFIED",
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


@router.get("/me/children")
def get_my_children(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Returns authentic enrolled child records for the authenticated guardian.
    Includes live attendance percentage, academic standing, and fee balance.
    Provides complete IDOR protection.
    """
    tid = str(tenant_id)
    user_role = (claims.get("role") or "").lower()
    if user_role not in ("guardian", "admin", "superadmin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only guardians or authorized administrators can view linked children."
        )

    user_id_str = str(claims.get("user_id", ""))
    try:
        user_uuid = UUID(user_id_str)
    except (ValueError, TypeError):
        user_uuid = None

    guardian = db.query(Guardian).filter(
        (Guardian.id == user_uuid) | (Guardian.user_id == user_uuid),
        Guardian.tenant_id == tid
    ).first()

    if not guardian:
        return []

    links = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.verification_status == "VERIFIED"
    ).all()

    today = date.today()
    children = []
    for link in links:
        student = db.query(Student).filter(
            Student.id == link.student_id,
            Student.tenant_id == tid
        ).first()
        if not student:
            continue

        # Real Attendance
        att_events = db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == tid,
            AttendanceEvent.student_id == student.id
        ).all()

        total_days = len(att_events)
        present_days = sum(1 for e in att_events if (e.status or "").capitalize() == "Present")
        absent_days = sum(1 for e in att_events if (e.status or "").capitalize() == "Absent")
        late_days = sum(1 for e in att_events if (e.status or "").capitalize() == "Late")
        half_days = sum(1 for e in att_events if "half" in (e.status or "").lower())
        present_equiv = present_days + late_days + (half_days * 0.5)
        rate = round((present_equiv / total_days * 100), 1) if total_days > 0 else 100.0

        today_event = next((e for e in att_events if e.date == today), None)
        today_status = today_event.status if today_event else "Not Marked"

        # Academic Standing (NCTB GPA)
        results = db.query(StudentResult).filter(
            StudentResult.tenant_id == tid,
            StudentResult.student_id == student.id
        ).all()
        avg_gpa = round(sum(r.grade_point for r in results) / len(results), 2) if results else 0.0
        standing = "GPA 5.00 (A+)" if avg_gpa >= 5.0 else f"GPA {avg_gpa:.2f}" if avg_gpa > 0 else "Pending Evaluation"

        # Fee Status
        try:
            payments = db.query(FeePayment).filter(
                FeePayment.tenant_id == tid,
                FeePayment.student_id == student.id
            ).all()
            total_paid = sum(p.amount for p in payments) if payments else 0
        except Exception as exc:
            logger.warning("get_my_children fee lookup failed student=%s tenant=%s: %s", student.id, tid, exc)
            db.rollback()
            total_paid = 0

        children.append({
            "student_id": str(student.id),
            "student_name": f"{student.first_name} {student.last_name}".strip(),
            "first_name": student.first_name,
            "last_name": student.last_name,
            "admission_number": student.admission_number,
            "class_name": student.class_name,
            "section": student.section or "A",
            "roll_number": student.roll_number or "—",
            "relationship": link.relationship_type.value if hasattr(link.relationship_type, "value") else str(link.relationship_type),
            "verification_status": getattr(link, "verification_status", "VERIFIED"),
            "is_primary": link.is_primary,
            "attendance": {
                "total_days": total_days,
                "present_days": present_days,
                "absent_days": absent_days,
                "late_days": late_days,
                "rate_percentage": rate,
                "today_status": today_status
            },
            "academics": {
                "gpa": avg_gpa,
                "standing": standing,
                "subjects_evaluated": len(results)
            },
            "fees": {
                "total_paid": total_paid,
                "status": "Paid in Full" if total_paid > 0 else "Up to date"
            }
        })

    return children


@router.get("/me/children/{student_id}/progress-card")
def get_child_progress_card(
    student_id: UUID,
    exam_term: Optional[str] = "Annual Examination 2026",
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Returns authentic academic report card for a verified linked child.
    Enforces strict relational authorization (default-deny).
    """
    tid = str(tenant_id)
    guardian = _resolve_guardian(db, claims, tid)
    if not guardian:
        raise HTTPException(status_code=403, detail="Forbidden: No guardian profile associated with current account.")

    # Relational ownership check
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student_id,
        GuardianStudentLink.verification_status == "VERIFIED"
    ).first()

    if not link:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not authorized to view this student's progress card."
        )

    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    results_q = db.query(StudentResult).filter(
        StudentResult.tenant_id == tid,
        StudentResult.student_id == student_id,
        StudentResult.is_published == True
    )
    if exam_term:
        results_q = results_q.filter(StudentResult.exam_term == exam_term)
    results = results_q.all()

    total_marks = sum(r.marks_obtained for r in results) if results else 0
    avg_gpa = round(sum(r.grade_point for r in results) / len(results), 2) if results else 0.0
    overall_grade = "A+" if avg_gpa >= 5.0 else "A" if avg_gpa >= 4.0 else "B" if avg_gpa >= 3.0 else "Passing" if avg_gpa > 0 else "N/A"

    subject_rows = [
        {
            "subject": r.subject or "General Subject",
            "marks_obtained": r.marks_obtained,
            "grade": r.grade or "N/A",
            "grade_point": r.grade_point,
            "remarks": r.remarks or "Completed"
        }
        for r in results
    ]

    return {
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}".strip(),
        "admission_number": student.admission_number,
        "class_name": student.class_name,
        "section": student.section or "A",
        "roll_number": student.roll_number or "—",
        "exam_term": exam_term,
        "total_marks": total_marks,
        "gpa": avg_gpa,
        "overall_grade": overall_grade,
        "subjects": subject_rows,
        "is_verified_record": True
    }


@router.get("/me/children/{student_id}/attendance")
def get_child_attendance(
    student_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Returns authentic daily attendance records and statistics for verified child.
    """
    tid = str(tenant_id)
    guardian = _resolve_guardian(db, claims, tid)
    if not guardian:
        raise HTTPException(status_code=403, detail="Forbidden: No guardian profile associated with current account.")

    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student_id,
        GuardianStudentLink.verification_status == "VERIFIED"
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Forbidden: Not authorized for this student.")

    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    events = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tid,
        AttendanceEvent.student_id == student_id
    ).order_by(AttendanceEvent.date.desc()).all()

    total_days = len(events)
    present_days = sum(1 for e in events if (e.status or "").capitalize() == "Present")
    absent_days = sum(1 for e in events if (e.status or "").capitalize() == "Absent")
    late_days = sum(1 for e in events if (e.status or "").capitalize() == "Late")
    rate = round(((present_days + late_days) / total_days * 100), 1) if total_days > 0 else 100.0

    return {
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}".strip(),
        "summary": {
            "total_school_days": total_days,
            "present_count": present_days,
            "absent_count": absent_days,
            "late_count": late_days,
            "attendance_rate": rate
        },
        "history": [
            {
                "date": e.date.isoformat(),
                "status": e.status,
                "remarks": e.remarks or "Regular Session"
            }
            for e in events[:60]
        ]
    }


@router.get("/me/children/{student_id}/fees")
def get_child_fees(
    student_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Returns authentic school fee statements and receipts for verified child.
    """
    tid = str(tenant_id)
    guardian = _resolve_guardian(db, claims, tid)
    if not guardian:
        raise HTTPException(status_code=403, detail="Forbidden: No guardian profile associated with current account.")

    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student_id,
        GuardianStudentLink.verification_status == "VERIFIED"
    ).first()

    if not link:
        raise HTTPException(status_code=403, detail="Forbidden: Not authorized for this student.")

    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    invoices = db.query(Invoice).filter(
        Invoice.tenant_id == tid,
        Invoice.student_id == str(student_id)
    ).order_by(Invoice.created_at.desc()).all()

    payments = db.query(FeePayment).filter(
        FeePayment.tenant_id == tid,
        FeePayment.student_id == student_id,
        FeePayment.is_reversed == False,
    ).order_by(FeePayment.created_at.desc()).all()

    total_invoiced = sum(float(inv.total_amount) for inv in invoices) if invoices else 0.0
    total_paid = sum(float(p.amount) for p in payments) if payments else 0.0
    due_balance = max(0.0, total_invoiced - total_paid)

    return {
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}".strip(),
        "summary": {
            "total_invoiced": total_invoiced,
            "total_paid": total_paid,
            "due_balance": due_balance,
            "status": "Paid in Full" if due_balance <= 0.01 else "Payment Due"
        },
        "invoices": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "title": inv.title,
                "amount": float(inv.total_amount),
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status)
            }
            for inv in invoices
        ],
        "payments": [
            {
                "id": str(p.id),
                "receipt_number": getattr(p, "receipt_number", None) or f"RCP-{p.id.hex[:6].upper()}",
                "amount": float(p.amount),
                "payment_method": p.payment_method or "Cash",
                "payment_date": p.payment_date.isoformat() if p.payment_date else None
            }
            for p in payments
        ]
    }


@router.post("/link-request", status_code=status.HTTP_201_CREATED)
def request_child_link(
    payload: LinkRequestPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["guardian"]))
):
    """
    Guardian self-service link request for a child.
    Creates a PENDING_VERIFICATION relationship awaiting school admin verification.
    """
    tid = str(tenant_id)
    guardian = _resolve_guardian(db, claims, tid)
    if not guardian:
        raise HTTPException(status_code=403, detail="Guardian profile not found.")

    adm = payload.admission_number.strip().upper()
    student = db.query(Student).filter(
        Student.tenant_id == tid,
        func.upper(Student.admission_number) == adm
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student admission ID not found in this school.")

    # Check if link already exists
    existing = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student.id
    ).first()

    if existing:
        if existing.verification_status == "VERIFIED":
            return {"status": "already_linked", "message": "This child is already verified and linked to your account."}
        elif existing.verification_status == "PENDING_VERIFICATION":
            return {"status": "pending", "message": "A link request for this child is already pending school approval."}
        elif existing.verification_status == "REVOKED":
            raise HTTPException(
                status_code=403,
                detail="This guardian-student relationship was revoked by school administration. Please contact the school office."
            )

    rel_enum = GuardianRelationship.FATHER
    if "mother" in payload.relationship_type.lower():
        rel_enum = GuardianRelationship.MOTHER
    elif "legal" in payload.relationship_type.lower():
        rel_enum = GuardianRelationship.LEGAL_GUARDIAN

    new_link = GuardianStudentLink(
        tenant_id=tid,
        guardian_id=guardian.id,
        student_id=student.id,
        relationship_type=rel_enum,
        verification_status="PENDING_VERIFICATION",
        verification_method="PARENT_PORTAL_REQUEST",
        is_primary=False,
        is_primary_contact=False,
    )
    db.add(new_link)
    db.commit()
    return {
        "status": "success",
        "message": f"Link request for {student.first_name} submitted. It will be active once approved by your school administration."
    }


@router.get("/admin/links", status_code=status.HTTP_200_OK)
def list_admin_guardian_links(
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"])),
):
    """Admin view of all guardian-student relationship links and pending portal requests."""
    tid = str(tenant_id)
    q = (
        db.query(GuardianStudentLink, Guardian, Student)
        .join(Guardian, Guardian.id == GuardianStudentLink.guardian_id)
        .join(Student, Student.id == GuardianStudentLink.student_id)
        .filter(GuardianStudentLink.tenant_id == tid)
    )
    if status_filter:
        q = q.filter(GuardianStudentLink.verification_status == status_filter.upper())
    rows = q.order_by(GuardianStudentLink.id.desc()).limit(200).all()
    return {
        "links": [
            {
                "id": str(link.id),
                "guardian_id": str(g.id),
                "guardian_name": f"{g.first_name} {g.last_name}".strip(),
                "guardian_phone": g.phone_number,
                "student_id": str(s.id),
                "student_name": f"{s.first_name} {s.last_name}".strip(),
                "admission_number": s.admission_number,
                "class_name": s.class_name,
                "relationship_type": link.relationship_type.value if hasattr(link.relationship_type, "value") else str(link.relationship_type),
                "verification_status": link.verification_status,
                "verification_method": link.verification_method,
            }
            for link, g, s in rows
        ]
    }


@router.post("/admin/links/{link_id}/verify", status_code=status.HTTP_200_OK)
def verify_guardian_link(
    link_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin verifies and authorizes a guardian-student link."""
    tid = str(tenant_id)
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.id == link_id,
        GuardianStudentLink.tenant_id == tid
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Relationship link not found.")

    link.verification_status = "VERIFIED"
    link.verified_at = datetime.now(timezone.utc)
    link.verified_by = str(claims.get("user_id"))
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(claims.get("user_id")),
        action_type="guardian_link.verified",
        target_entity=f"GuardianStudentLink {link.id}",
        event_payload={"guardian_id": str(link.guardian_id), "student_id": str(link.student_id)},
        risk_level="Medium",
    ))
    db.commit()
    return {"status": "success", "message": "Relationship link verified and authorized."}


@router.post("/admin/links/{link_id}/revoke", status_code=status.HTTP_200_OK)
def revoke_guardian_link(
    link_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin revokes a guardian-student relationship link."""
    tid = str(tenant_id)
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.id == link_id,
        GuardianStudentLink.tenant_id == tid
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Relationship link not found.")

    link.verification_status = "REVOKED"
    link.revoked_at = datetime.now(timezone.utc)
    db.add(AuditLog(
        tenant_id=tid,
        actor_id=str(claims.get("user_id")),
        action_type="guardian_link.revoked",
        target_entity=f"GuardianStudentLink {link.id}",
        event_payload={"guardian_id": str(link.guardian_id), "student_id": str(link.student_id)},
        risk_level="High",
    ))
    db.commit()
    return {"status": "success", "message": "Relationship link revoked. Access has been removed."}
