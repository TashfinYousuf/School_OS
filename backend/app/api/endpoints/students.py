import uuid
import jwt

from typing import Any, List, Optional
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, ConfigDict

from app.api.deps import get_db, get_current_tenant_id, require_roles, get_current_user, get_current_user_claims
from app.models.tenant import User
from app.core.security_guard import security_guard
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.attendance import AttendanceEvent
from app.models.result import StudentResult
from app.models.finance import FeePayment, Invoice
from app.models.academic import ClassRoutine, StudentEnrollmentHistory
from app.models.audit import AuditLog
from app.models.auth import AccountInvitation
from app.services.identity_service import IdentityService
from app.core.identity import generate_student_uid


def _as_uuid(val: Any) -> Optional[uuid.UUID]:
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, AttributeError, TypeError):
        return None

from app.schemas.student import (
    StudentBulkImportRequest,
    StudentBulkImportResponse,
    StudentSelfUpdatePayload,
    StudentSearchItem,
)

from typing import List, Callable, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings


security_bearer = HTTPBearer(auto_error=False)

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
    admission_number: Optional[str] = None
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
    first_name_bn: Optional[str] = None
    last_name_bn: Optional[str] = None
    name_bn: Optional[str] = None
    admission_number: str
    class_name: Optional[str] = None
    section: Optional[str] = "A"
    roll_number: Optional[str] = None
    group: Optional[str] = None
    shift: Optional[str] = "Morning"
    academic_year: Optional[str] = "2026"
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    portal_status: Optional[str] = "NOT_PROVISIONED"
    user_id: Optional[uuid.UUID] = None
    username: Optional[str] = None
    invitation_expires_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StudentUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    first_name_bn: Optional[str] = None
    last_name_bn: Optional[str] = None
    name_bn: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    group: Optional[str] = None
    shift: Optional[str] = None
    academic_year: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    previous_school: Optional[str] = None
    photo_url: Optional[str] = None
    disciplinary_notes: Optional[str] = None
    health_notes: Optional[str] = None
    status: Optional[str] = None

    # Guardian Contact Updates (Optional)
    guardian_phone: Optional[str] = None
    guardian_name: Optional[str] = None

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

    # Pre-fetch users and active invitations to populate portal status with minimal DB roundtrips
    tid_str = str(tenant_id)
    t_uuid = _as_uuid(tenant_id)
    raw_user_ids = [_as_uuid(s.user_id) for s in students if s.user_id]
    user_ids = [uid for uid in raw_user_ids if uid is not None]
    user_map = {}
    if user_ids and t_uuid:
        try:
            with db.begin_nested():
                users = db.query(User).filter(User.id.in_(user_ids), User.tenant_id == t_uuid).all()
                user_map = {u.id: u for u in users}
        except Exception:
            pass

    student_ids = [s.id for s in students]
    inv_map = {}
    if student_ids:
        try:
            with db.begin_nested():
                invs = db.query(AccountInvitation).filter(
                    AccountInvitation.tenant_id == tid_str,
                    AccountInvitation.student_id.in_(student_ids),
                    AccountInvitation.is_consumed == False
                ).all()
                inv_map = {i.student_id: i for i in invs}
        except Exception:
            pass

    now_utc = datetime.now(timezone.utc)

    response = []
    for s in students:
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.student_id == s.id,
            GuardianStudentLink.tenant_id == tid_str
        ).first()
        
        guardian_name = None
        guardian_phone = None
        if link:
            g = db.query(Guardian).filter(Guardian.id == link.guardian_id).first()
            if g:
                rel_val = link.relationship_type.value if hasattr(link.relationship_type, "value") else str(link.relationship_type)
                guardian_name = f"{g.first_name} {g.last_name} ({rel_val})"
                guardian_phone = g.phone_number

        user = user_map.get(s.user_id) if s.user_id else None
        inv = inv_map.get(s.id)

        if not user:
            portal_status = "NOT_PROVISIONED"
        elif inv and ((inv.expires_at.replace(tzinfo=timezone.utc) if inv.expires_at.tzinfo is None else inv.expires_at) > now_utc):
            portal_status = "INVITED"
        elif not user.is_active:
            portal_status = "SUSPENDED"
        else:
            portal_status = "ACTIVE"

        response.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "first_name_bn": getattr(s, "first_name_bn", None),
            "last_name_bn": getattr(s, "last_name_bn", None),
            "name_bn": getattr(s, "name_bn", None),
            "admission_number": s.admission_number,
            "class_name": s.class_name,
            "section": getattr(s, "section", "A"),
            "roll_number": s.roll_number,
            "group": getattr(s, "group", None),
            "shift": getattr(s, "shift", "Morning"),
            "academic_year": getattr(s, "academic_year", "2026"),
            "guardian_name": guardian_name,
            "guardian_phone": guardian_phone,
            "status": s.status,
            "created_at": s.created_at,
            "portal_status": portal_status,
            "user_id": user.id if user else None,
            "username": getattr(user, "username", None) or s.admission_number,
            "invitation_expires_at": inv.expires_at if inv else None,
        })
    return response


@router.get("/search", response_model=List[StudentSearchItem])
def search_students(
    q: str = Query(..., min_length=1, max_length=100),
    class_name: Optional[str] = None,
    section: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "finance_officer", "accountant"]))
):
    """
    High-performance indexed student search for scalable fee collection, admissions, and 360 lookups.
    Searches across English/Bengali names, admission numbers, roll numbers, and contact information.
    """
    tid = str(tenant_id)
    term = f"%{q.strip()}%"

    query = db.query(Student).filter(
        Student.tenant_id == tid,
        Student.status == "Active",
        or_(
            Student.first_name.ilike(term),
            Student.last_name.ilike(term),
            Student.name_bn.ilike(term),
            Student.admission_number.ilike(term),
            Student.roll_number.ilike(term),
            Student.emergency_contact.ilike(term),
        )
    )

    if class_name and class_name.lower() != "all":
        query = query.filter(Student.class_name == class_name)
    if section and section.lower() != "all":
        query = query.filter(Student.section == section)

    students = query.order_by(Student.roll_number.asc(), Student.admission_number.asc()).limit(limit).all()

    results = []
    for s in students:
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.student_id == s.id,
            GuardianStudentLink.tenant_id == tid,
            GuardianStudentLink.verification_status == "VERIFIED"
        ).first()

        g_name = None
        g_phone = None
        if link:
            g = db.query(Guardian).filter(Guardian.id == link.guardian_id, Guardian.tenant_id == tid).first()
            if g:
                g_name = f"{g.first_name} {g.last_name}"
                g_phone = g.phone_number

        unpaid_invoices = db.query(Invoice).filter(
            Invoice.student_id == str(s.id),
            Invoice.tenant_id == tid,
            Invoice.status.in_(["UNPAID", "PARTIALLY_PAID", "PENDING"])
        ).all()
        outstanding = float(sum(inv.total_amount for inv in unpaid_invoices)) if unpaid_invoices else 0.0

        results.append(StudentSearchItem(
            id=s.id,
            first_name=s.first_name,
            last_name=s.last_name,
            name_bn=getattr(s, "name_bn", None),
            admission_number=s.admission_number,
            class_name=s.class_name,
            section=getattr(s, "section", "A"),
            roll_number=s.roll_number,
            group=getattr(s, "group", None),
            shift=getattr(s, "shift", "Morning"),
            status=s.status,
            guardian_name=g_name,
            guardian_phone=g_phone,
            outstanding_balance=outstanding
        ))

    return results

@router.post("/admit", status_code=status.HTTP_201_CREATED)
def admit_student(
    payload: StudentAdmissionPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    adm_no = (payload.admission_number or "").strip()
    if not adm_no:
        adm_no = generate_student_uid(db, str(tenant_id), class_name=payload.class_name)
    else:
        existing_student = db.query(Student).filter(
            Student.tenant_id == str(tenant_id),
            Student.admission_number == adm_no
        ).first()
        if existing_student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Admission ID '{adm_no}' already exists in this institution."
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
        admission_number=adm_no,
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
        verification_status="VERIFIED",
        verification_method="ADMIN_ADMISSION",
        is_primary_contact=True
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
        adm = (item.admission_number or "").strip()
        if not adm:
            adm = generate_student_uid(db, str(tenant_id), item.academic_year, item.class_name)
            item_dict = item.model_dump()
            item_dict["admission_number"] = adm
        else:
            existing = db.query(Student).filter(
                Student.tenant_id == str(tenant_id),
                Student.admission_number == adm
            ).first()

            if existing:
                skipped_count += 1
                errors.append(f"Admission ID '{adm}' already registered (Skipped).")
                continue
            item_dict = item.model_dump()

        student = Student(tenant_id=str(tenant_id), **item_dict)
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
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(["admin"]))
):
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == str(tenant_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    update_data = payload.model_dump(exclude_unset=True)
    diff = {}
    
    guardian_phone = update_data.pop("guardian_phone", None)
    guardian_name = update_data.pop("guardian_name", None)

    for field, new_val in update_data.items():
        if hasattr(student, field):
            old_val = getattr(student, field)
            if old_val != new_val:
                diff[field] = {"old": str(old_val), "new": str(new_val)}
                setattr(student, field, new_val)

    if guardian_phone or guardian_name:
        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.student_id == student.id,
            GuardianStudentLink.tenant_id == str(tenant_id),
            GuardianStudentLink.verification_status == "VERIFIED"
        ).first()
        if link:
            g = db.query(Guardian).filter(Guardian.id == link.guardian_id).first()
            if g:
                if guardian_phone and g.phone_number != guardian_phone:
                    diff["guardian_phone"] = {"old": g.phone_number, "new": guardian_phone}
                    g.phone_number = guardian_phone
                if guardian_name and f"{g.first_name} {g.last_name}" != guardian_name:
                    diff["guardian_name"] = {"old": f"{g.first_name} {g.last_name}", "new": guardian_name}
                    parts = guardian_name.split(" ", 1)
                    g.first_name = parts[0]
                    g.last_name = parts[1] if len(parts) > 1 else ""

    if diff:
        audit_log = AuditLog(
            tenant_id=str(tenant_id),
            user_id=str(current_user.id) if current_user else None,
            action="UPDATE_STUDENT",
            entity="Student",
            entity_id=str(student.id),
            details={"diff": diff}
        )
        db.add(audit_log)

    db.commit()
    db.refresh(student)
    return {"message": "Student updated successfully", "student": student, "diff": diff}


@router.patch("/me/profile")
def update_my_student_profile(
    payload: StudentSelfUpdatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
    _=Depends(require_roles(["student"]))
):
    """
    Self-service endpoint for students to update allowed personal profile fields.
    Strictly forbids modifications to admission number, class, marks, roll number, or status.
    """
    student = db.query(Student).filter(
        Student.user_id == current_user.id,
        Student.tenant_id == str(tenant_id)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not linked to active account")

    update_data = payload.model_dump(exclude_unset=True)
    diff = {}
    for field, new_val in update_data.items():
        if hasattr(student, field) and field in {"address", "emergency_contact", "blood_group", "photo_url"}:
            old_val = getattr(student, field)
            if old_val != new_val:
                diff[field] = {"old": str(old_val), "new": str(new_val)}
                setattr(student, field, new_val)

    if diff:
        audit_log = AuditLog(
            tenant_id=str(tenant_id),
            user_id=str(current_user.id),
            action="STUDENT_SELF_UPDATE",
            entity="Student",
            entity_id=str(student.id),
            details={"diff": diff}
        )
        db.add(audit_log)
        db.commit()
        db.refresh(student)

    return {"message": "Profile updated successfully", "student": student}

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


@router.get("/me/dashboard")
def get_my_student_dashboard(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Returns authentic dashboard data for the authenticated student:
    - Personal student profile
    - Real-time attendance percentage & today's roll status
    - Term GPA and academic standing
    - Today's assigned class routine/periods
    """
    tid = str(tenant_id)
    user_role = (claims.get("role") or "").lower()
    if user_role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only enrolled students can access their personal dashboard."
        )

    user_id_str = str(claims.get("user_id", ""))
    try:
        user_uuid = uuid.UUID(user_id_str)
    except (ValueError, TypeError):
        user_uuid = None

    student = db.query(Student).filter(
        (Student.id == user_uuid) | (Student.user_id == user_uuid),
        Student.tenant_id == tid
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found for authenticated account.")

    # 1. Attendance Metrics
    today = date.today()
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

    # 2. Academic Standing
    results = db.query(StudentResult).filter(
        StudentResult.tenant_id == tid,
        StudentResult.student_id == student.id
    ).all()
    avg_gpa = round(sum(r.grade_point for r in results) / len(results), 2) if results else 0.0
    standing = "GPA 5.00 (A+)" if avg_gpa >= 5.0 else f"GPA {avg_gpa:.2f}" if avg_gpa > 0 else "Pending Evaluation"

    # 3. Today's Class Routine
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = day_names[today.weekday()]

    routines = db.query(ClassRoutine).filter(
        ClassRoutine.tenant_id == tid,
        ClassRoutine.class_name == student.class_name,
        ClassRoutine.day_of_week.ilike(current_day)
    ).order_by(ClassRoutine.period_number.asc()).all()

    periods_today = [
        {
            "period": r.period_number,
            "subject": r.subject,
            "start_time": r.start_time,
            "end_time": r.end_time,
            "teacher_name": r.teacher_name,
            "room_number": r.room_number,
        }
        for r in routines
    ]

    return {
        "student": {
            "id": str(student.id),
            "name": f"{student.first_name} {student.last_name}".strip(),
            "first_name": student.first_name,
            "last_name": student.last_name,
            "admission_number": student.admission_number,
            "class_name": student.class_name,
            "section": student.section or "A",
            "roll_number": student.roll_number or "—",
            "status": student.status,
        },
        "attendance": {
            "rate_percentage": rate,
            "total_days": total_days,
            "present_days": present_days,
            "absent_days": absent_days,
            "today_status": today_status,
        },
        "academics": {
            "term_gpa": avg_gpa,
            "standing": standing,
            "subjects_evaluated": len(results),
        },
        "routine_today": {
            "day": current_day,
            "periods_count": len(periods_today),
            "periods": periods_today,
        }
    }


@router.get("/{student_id}/profile-360")
def get_student_360_profile(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    user_role = (current_user.role or "").lower()
    allowed_roles = ["superadmin", "admin", "teacher", "guardian", "student"]
    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: insufficient permissions to view student profile"
        )

    student = db.query(Student).filter(
        Student.id == student_id, 
        Student.tenant_id == str(tenant_id)
    ).first()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    # Resource-level access control (IDOR / BOLA Guard)
    if user_role == "guardian":
        guardian = db.query(Guardian).filter(
            (Guardian.id == current_user.id) | (Guardian.user_id == current_user.id),
            Guardian.tenant_id == str(tenant_id)
        ).first()

        if not guardian:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: No guardian profile associated with current user"
            )

        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.guardian_id == guardian.id,
            GuardianStudentLink.student_id == student.id,
            GuardianStudentLink.tenant_id == str(tenant_id),
            GuardianStudentLink.verification_status == "VERIFIED",
        ).first()
        if not link:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view this student's profile"
            )
    elif user_role == "student":
        if student.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Students can only view their own profile"
            )

    # 1. Primary Guardian
    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.student_id == student.id,
        GuardianStudentLink.tenant_id == str(tenant_id),
        GuardianStudentLink.verification_status == "VERIFIED",
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

    try:
        payments = db.query(FeePayment).filter(
            FeePayment.tenant_id == str(tenant_id),
            FeePayment.student_id == student.id
        ).order_by(date_col.desc()).limit(5).all()
    except Exception:
        db.rollback()
        payments = []

    fee_records = []
    for p in payments:
        raw_date = getattr(p, "payment_date", getattr(p, "created_at", None))
        formatted_date = raw_date.strftime("%d %b, %Y") if raw_date else "—"

        meta = getattr(p, "metadata_payload", {}) or {}
        notes_str = getattr(p, "notes", "") or ""

        fee_type_resolved = (
            meta.get("fee_type")
            or getattr(p, "fee_type", None)
            or (notes_str.split(" - ")[0] if " - " in notes_str else "Monthly Tuition Fee")
        )
        month_resolved = (
            meta.get("billing_month")
            or getattr(p, "billing_month", None)
            or (notes_str.split(" - ")[1] if " - " in notes_str else "Current Month")
        )

        fee_records.append({
            "receipt_number": p.receipt_number,
            "receipt_no": p.receipt_number,
            "fee_type": fee_type_resolved,
            "month": month_resolved,
            "amount": p.amount,
            "date": formatted_date
        })

    # 4. Academic Grades
    results = db.query(StudentResult).filter(
        StudentResult.tenant_id == str(tenant_id),
        StudentResult.student_id == student.id
    ).all()

    avg_gpa = (sum(r.grade_point for r in results) / len(results)) if results else 0.0

    # 4. Enrollment History
    enrollment_history = db.query(StudentEnrollmentHistory).filter(
        StudentEnrollmentHistory.student_id == student.id,
        StudentEnrollmentHistory.tenant_id == str(tenant_id)
    ).order_by(StudentEnrollmentHistory.promoted_at.desc()).all()

    # Portal Access Status for 360 profile
    tid_str = str(tenant_id)
    t_uuid = _as_uuid(tenant_id)
    stud_user_uuid = _as_uuid(student.user_id) if student.user_id else None

    u_acc = None
    if stud_user_uuid and t_uuid:
        try:
            with db.begin_nested():
                u_acc = db.query(User).filter(User.id == stud_user_uuid, User.tenant_id == t_uuid).first()
        except Exception:
            pass

    active_inv = None
    try:
        with db.begin_nested():
            active_inv = db.query(AccountInvitation).filter(
                AccountInvitation.tenant_id == tid_str,
                AccountInvitation.student_id == student.id,
                AccountInvitation.is_consumed == False
            ).first()
    except Exception:
        pass

    now_utc_360 = datetime.now(timezone.utc)
    if not u_acc:
        p_status = "NOT_PROVISIONED"
    elif active_inv and ((active_inv.expires_at.replace(tzinfo=timezone.utc) if active_inv.expires_at.tzinfo is None else active_inv.expires_at) > now_utc_360):
        p_status = "INVITED"
    elif not u_acc.is_active:
        p_status = "SUSPENDED"
    else:
        p_status = "ACTIVE"

    return {
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "first_name_bn": getattr(student, "first_name_bn", None),
            "last_name_bn": getattr(student, "last_name_bn", None),
            "name_bn": getattr(student, "name_bn", None),
            "name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number,
            "class_name": student.class_name,
            "section": getattr(student, "section", "A"),
            "roll_number": student.roll_number or "—",
            "group": getattr(student, "group", None),
            "shift": getattr(student, "shift", "Morning"),
            "academic_year": getattr(student, "academic_year", "2026"),
            "gender": student.gender or "N/A",
            "blood_group": student.blood_group or "N/A",
            "birth_certificate_no": student.birth_certificate_no or "N/A",
            "address": getattr(student, "address", None),
            "emergency_contact": getattr(student, "emergency_contact", None),
            "previous_school": getattr(student, "previous_school", None),
            "photo_url": getattr(student, "photo_url", None),
            "disciplinary_notes": getattr(student, "disciplinary_notes", None) if user_role in ["superadmin", "admin"] else None,
            "health_notes": getattr(student, "health_notes", None),
            "status": student.status,
            "joined_at": student.created_at.strftime("%d %b, %Y") if student.created_at else "—",
            "user_id": str(student.user_id) if student.user_id else None,
            "portal_status": p_status,
            "username": getattr(u_acc, "username", None) or student.admission_number,
            "invitation_expires_at": active_inv.expires_at.isoformat() if active_inv else None
        },
        "enrollment_history": [
            {
                "id": str(h.id),
                "academic_year": h.academic_year,
                "class_name": h.class_name,
                "section": h.section,
                "roll_number": h.roll_number,
                "group": h.group,
                "shift": h.shift,
                "status": h.promotion_status,
                "remarks": h.remarks,
                "date": h.promoted_at.strftime("%d %b, %Y") if h.promoted_at else "—"
            }
            for h in enrollment_history
        ],
        "guardian": {
            "name": f"{guardian.first_name} {guardian.last_name}" if guardian else "Not Linked",
            "phone": guardian.phone_number if guardian else "N/A",
            "relationship": getattr(link.relationship_type, "value", str(link.relationship_type)) if link and link.relationship_type else "Guardian",
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

@router.get("/{student_id}")
def get_student_detail(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: dict = Depends(get_current_user_claims)
):
    student = security_guard.get_or_404_tenant_resource(
        db=db,
        model_class=Student,
        resource_id=student_id,
        current_tenant_id=tenant_id,
        resource_name="Student"
    )

    # Enforce Scope Authorization
    security_guard.verify_student_scope(
        current_user_role=current_user.get("role"),
        current_user_id=current_user.get("user_id"),
        student=student,
        db=db
    )

    return student


# ----------------------------------------------------------------------------------------
# Student Portal Access Management (Administrative IAM controls)
# ----------------------------------------------------------------------------------------

@router.post("/{student_id}/portal/provision", status_code=status.HTTP_200_OK)
def provision_student_portal(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin provisions login account and generates high-entropy activation token for student."""
    tid = str(tenant_id)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    user, raw_token = IdentityService.provision_student_account(
        db=db,
        tenant_id=tid,
        student_id=student.id,
        created_by_user_id=claims.get("user_id")
    )
    return {
        "student_id": str(student.id),
        "admission_number": student.admission_number,
        "username": getattr(user, "username", None) or student.admission_number,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "portal_status": "INVITED",
        "message": "Student portal activation invitation generated successfully."
    }


@router.post("/{student_id}/portal/reset-password", status_code=status.HTTP_200_OK)
def reset_student_portal_password(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin resets student access, invalidates prior tokens/sessions, and generates a new activation invitation."""
    tid = str(tenant_id)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    user, raw_token = IdentityService.provision_student_account(
        db=db,
        tenant_id=tid,
        student_id=student.id,
        created_by_user_id=claims.get("user_id")
    )
    return {
        "student_id": str(student.id),
        "admission_number": student.admission_number,
        "username": getattr(user, "username", None) or student.admission_number,
        "activation_token": raw_token,
        "activation_url": f"/activate?token={raw_token}",
        "portal_status": "INVITED",
        "message": "Student password reset invitation generated successfully."
    }


@router.post("/{student_id}/portal/suspend", status_code=status.HTTP_200_OK)
def suspend_student_portal(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin suspends student portal login access."""
    tid = str(tenant_id)
    t_uuid = _as_uuid(tenant_id)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student or not student.user_id:
        raise HTTPException(status_code=404, detail="Student account not provisioned.")

    u_uuid = _as_uuid(student.user_id)
    user = db.query(User).filter(User.id == u_uuid, User.tenant_id == t_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.is_active = False
    IdentityService.revoke_user_sessions(db, tid, str(user.id))
    db.commit()
    return {"student_id": str(student.id), "portal_status": "SUSPENDED", "message": "Student portal access suspended."}


@router.post("/{student_id}/portal/reactivate", status_code=status.HTTP_200_OK)
def reactivate_student_portal(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin reactivates suspended student portal login access."""
    tid = str(tenant_id)
    t_uuid = _as_uuid(tenant_id)
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tid).first()
    if not student or not student.user_id:
        raise HTTPException(status_code=404, detail="Student account not provisioned.")

    u_uuid = _as_uuid(student.user_id)
    user = db.query(User).filter(User.id == u_uuid, User.tenant_id == t_uuid).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    user.is_active = True
    db.commit()
    return {"student_id": str(student.id), "portal_status": "ACTIVE", "message": "Student portal access reactivated."}


@router.post("/{student_id}/portal/revoke", status_code=status.HTTP_200_OK)
def revoke_student_invitation(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Admin revokes unconsumed invitation tokens for student."""
    tid = str(tenant_id)
    now = datetime.now(timezone.utc)
    count = db.query(AccountInvitation).filter(
        AccountInvitation.tenant_id == tid,
        AccountInvitation.student_id == student_id,
        AccountInvitation.is_consumed == False
    ).update({"is_consumed": True, "consumed_at": now}, synchronize_session=False)
    db.commit()
    return {"student_id": str(student_id), "revoked_count": count, "message": "Student invitations revoked."}
