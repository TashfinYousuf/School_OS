from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import datetime

from app.models.audit import AuditLog
from app.api.deps import get_db, get_current_tenant_id

router = APIRouter()

# --- Pydantic Schemas for Event Logging ---
class AuditCreate(BaseModel):
    action_type: str
    target_entity: str
    event_payload: Optional[dict] = None
    risk_level: str = "Low"

class AuditResponse(BaseModel):
    id: str
    timestamp: datetime.datetime
    actor_id: str
    action_type: str
    target_entity: str
    risk_level: str

    model_config = ConfigDict(from_attributes=True)

@router.post("/", response_model=AuditResponse)
def log_event(
    event: AuditCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Core Event Bus: Records every action happening in EducationOS.
    """
    new_log = AuditLog(
        tenant_id=tenant_id,
        actor_id="Admin System", # Later, this will be fetched from current logged-in user
        action_type=event.action_type,
        target_entity=event.target_entity,
        event_payload=event.event_payload,
        risk_level=event.risk_level
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log

@router.get("/", response_model=List[AuditResponse])
def get_recent_events(
    limit: int = 50,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Fetch recent events (Used by Admin Dashboard & AI Context)
    """
    return db.query(AuditLog).filter(AuditLog.tenant_id == tenant_id).order_by(AuditLog.timestamp.desc()).limit(limit).all()