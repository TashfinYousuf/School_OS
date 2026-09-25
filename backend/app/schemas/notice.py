from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID

class NoticeBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    content: str = Field(..., min_length=5)
    target_audience: str = Field("ALL", pattern="^(ALL|PARENTS|TEACHERS|STUDENTS)$")
    is_published: bool = True
    expiry_date: Optional[date] = None

class NoticeCreate(NoticeBase):
    pass

class NoticeResponse(NoticeBase):
    id: UUID
    tenant_id: str
    published_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)