# backend/app/schemas/approval.py
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from datetime import datetime
from uuid import UUID

class ApprovalTaskBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    action_type: str = Field(..., min_length=2, max_length=64)
    payload_content: str
    risk_level: str = Field("Medium", pattern="^(Low|Medium|High|CRITICAL)$")

class ApprovalTaskCreate(ApprovalTaskBase):
    pass

class ApprovalTaskUpdate(BaseModel):
    payload_content: Optional[str] = None
    status: str = Field(..., pattern="^(Approved|Rejected|Edited)$")

class ApprovalTaskResponse(ApprovalTaskBase):
    id: UUID
    tenant_id: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)