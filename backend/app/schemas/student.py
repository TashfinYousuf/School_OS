from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID

class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    admission_number: str = Field(..., min_length=1, max_length=50)
    class_name: str = Field(..., min_length=1, max_length=50)
    section: Optional[str] = Field("A", max_length=50)
    roll_number: Optional[str] = Field(None, max_length=50)
    gender: Optional[str] = Field("Male", max_length=20)
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    status: str = Field("Active")

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    class_name: Optional[str] = None
    section: Optional[str] = None
    roll_number: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    blood_group: Optional[str] = None
    birth_certificate_no: Optional[str] = None
    status: Optional[str] = None

class StudentResponse(StudentBase):
    id: UUID
    tenant_id: str
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