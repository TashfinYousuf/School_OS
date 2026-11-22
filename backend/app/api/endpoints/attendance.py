# backend/app/api/endpoints/attendance.py
import uuid
import datetime
import logging
import csv
import io

from zoneinfo import ZoneInfo
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from sqlalchemy.exc import IntegrityError
from datetime import date
from pydantic import BaseModel, Field, model_validator

from app.api.deps import get_db, get_current_tenant_id, require_roles, get_current_user, get_current_user_claims
from app.models.attendance import AttendanceEvent
from app.models.approval import ApprovalTask
from app.models.student import Student
from app.models.tenant import User
from app.models.guardian import Guardian, GuardianStudentLink
from app.schemas.attendance import (
    AttendanceSheetStudent,
    BulkAttendancePayload,
    OfflineBatchSyncResult,
)

# Keep APIRouter without duplicate prefix to match main.py routing
router = APIRouter()

logger = logging.getLogger(__name__)

ALLOWED_STATUSES = {"Present", "Absent", "Late", "Excused", "Half_day", "Half_Day"}
MAX_SYNC_BATCH = 1000
SCHOOL_TZ = ZoneInfo("Asia/Dhaka")


# 🚀 Dual-Compatible AttendanceItem Schema (Fixes AttributeError completely)
class AttendanceItem(BaseModel):
    student_id: str
    status: str = Field(default="Present")
    remarks: Optional[str] = Field(None, max_length=150)
    notes: Optional[str] = Field(None, max_length=150)
    timestamp: Optional[str] = None

    @model_validator(mode="after")
    def sync_notes_and_remarks(self):
        val = self.remarks or self.notes or ""
        self.remarks = val
        self.notes = val
        return self


class OfflineSyncPayload(BaseModel):
    class_name: str
    date: str
    sync_idempotency_key: Optional[str] = None
    records: List[AttendanceItem] = Field(..., max_length=500)


@router.get("/sheet", response_model=List[AttendanceSheetStudent])
def get_attendance_sheet(
    class_name: str,
    attendance_date: Optional[date] = None,
    period_number: Optional[str] = Query("DAILY"),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns student list for a class with their recorded status for the day and period.
    """
    target_date = attendance_date or date.today()
    target_period = period_number or "DAILY"

    students = db.query(Student).filter(
        Student.tenant_id == tenant_id,
        Student.class_name == class_name,
        Student.status == "Active"
    ).order_by(Student.roll_number.asc(), Student.admission_number.asc()).all()

    # Query existing records for this tenant, date, and period
    existing_events = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.date == target_date,
        or_(
            AttendanceEvent.period_number == target_period,
            (AttendanceEvent.period_number.is_(None)) if target_period == "DAILY" else False
        )
    ).all()

    # Cast UUID key to string for reliable dictionary lookup
    existing_records = {
        str(record.student_id): record.status
        for record in existing_events
    }

    result = []
    for s in students:
        result.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "name_bn": getattr(s, "name_bn", None),
            "admission_number": s.admission_number,
            "roll_number": s.roll_number,
            "section": getattr(s, "section", "A"),
            "status": existing_records.get(str(s.id), "Present")
        })
    return result


@router.post("/bulk-submit", response_model=OfflineBatchSyncResult)
def submit_bulk_attendance(
    payload: BulkAttendancePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"]))
):
    """
    Saves or updates daily attendance for an entire class safely.
    Fully idempotent: detects duplicate client submissions via idempotency_key.
    Enforces strict tenant scoping (F3) and atomic concurrency handling (F5).
    """
    if not payload.records:
        return OfflineBatchSyncResult(
            total_received=0,
            created_count=0,
            updated_count=0,
            skipped_duplicates=0
        )

    # 1. Authoritative Cross-Tenant Containment Verification (F3)
    try:
        requested_ids = {uuid.UUID(str(r.student_id).strip()) for r in payload.records}
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Malformed UUID in records batch."
        )

    valid_student_ids = {
        s.id for s in db.query(Student.id).filter(
            Student.tenant_id == str(tenant_id),
            Student.id.in_(requested_ids)
        ).all()
    }

    foreign_ids = requested_ids - valid_student_ids
    if foreign_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Security Violation: Batch contains student entities outside this institutional scope."
        )

    created_count = 0
    updated_count = 0
    skipped_duplicates = 0

    for item in payload.records:
        sid = uuid.UUID(str(item.student_id))

        # 2. Check by idempotency_key if supplied from offline queue
        if item.idempotency_key:
            existing_by_key = db.query(AttendanceEvent).filter(
                AttendanceEvent.tenant_id == str(tenant_id),
                AttendanceEvent.idempotency_key == item.idempotency_key
            ).first()
            if existing_by_key:
                skipped_duplicates += 1
                continue

        period = getattr(item, "period_number", None) or payload.period_number or "DAILY"
        subject_val = getattr(item, "subject", None) or payload.subject

        # 3. Check for existing record on the same date and period with row lock
        existing = db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == str(tenant_id),
            AttendanceEvent.student_id == sid,
            AttendanceEvent.date == payload.attendance_date,
            AttendanceEvent.period_number == period
        ).with_for_update().first()

        if existing:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = claims["user_id"]
            if subject_val:
                existing.subject = subject_val
            if item.idempotency_key:
                existing.idempotency_key = item.idempotency_key
            updated_count += 1
        else:
            new_event = AttendanceEvent(
                tenant_id=str(tenant_id),
                student_id=sid,
                class_id=payload.class_name,
                date=payload.attendance_date,
                status=item.status,
                period_number=period,
                subject=subject_val,
                section=payload.section or "A",
                is_biometric=False,
                marked_by=claims["user_id"],
                remarks=item.remarks,
                idempotency_key=item.idempotency_key
            )
            db.add(new_event)
            created_count += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise

    return OfflineBatchSyncResult(
        total_received=len(payload.records),
        created_count=created_count,
        updated_count=updated_count,
        skipped_duplicates=skipped_duplicates
    )


@router.post(
    "/sync-offline",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_roles(["admin", "teacher"]))],
)
def sync_offline_attendance(
    payload: OfflineSyncPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user),
):
    """
    Idempotent offline attendance sync.
    - One upsert per (tenant, student, date); the last record per student in the batch wins.
    - Concurrent syncs for the same school/day are serialised with a transaction-level advisory lock.
    - Safe to retry: every failure path rolls back and says so.
    """
    tid = str(tenant_id)
    actor = str(current_user.id)                 # ORM object: attribute access, not ["user_id"]

    # 1. Request-level validation
    try:
        attendance_date = datetime.date.fromisoformat(payload.date)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    if attendance_date > datetime.datetime.now(SCHOOL_TZ).date():
        raise HTTPException(status_code=400, detail="Attendance date cannot be in the future.")

    if len(payload.records) > MAX_SYNC_BATCH:
        raise HTTPException(status_code=413, detail=f"Too many records (max {MAX_SYNC_BATCH} per sync).")

    # 2. Normalise records. An offline queue can hold several entries for one student:
    #    the dict keeps the last one.
    wanted = {}                                   # uuid.UUID -> (status, notes)
    skipped_invalid_id = 0
    skipped_invalid_status = 0
    for item in payload.records:
        try:
            sid = uuid.UUID(str(item.student_id))
        except (TypeError, ValueError):
            skipped_invalid_id += 1
            continue

        clean_status = str(item.status or "").strip().capitalize()
        if clean_status not in ALLOWED_STATUSES:
            skipped_invalid_status += 1           # never silently turn an unknown status into "Present"
            continue

        wanted[sid] = (clean_status, (getattr(item, "notes", None) or "").strip())

    inserted = updated = unchanged = unknown = 0

    try:
        # 3. Serialise concurrent syncs for this school + day (PostgreSQL advisory lock)
        if db.bind and db.bind.dialect.name == "postgresql":
            db.execute(
                text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
                {"k": f"attendance:{tid}:{attendance_date.isoformat()}"},
            )

        # 4. Two queries for the whole batch instead of two per record
        students = {
            str(s.id): s
            for s in db.query(Student).filter(
                Student.tenant_id == tid,
                Student.id.in_(list(wanted.keys())),
            ).all()
        }

        existing = {
            str(e.student_id): e
            for e in db.query(AttendanceEvent).filter(
                AttendanceEvent.tenant_id == tid,
                AttendanceEvent.date == attendance_date,
                AttendanceEvent.student_id.in_([s.id for s in students.values()]),
            ).all()
        }

        # 5. Apply
        for sid, (new_status, notes) in wanted.items():
            student = students.get(str(sid))
            if student is None:                   # not in this tenant (or deleted): ignore
                unknown += 1
                continue

            record = existing.get(str(sid))
            if record is None:
                db.add(AttendanceEvent(
                    tenant_id=tid,
                    student_id=student.id,
                    class_id=student.class_name,  # server-side value, not client-supplied
                    date=attendance_date,
                    status=new_status,
                    is_biometric=False,
                    marked_by=actor,              # was: marked_by_user_id (no such column)
                    remarks=notes or None,
                ))
                inserted += 1
            elif record.status != new_status:
                record.status = new_status
                record.marked_by = actor
                record.remarks = f"Offline Sync Update: {notes}".strip()
                updated += 1
            else:
                unchanged += 1

        db.commit()

    except IntegrityError:
        db.rollback()
        logger.warning("sync-offline integrity conflict tenant=%s date=%s", tid, attendance_date)
        raise HTTPException(status_code=409, detail="Concurrent update detected. Safe to retry this sync.")
    except Exception:
        db.rollback()
        logger.exception("sync-offline failed tenant=%s date=%s", tid, attendance_date)
        raise HTTPException(status_code=500, detail="Attendance sync failed. Safe to retry.")

    return {
        "status": "SYNCED",
        "date": payload.date,
        "class_name": payload.class_name,
        "records_processed": len(payload.records),
        "new_inserted": inserted,
        "updated_conflicts": updated,
        "unchanged": unchanged,
        "skipped": {
            "invalid_student_id": skipped_invalid_id,
            "invalid_status": skipped_invalid_status,
            "unknown_student": unknown,
        },
    }


class AttendanceCorrectionRequestPayload(BaseModel):
    attendance_event_id: uuid.UUID
    requested_status: str
    reason: str = Field(..., min_length=3, max_length=500)


class AttendanceCorrectionReviewPayload(BaseModel):
    action: str = Field(..., pattern="^(APPROVE|REJECT)$")
    review_notes: Optional[str] = None


@router.get("/summary")
def get_attendance_summary(
    class_name: Optional[str] = None,
    target_date: Optional[date] = None,
    month: Optional[str] = None, # e.g. "2026-11"
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Computes daily and monthly attendance summaries per class deterministically.
    """
    tid = str(tenant_id)
    query = db.query(AttendanceEvent).filter(AttendanceEvent.tenant_id == tid)

    if class_name:
        query = query.filter(AttendanceEvent.class_id == class_name)

    if target_date:
        query = query.filter(AttendanceEvent.date == target_date)
    elif month:
        try:
            year_val, month_val = [int(p) for p in month.split("-")]
            start_date = date(year_val, month_val, 1)
            # next month start
            if month_val == 12:
                end_date = date(year_val + 1, 1, 1)
            else:
                end_date = date(year_val, month_val + 1, 1)
            query = query.filter(AttendanceEvent.date >= start_date, AttendanceEvent.date < end_date)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid month format. Expected YYYY-MM.")
    else:
        # Default to today
        query = query.filter(AttendanceEvent.date == date.today())

    events = query.all()
    total_records = len(events)
    counts = {
        "Present": 0,
        "Absent": 0,
        "Late": 0,
        "Excused": 0,
        "Half_Day": 0,
    }

    for ev in events:
        st = (ev.status or "").capitalize()
        if "half" in st.lower():
            counts["Half_Day"] += 1
        elif st in counts:
            counts[st] += 1
        else:
            counts["Present"] += 1

    present_equivalent = counts["Present"] + counts["Late"] + (counts["Half_Day"] * 0.5)
    attendance_rate = round((present_equivalent / total_records * 100), 2) if total_records > 0 else 0.0

    return {
        "tenant_id": tid,
        "class_name": class_name or "ALL",
        "total_records": total_records,
        "present_count": counts["Present"],
        "absent_count": counts["Absent"],
        "late_count": counts["Late"],
        "excused_count": counts["Excused"],
        "half_day_count": counts["Half_Day"],
        "attendance_rate_percentage": attendance_rate,
    }


@router.post("/correction-request", status_code=status.HTTP_201_CREATED)
def request_attendance_correction(
    payload: AttendanceCorrectionRequestPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"])),
):
    """
    Submits an attendance correction request into the Action Center (ApprovalTask).
    """
    tid = str(tenant_id)
    event = db.query(AttendanceEvent).filter(
        AttendanceEvent.id == payload.attendance_event_id,
        AttendanceEvent.tenant_id == tid
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Attendance event record not found.")

    clean_status = payload.requested_status.strip().capitalize()
    if clean_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid requested status. Allowed: {ALLOWED_STATUSES}")

    task = ApprovalTask(
        tenant_id=tid,
        task_type="ATTENDANCE_CORRECTION",
        title=f"Attendance Correction for Student ID {event.student_id}",
        description=f"Change status from '{event.status}' to '{clean_status}'. Reason: {payload.reason}",
        status="Pending",
        requested_by_user_id=str(claims["user_id"]),
        payload={
            "attendance_event_id": str(event.id),
            "original_status": event.status,
            "requested_status": clean_status,
            "date": event.date.isoformat(),
            "reason": payload.reason,
        }
    )
    db.add(task)
    db.commit()
    db.refresh(task)

    return {
        "message": "Attendance correction request submitted for administrative review.",
        "task_id": str(task.id),
        "status": task.status
    }


@router.post("/correction-approval/{task_id}")
def review_attendance_correction(
    task_id: uuid.UUID,
    payload: AttendanceCorrectionReviewPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"])),
):
    """
    Reviews and applies an attendance correction request.
    Only administrators can approve changes to official attendance records.
    """
    tid = str(tenant_id)
    task = db.query(ApprovalTask).filter(
        ApprovalTask.id == task_id,
        ApprovalTask.tenant_id == tid,
        ApprovalTask.task_type == "ATTENDANCE_CORRECTION"
    ).with_for_update().first()

    if not task:
        raise HTTPException(status_code=404, detail="Attendance correction task not found.")

    if task.status != "Pending":
        raise HTTPException(status_code=400, detail=f"Task has already been processed with status '{task.status}'.")

    task.reviewed_by_user_id = str(claims["user_id"])
    task.review_notes = payload.review_notes

    if payload.action == "REJECT":
        task.status = "Rejected"
        db.commit()
        return {"message": "Attendance correction request rejected.", "task_id": str(task.id), "status": task.status}

    # Apply correction
    event_id_str = task.payload.get("attendance_event_id")
    requested_status = task.payload.get("requested_status")
    
    event = db.query(AttendanceEvent).filter(
        AttendanceEvent.id == uuid.UUID(event_id_str),
        AttendanceEvent.tenant_id == tid
    ).first()

    if not event:
        raise HTTPException(status_code=404, detail="Original attendance record no longer exists.")

    event.status = requested_status
    event.remarks = f"Corrected via ApprovalTask {task.id}: {payload.review_notes or task.payload.get('reason')}"
    task.status = "Approved"

    db.commit()
    return {
        "message": "Attendance correction applied successfully.",
        "task_id": str(task.id),
        "event_id": str(event.id),
        "new_status": event.status,
    }


# ----------------------------------------------------------------------------------------
# Historical Records, Absentee Tracking, Student History, and Export Lifecycles (P0)
# ----------------------------------------------------------------------------------------

@router.get("/records")
def list_attendance_records(
    class_name: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    student_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Historical attendance ledger query with class, date-range, student, and status filters.
    Strictly isolated by institutional tenant.
    """
    tid = str(tenant_id)
    query = (
        db.query(AttendanceEvent, Student)
        .join(Student, AttendanceEvent.student_id == Student.id)
        .filter(AttendanceEvent.tenant_id == tid, Student.tenant_id == tid)
    )

    if class_name and class_name.strip() and class_name.upper() != "ALL":
        query = query.filter(AttendanceEvent.class_id == class_name.strip())

    if start_date:
        query = query.filter(AttendanceEvent.date >= start_date)

    if end_date:
        query = query.filter(AttendanceEvent.date <= end_date)

    if student_id:
        query = query.filter(AttendanceEvent.student_id == student_id)

    if status_filter and status_filter.strip() and status_filter.upper() != "ALL":
        clean_status = status_filter.strip().capitalize()
        query = query.filter(AttendanceEvent.status == clean_status)

    total_count = query.count()
    results = (
        query.order_by(AttendanceEvent.date.desc(), Student.roll_number.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    items = []
    for ev, st in results:
        items.append({
            "id": str(ev.id),
            "student_id": str(st.id),
            "student_name": f"{st.first_name} {st.last_name}".strip(),
            "admission_number": st.admission_number,
            "roll_number": st.roll_number or "—",
            "class_name": ev.class_id or st.class_name,
            "date": ev.date.isoformat(),
            "status": ev.status,
            "check_in_time": ev.check_in_time.strftime("%I:%M %p") if ev.check_in_time else None,
            "is_biometric": ev.is_biometric or False,
            "remarks": ev.remarks,
            "marked_by": ev.marked_by,
        })

    return {
        "total": total_count,
        "limit": limit,
        "offset": offset,
        "records": items,
    }


@router.get("/student/{student_id}")
def get_student_attendance_history(
    student_id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    month: Optional[str] = None,  # YYYY-MM
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """
    Detailed attendance history for a single student.
    Protected by IDOR/BOLA role guard: guardians can only access linked children; students only their own record.
    """
    tid = str(tenant_id)
    user_role = (claims.get("role") or "").lower()
    user_id_str = str(claims.get("user_id", ""))

    student = db.query(Student).filter(
        Student.id == student_id,
        Student.tenant_id == tid
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Student record not found in this institution.")

    # Scope Authorization (IDOR Guard)
    if user_role == "guardian":
        try:
            user_uuid = uuid.UUID(user_id_str)
        except (ValueError, TypeError):
            user_uuid = None

        guardian = db.query(Guardian).filter(
            (Guardian.id == user_uuid) | (Guardian.user_id == user_uuid),
            Guardian.tenant_id == tid
        ).first()

        if not guardian:
            raise HTTPException(status_code=403, detail="Forbidden: No guardian profile associated with current account.")

        link = db.query(GuardianStudentLink).filter(
            GuardianStudentLink.guardian_id == guardian.id,
            GuardianStudentLink.student_id == student.id,
            GuardianStudentLink.tenant_id == tid,
            GuardianStudentLink.verification_status == "VERIFIED",
        ).first()

        if not link:
            raise HTTPException(status_code=403, detail="Forbidden: You are not authorized to view this student's attendance.")

    elif user_role == "student":
        try:
            user_uuid = uuid.UUID(user_id_str)
        except (ValueError, TypeError):
            user_uuid = None

        if not user_uuid or student.user_id != user_uuid:
            raise HTTPException(status_code=403, detail="Forbidden: Students may only view their own attendance.")
    elif user_role not in ("admin", "teacher", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient permissions to view student attendance.")

    elif user_role not in ("admin", "teacher", "superadmin"):
        raise HTTPException(status_code=403, detail="Forbidden: Insufficient privileges.")

    query = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tid,
        AttendanceEvent.student_id == student.id,
    )

    if month:
        try:
            y, m = [int(p) for p in month.split("-")]
            m_start = date(y, m, 1)
            m_end = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
            query = query.filter(AttendanceEvent.date >= m_start, AttendanceEvent.date < m_end)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid month format. Expected YYYY-MM.")
    else:
        if start_date:
            query = query.filter(AttendanceEvent.date >= start_date)
        if end_date:
            query = query.filter(AttendanceEvent.date <= end_date)

    events = query.order_by(AttendanceEvent.date.desc()).all()

    total_days = len(events)
    counts = {"Present": 0, "Absent": 0, "Late": 0, "Excused": 0, "Half_Day": 0}
    for ev in events:
        st = (ev.status or "").capitalize()
        if "half" in st.lower():
            counts["Half_Day"] += 1
        elif st in counts:
            counts[st] += 1
        else:
            counts["Present"] += 1

    present_equiv = counts["Present"] + counts["Late"] + (counts["Half_Day"] * 0.5)
    rate = round((present_equiv / total_days * 100), 1) if total_days > 0 else 100.0

    records = [
        {
            "id": str(ev.id),
            "date": ev.date.isoformat(),
            "status": ev.status,
            "check_in_time": ev.check_in_time.strftime("%I:%M %p") if ev.check_in_time else None,
            "is_biometric": ev.is_biometric or False,
            "remarks": ev.remarks,
        }
        for ev in events
    ]

    return {
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}".strip(),
        "admission_number": student.admission_number,
        "class_name": student.class_name,
        "roll_number": student.roll_number or "—",
        "total_working_days": total_days,
        "present_days": counts["Present"],
        "absent_days": counts["Absent"],
        "late_days": counts["Late"],
        "excused_days": counts["Excused"],
        "half_day_days": counts["Half_Day"],
        "attendance_rate_percentage": rate,
        "records": records,
    }


@router.get("/absent-list")
def get_daily_absent_roster(
    class_name: Optional[str] = None,
    attendance_date: Optional[date] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Returns the list of students marked Absent on a given date,
    including linked guardian contact numbers for immediate telephone or WhatsApp communication.
    """
    tid = str(tenant_id)
    target_date = attendance_date or date.today()

    query = (
        db.query(AttendanceEvent, Student)
        .join(Student, AttendanceEvent.student_id == Student.id)
        .filter(
            AttendanceEvent.tenant_id == tid,
            Student.tenant_id == tid,
            AttendanceEvent.date == target_date,
            AttendanceEvent.status == "Absent",
            Student.status == "Active",
        )
    )

    if class_name and class_name.strip() and class_name.upper() != "ALL":
        query = query.filter(AttendanceEvent.class_id == class_name.strip())

    absent_records = query.order_by(Student.class_name.asc(), Student.roll_number.asc()).all()

    absentees = []
    for ev, st in absent_records:
        link = (
            db.query(GuardianStudentLink)
            .filter(
                GuardianStudentLink.student_id == st.id,
                GuardianStudentLink.tenant_id == tid,
                GuardianStudentLink.verification_status == "VERIFIED",
            )
            .first()
        )
        guardian = None
        if link:
            guardian = db.query(Guardian).filter(Guardian.id == link.guardian_id).first()

        absentees.append({
            "event_id": str(ev.id),
            "student_id": str(st.id),
            "student_name": f"{st.first_name} {st.last_name}".strip(),
            "admission_number": st.admission_number,
            "roll_number": st.roll_number or "—",
            "class_name": st.class_name,
            "guardian_name": f"{guardian.first_name} {guardian.last_name}".strip() if guardian else None,
            "guardian_phone": guardian.phone_number if guardian else None,
            "relationship": link.relationship_type.value if link else None,
            "remarks": ev.remarks,
            "date": ev.date.isoformat(),
        })

    return {
        "date": target_date.isoformat(),
        "class_name": class_name or "ALL",
        "total_absent": len(absentees),
        "absentees": absentees,
    }


@router.get("/export")
def export_attendance_records(
    class_name: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    format: str = Query("csv", pattern="^(csv|json|html)$"),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "superadmin"])),
):
    """
    Exports attendance records to CSV, JSON, or printable HTML format.
    Fully tenant-isolated.
    """
    tid = str(tenant_id)
    query = (
        db.query(AttendanceEvent, Student)
        .join(Student, AttendanceEvent.student_id == Student.id)
        .filter(AttendanceEvent.tenant_id == tid, Student.tenant_id == tid)
    )

    if class_name and class_name.strip() and class_name.upper() != "ALL":
        query = query.filter(AttendanceEvent.class_id == class_name.strip())

    if start_date:
        query = query.filter(AttendanceEvent.date >= start_date)

    if end_date:
        query = query.filter(AttendanceEvent.date <= end_date)

    records = query.order_by(AttendanceEvent.date.desc(), Student.roll_number.asc()).all()

    filename_class = (class_name or "all-classes").replace(" ", "_")
    date_tag = (start_date.isoformat() if start_date else "start") + "_to_" + (end_date.isoformat() if end_date else "today")

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Date", "Admission Number", "Roll", "Student Name", "Class",
            "Status", "Check-In Time", "Biometric", "Remarks"
        ])
        for ev, st in records:
            time_str = ev.check_in_time.strftime("%I:%M %p") if ev.check_in_time else "—"
            writer.writerow([
                ev.date.isoformat(),
                st.admission_number,
                st.roll_number or "—",
                f"{st.first_name} {st.last_name}".strip(),
                ev.class_id or st.class_name,
                ev.status,
                time_str,
                "Yes" if ev.is_biometric else "No",
                ev.remarks or "",
            ])
        csv_data = output.getvalue()
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="attendance_{filename_class}_{date_tag}.csv"'},
        )

    elif format == "html":
        rows_html = "".join([
            f"<tr><td>{ev.date.isoformat()}</td><td>{st.admission_number}</td><td>{st.roll_number or '—'}</td>"
            f"<td>{st.first_name} {st.last_name}</td><td>{ev.class_id or st.class_name}</td>"
            f"<td class='status-{ev.status.lower()}'><strong>{ev.status}</strong></td>"
            f"<td>{ev.check_in_time.strftime('%I:%M %p') if ev.check_in_time else '—'}</td>"
            f"<td>{ev.remarks or '—'}</td></tr>"
            for ev, st in records
        ])
        html_doc = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Attendance Report - {class_name or 'All Classes'}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 30px; font-size: 12px; color: #111; }}
  h1 {{ font-size: 18px; margin-bottom: 4px; }}
  .meta {{ font-size: 11px; color: #666; margin-bottom: 20px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
  th, td {{ border: 1px solid #ddd; padding: 6px 10px; text-align: left; }}
  th {{ background-color: #f5f5f5; font-weight: bold; }}
  .status-present {{ color: #16a34a; font-weight: bold; }}
  .status-absent {{ color: #dc2626; font-weight: bold; }}
  .status-late {{ color: #d97706; font-weight: bold; }}
  @media print {{ body {{ margin: 10mm; }} }}
</style>
</head>
<body>
  <h1>Institutional Attendance Ledger</h1>
  <div class="meta">Class: <strong>{class_name or 'All Classes'}</strong> | Generated: {date.today().isoformat()} | Total Records: {len(records)}</div>
  <table>
    <thead>
      <tr><th>Date</th><th>Admission No</th><th>Roll</th><th>Student Name</th><th>Class</th><th>Status</th><th>Time</th><th>Remarks</th></tr>
    </thead>
    <tbody>{rows_html}</tbody>
  </table>
</body>
</html>"""
        return HTMLResponse(content=html_doc)

    else:
        return [
            {
                "id": str(ev.id),
                "date": ev.date.isoformat(),
                "admission_number": st.admission_number,
                "roll_number": st.roll_number,
                "student_name": f"{st.first_name} {st.last_name}".strip(),
                "class_name": ev.class_id or st.class_name,
                "status": ev.status,
                "check_in_time": ev.check_in_time.isoformat() if ev.check_in_time else None,
                "remarks": ev.remarks,
            }
            for ev, st in records
        ]

