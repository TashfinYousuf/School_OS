from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    first_name_bn: Optional[str] = Field(None, max_length=100)
    last_name_bn: Optional[str] = Field(None, max_length=100)
    name_bn: Optional[str] = Field(None, max_length=200)
    admission_number: Optional[str] = Field(None, max_length=50)
    class_name: str = Field(..., min_length=1, max_length=50)
    section: Optional[str] = Field("A", max_length=50)
    roll_number: Optional[str] = Field(None, max_length=50)
    group: Optional[str] = Field(None, max_length=50) # Science, Humanities, Business Studies
    shift: Optional[str] = Field("Morning", max_length=50) # Morning, Day
    academic_year: Optional[str] = Field("2026", max_length=20)
    gender: Optional[str] = Field("Male", max_length=20)
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    previous_school: Optional[str] = None
    photo_url: Optional[str] = None
    disciplinary_notes: Optional[str] = None
    health_notes: Optional[str] = None
    status: str = Field("Active")

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
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

class StudentSelfUpdatePayload(BaseModel):
    """Permitted self-service fields editable by the student themselves."""
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    blood_group: Optional[str] = None
    photo_url: Optional[str] = None

class StudentSearchItem(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    name_bn: Optional[str] = None
    admission_number: str
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    group: Optional[str] = None
    shift: Optional[str] = None
    status: str = "Active"
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    outstanding_balance: Optional[float] = 0.0

    model_config = ConfigDict(from_attributes=True)

class StudentResponse(StudentBase):
    id: UUID
    tenant_id: str
    admission_number: str
    user_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class StudentBulkImportRequest(BaseModel):
    students: List[StudentCreate] = Field(..., max_length=200)

class StudentBulkImportResponse(BaseModel):
    total_submitted: int
    imported_count: int
    skipped_count: int
    errors: List[str]