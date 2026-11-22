# backend/app/api/endpoints/admissions.py
import uuid
import datetime
import json
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.api.deps import (
    get_db,
    get_public_db,
    get_current_tenant_id,
    get_public_or_authenticated_tenant_id,
    get_current_user_claims,
    require_roles,
    require_permissions,
)
from app.core.db_utils import count_rows
from app.core.rbac import Permission
from app.models.admission import AdmissionApplication, AdmissionSession, AdmissionReceipt
from app.models.student import Student
from app.models.users import Teacher
from app.models.academic import StudentEnrollmentHistory
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship
from app.models.finance import Invoice, InvoiceLineItem, InvoiceStatus
from app.services.identity_service import IdentityService
from app.schemas.admission import (
    AdmissionApplicationCreate,
    AdmissionApplicationUpdate,
    AdmissionApplicationResponse,
    AdmissionReviewPayload,
    AdmissionRejectPayload,
    AdmissionEnrollPayload,
    AdmissionSessionCreate,
    AdmissionSessionUpdate,
    AdmissionSessionResponse,
    AdmissionExamSchedulePayload,
    AdmissionExamScorePayload,
    AdmissionSelectionPayload,
    AdmissionManualPaymentSubmitPayload,
    AdmissionPaymentVerifyPayload,
    AdmissionReceiptResponse,
)

router = APIRouter()


def _ensure_uuid(val):
    if val is None:
        return None
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError):
        return val


def _ensure_dict(val):
    if not val:
        return {}
    if isinstance(val, dict):
        return dict(val)
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return {}
    return {}


def _generate_application_number(db: Session, tenant_id: str, year: str) -> str:
    """Generates sequential, tenant-scoped application number."""
    count = count_rows(
        db,
        AdmissionApplication,
        AdmissionApplication.tenant_id == str(tenant_id),
        AdmissionApplication.academic_year == year,
    )
    return f"ADM-{year}-{count + 1:04d}"


def _generate_student_admission_number(db: Session, tenant_id: str, year: str, class_name: str) -> str:
    """Generates unique institutional student admission ID."""
    clean_cls = "".join(c for c in class_name if c.isalnum())
    count = count_rows(
        db,
        Student,
        Student.tenant_id == str(tenant_id),
    )
    return f"STD-{year}-{clean_cls}-{count + 1:04d}"


def _generate_receipt_number(db: Session, tenant_id: str, year: str) -> str:
    """Generates sequential, tamper-evident anti-fraud receipt number."""
    count = count_rows(
        db,
        AdmissionReceipt,
        AdmissionReceipt.tenant_id == str(tenant_id),
    )
    return f"RCP-{year}-{count + 1:04d}"


# ============================================================================
# 1. ADMISSION SESSIONS MANAGEMENT (Intake Cycles)
# ============================================================================

@router.post("/sessions", response_model=AdmissionSessionResponse, status_code=status.HTTP_201_CREATED)
def create_admission_session(
    payload: AdmissionSessionCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"])),
):
    """
    Creates a new configurable admission intake cycle for the tenant.
    Supports Model A (Entrance Exam) and Model B (Direct Admission).
    """
    tid = str(tenant_id)
    existing = db.query(AdmissionSession).filter(
        AdmissionSession.tenant_id == tid,
        AdmissionSession.academic_year == payload.academic_year,
        AdmissionSession.session_name == payload.session_name,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"An admission session with name '{payload.session_name}' already exists for year {payload.academic_year}."
        )

    session = AdmissionSession(
        tenant_id=tid,
        academic_year=payload.academic_year,
        session_name=payload.session_name,
        admission_model=payload.admission_model,
        status=payload.status,
        start_date=payload.start_date,
        end_date=payload.end_date,
        application_fee=payload.application_fee,
        final_admission_fee=payload.final_admission_fee,
        class_fees=payload.class_fees or {},
        max_seats=payload.max_seats or {},
        eligibility_criteria=payload.eligibility_criteria,
        entrance_exam_date=payload.entrance_exam_date,
        entrance_exam_venue=payload.entrance_exam_venue,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/sessions", response_model=List[AdmissionSessionResponse])
def list_admission_sessions(
    status_filter: Optional[str] = Query(None, alias="status"),
    academic_year: Optional[str] = Query(None),
    db: Session = Depends(get_public_db),
    tenant_id: str = Depends(get_public_or_authenticated_tenant_id),
):
    """
    Lists intake sessions for current tenant. Accessible by admin, teacher, or portal users.
    """
    status_val = status_filter if isinstance(status_filter, str) else None
    year_val = academic_year if isinstance(academic_year, str) else None

    query = db.query(AdmissionSession).filter(AdmissionSession.tenant_id == str(tenant_id))
    if status_val:
        query = query.filter(AdmissionSession.status == status_val.upper())
    if year_val:
        query = query.filter(AdmissionSession.academic_year == year_val)
    return query.order_by(AdmissionSession.created_at.desc()).all()


@router.get("/sessions/{session_id}", response_model=AdmissionSessionResponse)
def get_admission_session(
    session_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Retrieves a single intake session.
    """
    session = db.query(AdmissionSession).filter(
        AdmissionSession.id == session_id,
        AdmissionSession.tenant_id == str(tenant_id),
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Admission session not found.")
    return session


@router.patch("/sessions/{session_id}", response_model=AdmissionSessionResponse)
def update_admission_session(
    session_id: uuid.UUID,
    payload: AdmissionSessionUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"])),
):
    """
    Updates an existing intake cycle configuration.
    """
    session = db.query(AdmissionSession).filter(
        AdmissionSession.id == session_id,
        AdmissionSession.tenant_id == str(tenant_id),
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Admission session not found.")

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(session, field, val)

    session.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(session)
    return session


# ============================================================================
# 2. ADMISSION APPLICATION INGESTION & PUBLIC TRACKING
# ============================================================================

@router.post("/apply", response_model=AdmissionApplicationResponse, status_code=status.HTTP_201_CREATED)
def submit_admission_application(
    payload: AdmissionApplicationCreate,
    db: Session = Depends(get_public_db),
    tenant_id: str = Depends(get_public_or_authenticated_tenant_id),
):
    """
    Submits a new admission application.
    Enforces tenant boundaries, unique application numbering, session fee calculation,
    and optional fee invoice linkage.
    """
    tid = str(tenant_id)
    app_fee = payload.application_fee
    final_fee = payload.final_admission_fee
    adm_model = payload.admission_model or "MODEL_B"

    # Validate session if provided
    if payload.session_id:
        session = db.query(AdmissionSession).filter(
            AdmissionSession.id == payload.session_id,
            AdmissionSession.tenant_id == tid,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Specified admission session not found for this institution.")
        if session.status != "OPEN":
            raise HTTPException(status_code=400, detail=f"Admission session '{session.session_name}' is currently {session.status}.")
        
        adm_model = session.admission_model
        # Use session class-specific fee override if defined, else session application_fee
        if session.class_fees and payload.class_name in session.class_fees:
            try:
                app_fee = Decimal(str(session.class_fees[payload.class_name]))
            except Exception:
                app_fee = session.application_fee
        else:
            app_fee = session.application_fee
        final_fee = session.final_admission_fee

    app_number = _generate_application_number(db, tid, payload.academic_year)
    now = datetime.datetime.now(datetime.timezone.utc)

    new_app = AdmissionApplication(
        tenant_id=tid,
        session_id=payload.session_id,
        admission_model=adm_model,
        application_number=app_number,
        status="SUBMITTED",
        academic_year=payload.academic_year,
        class_name=payload.class_name,
        shift=payload.shift or "Morning",
        group=payload.group,
        desired_section=payload.desired_section,
        first_name=payload.first_name,
        last_name=payload.last_name,
        first_name_bn=payload.first_name_bn,
        last_name_bn=payload.last_name_bn,
        name_bn=payload.name_bn,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        blood_group=payload.blood_group,
        nationality=payload.nationality or "Bangladeshi",
        religion=payload.religion,
        birth_registration_number=payload.birth_registration_number,
        previous_school=payload.previous_school,
        father_name_en=payload.father_name_en,
        father_name_bn=payload.father_name_bn,
        mother_name_en=payload.mother_name_en,
        mother_name_bn=payload.mother_name_bn,
        guardian_name=payload.guardian_name,
        guardian_relationship=payload.guardian_relationship,
        guardian_phone=payload.guardian_phone,
        guardian_email=payload.guardian_email,
        guardian_nid=payload.guardian_nid,
        present_address=payload.present_address,
        permanent_address=payload.permanent_address,
        address=payload.address or payload.present_address,
        division=payload.division,
        district=payload.district,
        upazila=payload.upazila,
        union_ward=payload.union_ward,
        previous_board=payload.previous_board,
        previous_roll=payload.previous_roll,
        previous_gpa=payload.previous_gpa,
        declaration_accepted=payload.declaration_accepted,
        application_fee=app_fee,
        final_admission_fee=final_fee,
        payment_status="PAID" if app_fee == Decimal("0.00") else "PENDING",
        final_fee_payment_status="PAID" if final_fee == Decimal("0.00") else "PENDING",
        documents_metadata=payload.documents_metadata or {},
        submitted_at=now,
    )

    db.add(new_app)
    db.flush()

    # Stage 06 Financial Invariant: Create formal Invoice if fee is required
    if app_fee > Decimal("0.00"):
        invoice = Invoice(
            tenant_id=tid,
            student_id=str(new_app.id),
            invoice_number=f"INV-APP-{new_app.application_number}",
            title=f"Admission Application Fee - {new_app.application_number}",
            billing_month=now.strftime("%B %Y"),
            total_amount=app_fee,
            paid_amount=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            currency="BDT",
            status=InvoiceStatus.ISSUED.value,
        )
        db.add(invoice)
        db.flush()

        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            tenant_id=tid,
            description="Application & Processing Fee",
            quantity=1,
            unit_price=app_fee,
            amount=app_fee,
        )
        db.add(line_item)
        new_app.invoice_id = invoice.id

    db.commit()
    db.refresh(new_app)
    return new_app


@router.get("/status/{application_number}", response_model=AdmissionApplicationResponse)
def track_admission_status(
    application_number: str,
    phone: Optional[str] = Query(None),
    db: Session = Depends(get_public_db),
    tenant_id: str = Depends(get_public_or_authenticated_tenant_id),
):
    """
    Public or applicant portal tracking endpoint.
    Retrieves application status, admit card info, exam schedule, and selection status.
    If phone is provided, enforces security validation against guardian_phone.
    """
    query = db.query(AdmissionApplication).filter(
        AdmissionApplication.tenant_id == str(tenant_id),
        AdmissionApplication.application_number == application_number.strip().upper(),
    )
    if phone:
        query = query.filter(AdmissionApplication.guardian_phone.ilike(f"%{phone.strip()}%"))

    app = query.first()
    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found. Please verify the application number and phone."
        )
    return app


# ============================================================================
# 3. LISTING, DETAILS & WORKFLOWS (With Teacher Scoping)
# ============================================================================

@router.get("", response_model=List[AdmissionApplicationResponse])
def list_admission_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    class_name: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    session_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Lists admission applications with filtering and pagination.
    TEACHER SCOPING: Teachers can only view applications for classes they are assigned to.
    """
    tid = str(tenant_id)
    query = db.query(AdmissionApplication).filter(
        AdmissionApplication.tenant_id == tid
    )

    status_val = status_filter if isinstance(status_filter, str) else None
    class_val = class_name if isinstance(class_name, str) else None
    year_val = academic_year if isinstance(academic_year, str) else None
    session_val = session_id if isinstance(session_id, (uuid.UUID, str)) else None
    search_val = search if isinstance(search, str) else None
    skip_val = skip if isinstance(skip, int) else 0
    limit_val = limit if isinstance(limit, int) else 50

    # Enforce teacher class-scoping
    user_roles = claims.get("roles", [])
    if "teacher" in user_roles and "admin" not in user_roles and "superadmin" not in user_roles:
        teacher = db.query(Teacher).filter(
            Teacher.tenant_id == _ensure_uuid(tid),
            Teacher.user_id == _ensure_uuid(claims.get("user_id")),
        ).first()
        if teacher and teacher.assigned_class:
            query = query.filter(AdmissionApplication.class_name == teacher.assigned_class)

    if status_val:
        query = query.filter(AdmissionApplication.status == status_val.upper())
    if class_val:
        query = query.filter(AdmissionApplication.class_name == class_val)
    if year_val:
        query = query.filter(AdmissionApplication.academic_year == year_val)
    if session_val:
        query = query.filter(AdmissionApplication.session_id == _ensure_uuid(session_val))
    if search_val:
        search_fmt = f"%{search_val.strip()}%"
        query = query.filter(
            or_(
                AdmissionApplication.first_name.ilike(search_fmt),
                AdmissionApplication.last_name.ilike(search_fmt),
                AdmissionApplication.application_number.ilike(search_fmt),
                AdmissionApplication.guardian_phone.ilike(search_fmt),
            )
        )

    return query.order_by(AdmissionApplication.created_at.desc()).offset(skip_val).limit(limit_val).all()


@router.get("/{application_id}", response_model=AdmissionApplicationResponse)
def get_admission_application(
    application_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Retrieves full details of a single admission application.
    Enforces teacher class-scoping.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admission application not found."
        )

    # Teacher class isolation check
    user_roles = claims.get("roles", [])
    if "teacher" in user_roles and "admin" not in user_roles and "superadmin" not in user_roles:
        teacher = db.query(Teacher).filter(
            Teacher.tenant_id == _ensure_uuid(tid),
            Teacher.user_id == _ensure_uuid(claims.get("user_id")),
        ).first()
        if teacher and teacher.assigned_class and app.class_name != teacher.assigned_class:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Teachers can only access applications for their assigned class ({teacher.assigned_class})."
            )

    return app


@router.post("/{application_id}/review", response_model=AdmissionApplicationResponse)
def review_admission_application(
    application_id: uuid.UUID,
    payload: AdmissionReviewPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"])),
):
    """
    Moves application to UNDER_REVIEW state.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    # Teacher class isolation check
    user_roles = claims.get("roles", [])
    if "teacher" in user_roles and "admin" not in user_roles and "superadmin" not in user_roles:
        teacher = db.query(Teacher).filter(
            Teacher.tenant_id == _ensure_uuid(tid),
            Teacher.user_id == _ensure_uuid(claims.get("user_id")),
        ).first()
        if teacher and teacher.assigned_class and app.class_name != teacher.assigned_class:
            raise HTTPException(status_code=403, detail="Unauthorized to review applications outside your assigned class.")

    if app.status not in ("SUBMITTED", "DRAFT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot move application in '{app.status}' status to UNDER_REVIEW."
        )

    app.status = "UNDER_REVIEW"
    app.review_notes = payload.notes
    app.reviewed_by_user_id = str(claims["user_id"])
    app.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(app)
    return app


@router.post("/{application_id}/approve", response_model=AdmissionApplicationResponse)
def approve_admission_application(
    application_id: uuid.UUID,
    payload: Optional[AdmissionReviewPayload] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Approves an application. Ready for official student enrollment.
    """
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == str(tenant_id),
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    if app.status not in ("UNDER_REVIEW", "SUBMITTED", "SELECTED", "EXAM_EVALUATED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve application currently in '{app.status}' state."
        )

    app.status = "APPROVED"
    if payload and payload.notes:
        app.review_notes = payload.notes
    app.reviewed_by_user_id = str(claims["user_id"])
    app.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(app)
    return app


@router.post("/{application_id}/reject", response_model=AdmissionApplicationResponse)
def reject_admission_application(
    application_id: uuid.UUID,
    payload: AdmissionRejectPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Rejects application with audited mandatory reason.
    """
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == str(tenant_id),
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    if app.status in ("ENROLLED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject application already in '{app.status}' state."
        )

    app.status = "REJECTED"
    app.rejection_reason = payload.rejection_reason
    app.reviewed_by_user_id = str(claims["user_id"])
    app.reviewed_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(app)
    return app


# ============================================================================
# 4. MODEL A: ENTRANCE EXAM, SCORING & SELECTION WORKFLOW
# ============================================================================

@router.post("/{application_id}/schedule-exam", response_model=AdmissionApplicationResponse)
def schedule_entrance_exam(
    application_id: uuid.UUID,
    payload: AdmissionExamSchedulePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Model A Workflow: Schedules entrance examination and generates Admit Card number.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    # Guard: Application fee must be paid if fee > 0
    if app.application_fee > Decimal("0.00") and app.payment_status != "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot schedule entrance exam before the application fee is verified and paid."
        )

    roll_num = payload.roll_number or app.application_number.split("-")[-1]
    admit_card = f"AC-{app.academic_year}-{roll_num}"

    app.admit_card_number = admit_card
    app.entrance_exam_roll = roll_num
    app.status = "EXAM_SCHEDULED"
    
    exam_details = _ensure_dict(app.entrance_exam_details)
    if payload.exam_date:
        exam_details["exam_date"] = payload.exam_date.isoformat()
    if payload.venue:
        exam_details["venue"] = payload.venue
    app.entrance_exam_details = exam_details

    db.commit()
    db.refresh(app)
    return app


@router.post("/{application_id}/exam-score", response_model=AdmissionApplicationResponse)
def submit_entrance_exam_score(
    application_id: uuid.UUID,
    payload: AdmissionExamScorePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"])),
):
    """
    Model A Workflow: Submits entrance exam evaluation marks.
    Teachers can evaluate only applications in their assigned class.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    # Teacher class isolation check
    user_roles = claims.get("roles", [])
    if "teacher" in user_roles and "admin" not in user_roles and "superadmin" not in user_roles:
        teacher = db.query(Teacher).filter(
            Teacher.tenant_id == _ensure_uuid(tid),
            Teacher.user_id == _ensure_uuid(claims.get("user_id")),
        ).first()
        if teacher and teacher.assigned_class and app.class_name != teacher.assigned_class:
            raise HTTPException(status_code=403, detail="Teachers can only enter exam marks for their assigned class.")

    app.entrance_exam_score = payload.score
    details = _ensure_dict(app.entrance_exam_details)
    if payload.marks_details:
        details["breakdown"] = payload.marks_details
    if payload.notes:
        details["evaluator_notes"] = payload.notes
    details["evaluated_by"] = str(claims["user_id"])
    details["evaluated_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    app.entrance_exam_details = details

    if app.status in ("EXAM_SCHEDULED", "UNDER_REVIEW"):
        app.status = "EXAM_EVALUATED"

    db.commit()
    db.refresh(app)
    return app


@router.post("/{application_id}/select", response_model=AdmissionApplicationResponse)
def select_candidate_for_admission(
    application_id: uuid.UUID,
    payload: AdmissionSelectionPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Model A Workflow: Marks candidate as SELECTED, WAITLISTED, or NOT_SELECTED.
    If SELECTED and final_admission_fee > 0, provisions final fee invoice.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    now = datetime.datetime.now(datetime.timezone.utc)
    app.selection_status = payload.selection_status

    if payload.selection_status == "SELECTED":
        app.status = "SELECTED"
        # Generate final admission fee invoice if not already generated
        if app.final_admission_fee > Decimal("0.00") and not app.final_invoice_id:
            inv = Invoice(
                tenant_id=tid,
                student_id=str(app.id),
                invoice_number=f"INV-FIN-{app.application_number}",
                title=f"Final Admission & Registration Fee - {app.application_number}",
                billing_month=now.strftime("%B %Y"),
                total_amount=app.final_admission_fee,
                paid_amount=Decimal("0.00"),
                discount_amount=Decimal("0.00"),
                currency="BDT",
                status=InvoiceStatus.ISSUED.value,
            )
            db.add(inv)
            db.flush()
            
            line = InvoiceLineItem(
                invoice_id=inv.id,
                tenant_id=tid,
                description="Final Admission & Term Registration Fee",
                quantity=1,
                unit_price=app.final_admission_fee,
                amount=app.final_admission_fee,
            )
            db.add(line)
            app.final_invoice_id = inv.id

    elif payload.selection_status == "WAITLISTED":
        app.status = "WAITLISTED"
    elif payload.selection_status == "NOT_SELECTED":
        app.status = "REJECTED"
        app.rejection_reason = payload.notes or "Not selected based on entrance exam criteria."

    db.commit()
    db.refresh(app)
    return app


# ============================================================================
# 5. PAYMENTS, MANUAL VERIFICATION & ANTI-FRAUD RECEIPTS (Batch 4)
# ============================================================================

@router.post("/{application_id}/payments/initiate")
def initiate_admission_payment(
    application_id: uuid.UUID,
    fee_category: str = Query("APPLICATION_FEE", pattern="^(APPLICATION_FEE|FINAL_ADMISSION_FEE)$"),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Calculates server-side payable fee snapshot. Guarantees no client-tampered prices.
    Returns payable fee, currency, supported channels, and instructions.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    if fee_category == "APPLICATION_FEE":
        payable = app.application_fee
        payment_status = app.payment_status
        inv_id = str(app.invoice_id) if app.invoice_id else None
    else:
        payable = app.final_admission_fee
        payment_status = app.final_fee_payment_status
        inv_id = str(app.final_invoice_id) if app.final_invoice_id else None

    return {
        "application_id": str(app.id),
        "application_number": app.application_number,
        "student_name": f"{app.first_name} {app.last_name}",
        "fee_category": fee_category,
        "amount": payable,
        "currency": "BDT",
        "payment_status": payment_status,
        "invoice_id": inv_id,
        "supported_methods": ["Cash Counter", "bKash", "Nagad", "Bank Transfer"],
        "instructions": "For manual counter payment, pay at school finance desk. For mobile banking, submit transaction ID."
    }


@router.post("/{application_id}/payments/submit-manual", response_model=AdmissionApplicationResponse)
def submit_manual_payment(
    application_id: uuid.UUID,
    payload: AdmissionManualPaymentSubmitPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Applicant or counter cashier submits manual payment evidence for verification.
    Transitions payment status to UNDER_REVIEW.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    docs = _ensure_dict(app.documents_metadata)
    payments_history = docs.get("payment_submissions", [])
    submission_entry = {
        "fee_category": payload.fee_category,
        "payment_method": payload.payment_method,
        "transaction_reference": payload.transaction_reference,
        "amount_submitted": float(payload.amount_paid) if payload.amount_paid else None,
        "notes": payload.notes,
        "submitted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    payments_history.append(submission_entry)
    docs["payment_submissions"] = payments_history
    app.documents_metadata = docs

    if payload.fee_category == "APPLICATION_FEE":
        app.payment_status = "UNDER_REVIEW"
    else:
        app.final_fee_payment_status = "UNDER_REVIEW"

    db.commit()
    db.refresh(app)
    return app


@router.post("/{application_id}/payments/verify", response_model=AdmissionReceiptResponse)
def verify_admission_payment(
    application_id: uuid.UUID,
    payload: AdmissionPaymentVerifyPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    ADMIN/CASHIER ONLY: Formally verifies payment, issues immutable sequential anti-fraud receipt.
    Guarantees idempotency: multiple calls return the same receipt without re-billing.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).with_for_update().first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    # Determine amount & invoice
    is_app_fee = (payload.fee_category == "APPLICATION_FEE")
    amount = app.application_fee if is_app_fee else app.final_admission_fee
    invoice_id = app.invoice_id if is_app_fee else app.final_invoice_id

    # Check for existing receipt (idempotency guard)
    existing_receipt = db.query(AdmissionReceipt).filter(
        AdmissionReceipt.tenant_id == tid,
        AdmissionReceipt.application_id == app.id,
        AdmissionReceipt.fee_category == payload.fee_category,
    ).first()

    if existing_receipt:
        return existing_receipt

    # Generate sequential tamper-proof receipt number
    receipt_num = _generate_receipt_number(db, tid, app.academic_year)
    now = datetime.datetime.now(datetime.timezone.utc)

    # Immutable receipt payload snapshot
    snapshot = {
        "receipt_number": receipt_num,
        "application_number": app.application_number,
        "student_name": f"{app.first_name} {app.last_name}",
        "student_name_bn": app.name_bn or f"{app.first_name_bn or ''} {app.last_name_bn or ''}".strip(),
        "class_name": app.class_name,
        "academic_year": app.academic_year,
        "guardian_name": app.guardian_name,
        "guardian_phone": app.guardian_phone,
        "fee_category": payload.fee_category,
        "amount_paid": float(amount),
        "currency": "BDT",
        "payment_method": payload.payment_method or "Cash Counter",
        "transaction_reference": payload.transaction_reference or f"TXN-{uuid.uuid4().hex[:8].upper()}",
        "issued_by_user_id": str(claims.get("user_id")),
        "issued_at": now.isoformat(),
        "institution_tenant_id": tid,
    }

    new_receipt = AdmissionReceipt(
        tenant_id=tid,
        receipt_number=receipt_num,
        application_id=app.id,
        student_id=app.enrolled_student_id,
        invoice_id=invoice_id,
        amount_paid=amount,
        currency="BDT",
        payment_method=payload.payment_method or "Cash Counter",
        transaction_reference=payload.transaction_reference or snapshot["transaction_reference"],
        fee_category=payload.fee_category,
        receipt_payload=snapshot,
        issued_by_user_id=str(claims.get("user_id")),
        issued_at=now,
    )
    db.add(new_receipt)

    # Update application & invoice status
    if is_app_fee:
        app.payment_status = "PAID"
    else:
        app.final_fee_payment_status = "PAID"
        # In Model A or B, final payment verification automatically approves for enrollment!
        if app.status in ("SELECTED", "UNDER_REVIEW"):
            app.status = "APPROVED"

    if invoice_id:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id, Invoice.tenant_id == tid).first()
        if inv:
            inv.status = InvoiceStatus.PAID.value
            inv.paid_amount = amount

    db.commit()
    db.refresh(new_receipt)
    return new_receipt


@router.get("/{application_id}/receipt", response_model=AdmissionReceiptResponse)
def get_admission_receipt(
    application_id: uuid.UUID,
    fee_category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    Retrieves the official anti-fraud receipt for an admission application.
    """
    tid = str(tenant_id)
    query = db.query(AdmissionReceipt).filter(
        AdmissionReceipt.tenant_id == tid,
        AdmissionReceipt.application_id == application_id,
    )
    if fee_category:
        query = query.filter(AdmissionReceipt.fee_category == fee_category)

    receipt = query.order_by(AdmissionReceipt.issued_at.desc()).first()
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Official admission receipt not found for this application."
        )
    return receipt


@router.get("/receipts/all", response_model=List[AdmissionReceiptResponse])
def list_admission_receipts(
    fee_category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"])),
):
    """
    ADMIN ONLY: Lists all counter & portal receipts issued for this tenant with anti-fraud audit trail.
    """
    fee_val = fee_category if isinstance(fee_category, str) else None
    search_val = search if isinstance(search, str) else None
    skip_val = skip if isinstance(skip, int) else 0
    limit_val = limit if isinstance(limit, int) else 50

    tid = str(tenant_id)
    query = db.query(AdmissionReceipt).filter(AdmissionReceipt.tenant_id == tid)
    if fee_val:
        query = query.filter(AdmissionReceipt.fee_category == fee_val)
    if search_val:
        search_fmt = f"%{search_val.strip()}%"
        query = query.filter(
            or_(
                AdmissionReceipt.receipt_number.ilike(search_fmt),
                AdmissionReceipt.transaction_reference.ilike(search_fmt),
            )
        )
    return query.order_by(AdmissionReceipt.issued_at.desc()).offset(skip_val).limit(limit_val).all()


# ============================================================================
# 6. IDEMPOTENT ENROLLMENT WITH ROLE & FINANCIAL CHECKS
# ============================================================================

@router.post("/{application_id}/enroll", response_model=AdmissionApplicationResponse)
def enroll_admitted_student(
    application_id: uuid.UUID,
    payload: AdmissionEnrollPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Idempotent official enrollment:
    1. If already ENROLLED, returns existing record without creating duplicate student.
    2. Validates APPROVED status and fee clearance:
       - Model A: requires selection_status == 'SELECTED' or status == 'APPROVED', and final fee paid.
       - Model B: requires status == 'APPROVED' and application fee paid.
    3. Transactionally provisions Student, Guardian, and GuardianStudentLink records.
    4. Updates application state to ENROLLED.
    5. Links Student ID to any issued receipts.
    """
    tid = str(tenant_id)
    app = db.query(AdmissionApplication).filter(
        AdmissionApplication.id == application_id,
        AdmissionApplication.tenant_id == tid,
    ).with_for_update().first()

    if not app:
        raise HTTPException(status_code=404, detail="Admission application not found.")

    # Idempotency Guard: prevent duplicate student creation if called repeatedly
    if app.status == "ENROLLED" and app.enrolled_student_id:
        return app

    # Strict lifecycle guard
    if app.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only APPROVED applications can be enrolled. Current status: '{app.status}'."
        )

    # Financial Clearance Guard
    if app.admission_model == "MODEL_A":
        if app.final_admission_fee > Decimal("0.00") and app.final_fee_payment_status != "PAID":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Final admission fee must be paid before official student enrollment."
            )
    else:
        if app.application_fee > Decimal("0.00") and app.payment_status != "PAID":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Application fee must be paid before official student enrollment."
            )

    now = datetime.datetime.now(datetime.timezone.utc)

    # 1. Resolve Unique Admission Number
    adm_num = payload.custom_admission_number or _generate_student_admission_number(
        db, tid, app.academic_year, app.class_name
    )

    # Ensure uniqueness within tenant
    existing_student = db.query(Student).filter(
        Student.tenant_id == tid,
        Student.admission_number == adm_num
    ).first()
    if existing_student:
        adm_num = f"{adm_num}-{uuid.uuid4().hex[:4].upper()}"

    # 2. Provision Student Entity
    student = Student(
        tenant_id=tid,
        first_name=app.first_name,
        last_name=app.last_name,
        first_name_bn=app.first_name_bn,
        last_name_bn=app.last_name_bn,
        name_bn=app.name_bn,
        admission_number=adm_num,
        class_name=app.class_name,
        section=payload.section or "A",
        roll_number=payload.roll_number,
        group=app.group,
        shift=app.shift or "Morning",
        academic_year=app.academic_year or "2026",
        gender=app.gender,
        date_of_birth=app.date_of_birth,
        blood_group=app.blood_group,
        birth_certificate_no=app.birth_registration_number,
        address=app.address or app.present_address,
        emergency_contact=app.guardian_phone,
        previous_school=app.previous_school,
        status="Active",
    )
    db.add(student)
    db.flush()

    # Create initial academic enrollment history
    enrollment_history = StudentEnrollmentHistory(
        tenant_id=tid,
        student_id=student.id,
        academic_year=app.academic_year or "2026",
        class_name=app.class_name,
        section=payload.section or "A",
        roll_number=payload.roll_number,
        group=app.group,
        shift=app.shift or "Morning",
        promotion_status="ADMITTED",
        remarks=f"Official enrollment via application {app.application_number} ({app.admission_model})",
    )
    db.add(enrollment_history)

    # 3. Provision or Link Guardian
    guardian = db.query(Guardian).filter(
        Guardian.tenant_id == tid,
        Guardian.phone_number == app.guardian_phone
    ).first()

    if not guardian:
        names = app.guardian_name.split(" ", 1)
        guardian = Guardian(
            tenant_id=tid,
            first_name=names[0],
            last_name=names[1] if len(names) > 1 else "",
            phone_number=app.guardian_phone,
            email=app.guardian_email,
            nid_number=app.guardian_nid,
        )
        db.add(guardian)
        db.flush()

    # 4. Link Guardian to Student
    existing_link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.tenant_id == tid,
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student.id
    ).first()

    if not existing_link:
        rel_enum = GuardianRelationship.FATHER
        if "mother" in app.guardian_relationship.lower():
            rel_enum = GuardianRelationship.MOTHER
        elif "legal" in app.guardian_relationship.lower():
            rel_enum = GuardianRelationship.LEGAL_GUARDIAN

        link = GuardianStudentLink(
            tenant_id=tid,
            guardian_id=guardian.id,
            student_id=student.id,
            relationship_type=rel_enum,
            is_primary=True,
            is_primary_contact=True,
            verification_status="VERIFIED",
            verification_method="OFFICIAL_ADMISSION",
            verified_by=str(claims.get("user_id")),
        )
        db.add(link)

    # 5. Provision Student and Guardian IAM accounts & activation invitations
    try:
        IdentityService.provision_student_account(
            db=db,
            tenant_id=tid,
            student_id=student.id,
            created_by_user_id=claims.get("user_id")
        )
        IdentityService.provision_guardian_account(
            db=db,
            tenant_id=tid,
            guardian_id=guardian.id,
            created_by_user_id=claims.get("user_id")
        )
    except Exception:
        # Do not block academic enrollment if IAM notification fails
        pass

    # 6. Finalize Application Record & Link Receipts
    app.status = "ENROLLED"
    app.enrolled_student_id = student.id
    app.enrolled_at = now

    # Update Invoices to point to student.id
    if app.invoice_id:
        inv = db.query(Invoice).filter(Invoice.id == app.invoice_id).first()
        if inv:
            inv.student_id = str(student.id)
    if app.final_invoice_id:
        inv_fin = db.query(Invoice).filter(Invoice.id == app.final_invoice_id).first()
        if inv_fin:
            inv_fin.student_id = str(student.id)

    # Link student.id to issued receipts
    receipts = db.query(AdmissionReceipt).filter(
        AdmissionReceipt.tenant_id == tid,
        AdmissionReceipt.application_id == app.id,
    ).all()
    for rcp in receipts:
        rcp.student_id = student.id

    db.commit()
    db.refresh(app)
    return app
