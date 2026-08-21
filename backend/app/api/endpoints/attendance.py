from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import datetime

from app.models.attendance import AttendanceEvent
from app.schemas.attendance import AttendanceCreate, AttendanceResponse
from app.core.database import get_db
from app.api.deps import get_current_tenant_id

router = APIRouter()

@router.post("/", response_model=AttendanceResponse)
def mark_attendance(
    record: AttendanceCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    # This acts as our "Event Emitter" for the AI Engine
    new_event = AttendanceEvent(
        **record.model_dump(),
        tenant_id=tenant_id,
        marked_by="Teacher API" 
    )
    db.add(new_event)
    db.commit()
    db.refresh(new_event)
    return new_event

@router.get("/", response_model=List[AttendanceResponse])
def get_attendance(
    date: datetime.date = datetime.date.today(),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    # Fetch today's attendance events
    return db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tenant_id,
        AttendanceEvent.date == date
    ).all()