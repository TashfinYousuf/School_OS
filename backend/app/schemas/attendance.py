# backend/app/schemas/attendance.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

class AttendanceBase(BaseModel):
    student_id: UUID
    class_id: Optional[str] = None
    status: str = Field(..., pattern="^(Present|Absent|Late|Excused)$")
    remarks: Optional[str] = None
    
    # IoT & Hardware Fields
    is_biometric: bool = False
    device_id: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, max_length=128)

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    id: UUID
    tenant_id: str
    date: date
    check_in_time: datetime
    marked_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# Bulk & Sheet Schemas
class StudentAttendanceItem(BaseModel):
    student_id: UUID
    status: str = Field(..., pattern="^(Present|Absent|Late|Excused)$")
    remarks: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, max_length=128)

class BulkAttendancePayload(BaseModel):
    attendance_date: date
    class_name: str
    records: List[StudentAttendanceItem]

class AttendanceSheetStudent(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    admission_number: str
    roll_number: Optional[str]
    status: str

    model_config = ConfigDict(from_attributes=True)

class OfflineBatchSyncResult(BaseModel):
    total_received: int
    created_count: int
    updated_count: int
    skipped_duplicates: int