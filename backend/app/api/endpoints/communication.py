from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import datetime

from app.models.communication import Message
from app.core.database import get_db
from app.api.deps import get_current_tenant_id

router = APIRouter()

class MessageResponse(BaseModel):
    id: uuid.UUID
    channel: str
    sender_info: str
    content: str
    intent: str | None
    ai_draft: str | None
    risk_level: str
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

@router.get("/inbox", response_model=List[MessageResponse])
def get_inbox_messages(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    return db.query(Message).filter(
        Message.tenant_id == tenant_id
    ).order_by(Message.created_at.desc()).all()

# --- Demo Webhook to simulate incoming WhatsApp/Web messages ---
@router.post("/demo-webhook", response_model=MessageResponse)
def simulate_incoming_message(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    # Simulating a sensitive query that needs Human Approval
    demo_msg = Message(
        tenant_id=tenant_id,
        channel="WhatsApp",
        sender_info="+8801711223344 (Guardian)",
        content="কেন আমার ছেলের (S-101) গত মাসের পরীক্ষার ফলাফল এত খারাপ? আমি প্রিন্সিপালের সাথে কথা বলতে চাই।",
        intent="Complaint / Academic Issue",
        ai_draft="Dear Guardian, we understand your concern regarding S-101's recent results. The class teacher will contact you shortly to schedule a meeting with the Principal. Thank you.",
        risk_level="High", # Triggers human escalation
        status="Escalated"
    )
    db.add(demo_msg)
    db.commit()
    db.refresh(demo_msg)
    return demo_msg