from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, Any
from datetime import date, datetime
from uuid import UUID

class NoticeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = ""
    official_notice: Optional[str] = None
    guardian_sms: Optional[str] = None
    social_copy: Optional[str] = None
    target_audience: str = "ALL"
    target_class: Optional[str] = None
    is_published: bool = True
    expiry_date: Optional[date] = None

    @field_validator("target_audience", mode="before")
    @classmethod
    def normalize_target_audience(cls, v: Any) -> str:
        if not v:
            return "ALL"
        v_str = str(v).strip().upper()
        if v_str in ("ALL", "PARENTS", "TEACHERS", "STUDENTS"):
            return v_str
        return "ALL"

class NoticeCreate(NoticeBase):
    pass

class NoticeResponse(NoticeBase):
    id: UUID
    tenant_id: str
    published_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @field_validator("content", mode="before")
    @classmethod
    def fallback_content(cls, v: Any) -> str:
        if v is not None and str(v).strip():
            return str(v)
        return ""

    model_config = ConfigDict(from_attributes=True)
