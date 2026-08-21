from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class ApprovalTaskBase(BaseModel):
    title: str
    action_type: str
    payload_content: str
    risk_level: str

class ApprovalTaskCreate(ApprovalTaskBase):
    pass

class ApprovalTaskUpdate(BaseModel):
    payload_content: Optional[str] = None
    status: str # "Approved" or "Rejected"

class ApprovalTaskResponse(ApprovalTaskBase):
    id: UUID
    status: str
    created_at: datetime

    class Config:
        from_attributes = True