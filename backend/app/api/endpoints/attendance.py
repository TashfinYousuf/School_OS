# backend/app/api/endpoints/attendance.py
import uuid
import datetime

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles, get_current_user
from app.models.attendance import AttendanceEvent
from app.models.student import Student
from app.schemas.attendance import (
    AttendanceSheetStudent,
    BulkAttendancePayload,
    OfflineBatchSyncResult,
)

# Keep APIRouter without duplicate prefix to match main.py routing
router = APIRouter()


class AttendanceItem(BaseModel):
    student_id: str
    status: str = Field(..., example="Present") # Present, Absent, Late
    timestamp: Optional[str] = None
    notes: Optional[str] = None

class OfflineSyncPayload(BaseModel):
    class_name: str
    section: Optional[str] = "A"
    date: str # YYYY-MM-DD
    sync_idempotency_key: str
    records: List[AttendanceItem]


@router.get("/sheet", response_model=List[AttendanceSheetStudent])
def get_attendance_sheet(
    class_name: str,
    attendance_date: Optional[date] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns student list for a class with their recorded status for the day.
    """
    target_date = attendance_date or date.today()

    students = db.query(Student).filter(
        Student.tenant_id == tenant_id,
        Student.class_name == class_name,
        Student.status == "Active"
    ).order_by(Student.roll_number.asc(), Student.admission_number.asc()).all()

    # Query existing records for this tenant and date
    existing_events = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.date == target_date
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
            "admission_number": s.admission_number,
            "roll_number": s.roll_number,
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
    """
    created_count = 0
    updated_count = 0
    skipped_duplicates = 0

    for item in payload.records:
        sid = uuid.UUID(str(item.student_id))

        # 1. Check by idempotency_key if supplied from offline queue
        if item.idempotency_key:
            existing_by_key = db.query(AttendanceEvent).filter(
                AttendanceEvent.tenant_id == str(tenant_id),
                AttendanceEvent.idempotency_key == item.idempotency_key
            ).first()
            if existing_by_key:
                skipped_duplicates += 1
                continue

        # 2. Check for existing record on the same date
        existing = db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == str(tenant_id),
            AttendanceEvent.student_id == sid,
            AttendanceEvent.date == payload.attendance_date
        ).first()

        if existing:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = claims["user_id"]
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
                is_biometric=False,
                marked_by=claims["user_id"],
                remarks=item.remarks,
                idempotency_key=item.idempotency_key
            )
            db.add(new_event)
            created_count += 1

    db.commit()

    return OfflineBatchSyncResult(
        total_received=len(payload.records),
        created_count=created_count,
        updated_count=updated_count,
        skipped_duplicates=skipped_duplicates
    )


@router.post("/sync-offline", status_code=status.HTTP_200_OK, dependencies=[Depends(require_roles(["admin", "teacher"]))])
def sync_offline_attendance(
    payload: OfflineSyncPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Idempotent Offline Attendance Sync Engine.
    Resolves client-server sync conflicts:
    1. If record already exists for (tenant_id, student_id, date), updates status atomically.
    2. Otherwise, appends new event with audit trail.
    """
    try:
        attendance_date = datetime.date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    synced_count = 0
    updated_count = 0

    for item in payload.records:
        student = db.query(Student).filter(
            Student.id == item.student_id,
            Student.tenant_id == str(tenant_id)
        ).first()

        if not student:
            continue

        existing_record = db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == str(tenant_id),
            AttendanceEvent.student_id == student.id,
            AttendanceEvent.date == attendance_date
        ).first()

        clean_status = item.status.capitalize()
        if clean_status not in ["Present", "Absent", "Late"]:
            clean_status = "Present"

        if existing_record:
            # Conflict Resolution: Server updates status with sync audit
            if existing_record.status != clean_status:
                existing_record.status = clean_status
                existing_record.remarks = f"Offline Sync Update: {item.notes or ''}".strip()
                updated_count += 1
        else:
            # Clean Insert
            new_event = AttendanceEvent(
                tenant_id=str(tenant_id),
                student_id=student.id,
                date=attendance_date,
                status=clean_status,
                remarks=item.notes,
                marked_by_user_id=str(current_user["user_id"])
            )
            db.add(new_event)
            synced_count += 1

    db.commit()

    return {
        "status": "SYNCED",
        "date": payload.date,
        "class_name": payload.class_name,
        "records_processed": len(payload.records),
        "new_inserted": synced_count,
        "updated_conflicts": updated_count
    }