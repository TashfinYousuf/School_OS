import uuid
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.communication import Message
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.student import Student

router = APIRouter()

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

class ReplyPayload(BaseModel):
    reply_content: str

class MessageResponse(BaseModel):
    id: uuid.UUID
    channel: str
    sender_info: str
    content: str
    intent: Optional[str]
    ai_draft: Optional[str]
    risk_level: str
    status: str
    created_at: datetime.datetime
    student_meta: Optional[str] = None

    class Config:
        from_attributes = True

# --- 1. WhatsApp Webhook Verification (Meta / Cloud API Standard) ---
@router.get("/webhook/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    VERIFY_TOKEN = "schoolos_kids_shine_secure_2026"
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Verification token mismatch")

# --- 2. Live Inbound Message Receiver (Meta / Twilio / Gateway Webhook) ---
@router.post("/webhook/whatsapp")
async def receive_whatsapp_inbound(request: Request, db: Session = Depends(get_db)):
    """
    Receives incoming WhatsApp payload, dynamically links to student/guardian 
    records via phone number, and analyzes intent using Gemini 2.5 Flash.
    """
    body = await request.json()
    
    # Generic extraction supporting both Meta Cloud API & standard webhook formats
    phone_number = ""
    message_text = ""
    
    try:
        if "entry" in body: # Meta format
            changes = body["entry"][0]["changes"][0]["value"]
            if "messages" in changes:
                phone_number = changes["contacts"][0]["wa_id"]
                message_text = changes["messages"][0]["text"]["body"]
        else: # Standard gateway payload
            phone_number = body.get("from", "").replace("+", "").replace(" ", "")
            message_text = body.get("text", "") or body.get("message", "")
    except Exception:
        return {"status": "ignored", "reason": "non-message event"}

    if not message_text or not phone_number:
        return {"status": "ignored", "reason": "empty content"}

    # Dynamic tenant & student resolution by sender phone
    clean_phone = phone_number[-11:] # Last 11 digits (e.g. 017XXXXXXXX)
    guardian = db.query(Guardian).filter(Guardian.phone_number.like(f"%{clean_phone}%")).first()
    
    tenant_id = guardian.tenant_id if guardian else "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"
    sender_display = f"+88{clean_phone} (Guardian)"
    student_meta = "Unregistered Guardian"

    if guardian:
        link = db.query(GuardianStudentLink).filter(GuardianStudentLink.guardian_id == guardian.id).first()
        if link:
            st = db.query(Student).filter(Student.id == link.student_id).first()
            if st:
                student_meta = f"Student: {st.first_name} {st.last_name} ({st.class_name} • ID: {st.admission_number})"
                sender_display = f"{guardian.first_name} {guardian.last_name} ({clean_phone})"

    # Real AI Analysis (Intent, Risk, Empathetic Bangla Draft)
    system_instruction = (
        "You are the executive communication officer of an international school. "
        "Analyze this incoming guardian WhatsApp message. "
        "Classify intent (Academic Complaint, Fee Inquiry, Leave Notice, or General Query). "
        "Classify risk_level strictly as 'High', 'Medium', or 'Low'. "
        "Write a polite, reassuring institutional reply in formal Bangla. "
        "Output format strictly: INTENT: <intent> | RISK: <risk> | DRAFT: <reply>"
    )
    
    intent = "General Inquiry"
    risk_level = "Low"
    ai_draft = "আসসালামু আলাইকুম। আপনার বার্তাটি পেয়েছি। বিদ্যালয় কর্তৃপক্ষ বিষয়টি গুরুত্বের সাথে দেখছে।"

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(system_instruction=system_instruction, temperature=0.2)
        )
        res = chat.send_message(f"Incoming message: {message_text}")
        parts = res.text.split("|")
        for p in parts:
            if "INTENT:" in p: intent = p.replace("INTENT:", "").strip()
            elif "RISK:" in p: risk_level = p.replace("RISK:", "").strip()
            elif "DRAFT:" in p: ai_draft = p.replace("DRAFT:", "").strip()
    except Exception as e:
        print(f"AI triage error: {str(e)}")

    # Store into DB
    new_msg = Message(
        tenant_id=str(tenant_id),
        channel="WhatsApp",
        sender_info=sender_display,
        content=message_text,
        intent=intent,
        ai_draft=ai_draft,
        risk_level=risk_level,
        status="Escalated" if risk_level == "High" else "Unread"
    )
    db.add(new_msg)
    db.commit()

    return {"status": "processed", "id": new_msg.id, "intent": intent, "risk": risk_level}

# --- 3. Unified Inbox Queue ---
@router.get("/inbox", response_model=List[MessageResponse])
def get_inbox_messages(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    messages = db.query(Message).filter(
        Message.tenant_id == str(tenant_id)
    ).order_by(Message.created_at.desc()).all()

    output = []
    for m in messages:
        # Attach dynamic student metadata
        clean_p = m.sender_info.split("(")[-1].replace(")", "").strip()
        g = db.query(Guardian).filter(Guardian.phone_number.like(f"%{clean_p}%")).first()
        meta = "Student Unlinked"
        if g:
            link = db.query(GuardianStudentLink).filter(GuardianStudentLink.guardian_id == g.id).first()
            if link:
                s = db.query(Student).filter(Student.id == link.student_id).first()
                if s:
                    meta = f"{s.first_name} {s.last_name} ({s.class_name} • Roll: {s.roll_number or '—'})"

        output.append({
            "id": m.id,
            "channel": m.channel,
            "sender_info": m.sender_info,
            "content": m.content,
            "intent": m.intent,
            "ai_draft": m.ai_draft,
            "risk_level": m.risk_level,
            "status": m.status,
            "created_at": m.created_at,
            "student_meta": meta
        })
    return output

# --- 4. Reply Dispatcher ---
@router.post("/{message_id}/reply")
def reply_to_guardian(
    message_id: uuid.UUID,
    payload: ReplyPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    msg = db.query(Message).filter(Message.id == message_id, Message.tenant_id == str(tenant_id)).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message thread not found")
        
    msg.ai_draft = payload.reply_content
    msg.status = "Resolved"
    msg.risk_level = "Low"
    db.commit()
    return {"message": "Reply recorded and thread resolved", "id": msg.id}