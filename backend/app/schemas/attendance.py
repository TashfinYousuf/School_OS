from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID

class AttendanceBase(BaseModel):
    student_id: str
    class_id: Optional[str] = None
    status: str = Field(..., pattern="^(Present|Absent|Late|Excused)$")
    remarks: Optional[str] = None
    
    # IoT Fields
    is_biometric: bool = False
    device_id: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class AttendanceResponse(AttendanceBase):
    id: UUID
    tenant_id: str
    date: date
    check_in_time: datetime
    marked_by: Optional[str] = None

    class Config:
        from_attributes = True