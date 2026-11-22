import hmac
import os
import uuid
import datetime
import re

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, get_current_user_claims, require_roles
from app.models.communication import Message
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.student import Student
from app.models.tenant import User

router = APIRouter()

from app.core.ai_client import ai_client

class ReplyPayload(BaseModel):
    reply_content: str

class InquiryPayload(BaseModel):
    content: str
    category: Optional[str] = "General Inquiry"

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

    model_config = ConfigDict(from_attributes=True)

# --- 1. WhatsApp Webhook Verification (Meta / Cloud API Standard) ---
@router.get("/webhook/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    verify_token = os.getenv("WHATSAPP_VERIFY_TOKEN", "").strip()
    if not verify_token:
        raise HTTPException(status_code=503, detail="WhatsApp webhook verification token is not configured.")
    if hub_mode == "subscribe" and hub_verify_token and hmac.compare_digest(hub_verify_token, verify_token):
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

    # Dynamic tenant & student resolution strictly from verified guardian phone (no hardcoded tenant fallback)
    clean_phone = re.sub(r'\D', '', phone_number)[-11:]
    if len(clean_phone) < 10:
        return {"status": "ignored", "reason": "invalid_sender_phone"}

    guardian = db.query(Guardian).filter(Guardian.phone_number.endswith(clean_phone)).first()
    if not guardian:
        return {"status": "ignored", "reason": "unregistered_guardian_sender"}

    tenant_id = guardian.tenant_id
    sender_display = f"+88{clean_phone} (Guardian)"
    student_meta = "Unlinked Guardian"

    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.tenant_id == str(tenant_id),
        GuardianStudentLink.verification_status == "VERIFIED",
    ).first()
    if link:
        st = db.query(Student).filter(Student.id == link.student_id, Student.tenant_id == str(tenant_id)).first()
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
        # Attach dynamic student metadata strictly within tenant scope (F1)
        clean_p = m.sender_info.split("(")[-1].replace(")", "").strip()
        clean_digits = re.sub(r'\D', '', clean_p)[-11:]
        g = db.query(Guardian).filter(
            Guardian.tenant_id == str(tenant_id),
            Guardian.phone_number.endswith(clean_digits)
        ).first()
        meta = "Student Unlinked"
        if g:
            link = db.query(GuardianStudentLink).filter(
                GuardianStudentLink.guardian_id == g.id,
                GuardianStudentLink.tenant_id == str(tenant_id),
                GuardianStudentLink.verification_status == "VERIFIED",
            ).first()
            if link:
                s = db.query(Student).filter(Student.id == link.student_id, Student.tenant_id == str(tenant_id)).first()
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


# --- 5. Guardian & Student Self-Service Inquiries ---
@router.get("/my-inquiries", response_model=List[MessageResponse])
def get_my_inquiries(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims)
):
    user_id = str(claims.get("user_id") or "")
    user = None
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            user = db.query(User).filter(User.id == user_uuid).first()
        except ValueError:
            pass

    identifier = (user.email or user.username) if user else user_id
    
    messages = []
    if identifier:
        messages = db.query(Message).filter(
            Message.tenant_id == str(tenant_id),
            Message.sender_info.contains(identifier)
        ).order_by(Message.created_at.desc()).all()
    
    return [
        MessageResponse(
            id=m.id,
            channel=m.channel or "Portal Inquiry",
            sender_info=m.sender_info or "Me",
            content=m.content,
            intent=m.intent,
            ai_draft=m.ai_draft,
            risk_level=m.risk_level or "Low",
            status=m.status or "Pending",
            created_at=m.created_at or datetime.datetime.now(datetime.timezone.utc),
            student_meta=None
        )
        for m in messages
    ]


@router.post("/submit-inquiry", status_code=status.HTTP_201_CREATED)
def submit_inquiry(
    payload: InquiryPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims)
):
    user_id = str(claims.get("user_id") or "")
    user = None
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            user = db.query(User).filter(User.id == user_uuid).first()
        except ValueError:
            pass

    name = f"{user.first_name} {user.last_name}".strip() if user else "Portal User"
    sender_display = f"{name} ({user.email or user.username or user_id})" if user else f"User ({user_id})"

    new_msg = Message(
        tenant_id=str(tenant_id),
        channel="Portal Helpdesk",
        sender_info=sender_display,
        content=payload.content.strip(),
        intent=payload.category,
        ai_draft=None,
        risk_level="Low",
        status="Pending"
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return {"status": "submitted", "id": str(new_msg.id), "message": "Inquiry submitted to school administration."}


# --- 6. Truthful Notification Provider Gateway Endpoints ---
class DispatchSmsPayload(BaseModel):
    recipient_phone: str
    message: str


class DispatchEmailPayload(BaseModel):
    recipient_email: str
    subject: str
    html_content: str
    text_content: Optional[str] = None


@router.get("/providers/status")
def get_providers_configuration_status(
    claims: dict = Depends(require_roles(["admin", "superadmin"]))
):
    """
    Returns live configuration and readiness status of Email, SMS, and WhatsApp providers.
    Guarantees truthful reporting (NOT_CONFIGURED if credentials are missing).
    """
    from app.services.communication_providers import get_communications_health
    return get_communications_health()


@router.post("/dispatch-sms")
def dispatch_sms_notification(
    payload: DispatchSmsPayload,
    claims: dict = Depends(require_roles(["admin", "superadmin"]))
):
    """
    Dispatches an SMS notification to parents/students via configured gateway.
    Returns truthful DeliveryResult (SENT, NOT_CONFIGURED, or FAILED).
    """
    from app.services.communication_providers import sms_provider
    result = sms_provider.send_sms(to_phone=payload.recipient_phone, message=payload.message)
    return result.to_dict()


@router.post("/dispatch-email")
def dispatch_email_notification(
    payload: DispatchEmailPayload,
    claims: dict = Depends(require_roles(["admin", "superadmin"]))
):
    """
    Dispatches an Email notification via configured SMTP server.
    Returns truthful DeliveryResult (SENT, NOT_CONFIGURED, or FAILED).
    """
    from app.services.communication_providers import email_provider
    result = email_provider.send_email(
        to_email=payload.recipient_email,
        subject=payload.subject,
        html_body=payload.html_content,
        text_body=payload.text_content
    )
    return result.to_dict()
