from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
import uuid

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.attendance import AttendanceEvent
from app.models.student import Student

router = APIRouter()

class StudentAttendanceItem(BaseModel):
    student_id: uuid.UUID
    status: str  # "Present" or "Absent"
    remarks: Optional[str] = None

class BulkAttendancePayload(BaseModel):
    attendance_date: date
    class_name: str
    records: List[StudentAttendanceItem]

class AttendanceSheetStudent(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    admission_number: str
    roll_number: Optional[str]
    status: str

@router.get("/sheet", response_model=List[AttendanceSheetStudent])
def get_attendance_sheet(
    class_name: str,
    attendance_date: Optional[date] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Returns student list for a class with their recorded status for the day (defaults to Present).
    """
    target_date = attendance_date or date.today()
    students = db.query(Student).filter(
        Student.tenant_id == tenant_id,
        Student.class_name == class_name,
        Student.status == "Active"
    ).order_by(Student.roll_number.asc(), Student.admission_number.asc()).all()

    # 🚀 Cast student_id to str to avoid comparison mismatches
    existing_records = {
        str(record.student_id): record.status
        for record in db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == str(tenant_id),
            AttendanceEvent.date == target_date
        ).all()
    }

    result = []
    for s in students:
        result.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "admission_number": s.admission_number,
            "roll_number": s.roll_number,
            "status": existing_records.get(s.id, "Present") # Default to Present
        })
    return result

@router.post("/bulk-submit")
def submit_bulk_attendance(
    payload: BulkAttendancePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"]))
):
    """
    Saves or updates daily attendance for an entire class safely.
    """
    for item in payload.records:
        sid_str = str(item.student_id) # 🚀 Force string conversion to match VARCHAR column

        existing = db.query(AttendanceEvent).filter(
            AttendanceEvent.tenant_id == str(tenant_id),
            AttendanceEvent.student_id == sid_str,
            AttendanceEvent.date == payload.attendance_date
        ).first()

        if existing:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = claims["user_id"]
        else:
            new_event = AttendanceEvent(
                tenant_id=str(tenant_id),
                student_id=sid_str,
                date=payload.attendance_date,
                status=item.status,
                is_biometric=False,
                marked_by=claims["user_id"],
                remarks=item.remarks
            )
            db.add(new_event)

    db.commit()
    return {"message": "Attendance recorded successfully", "count": len(payload.records)}