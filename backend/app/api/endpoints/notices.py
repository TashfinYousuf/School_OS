import uuid
import datetime
from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, get_current_user_claims, require_roles
from app.models.notice import Notice, NoticeAcknowledgement
from app.schemas.notice import NoticeCreate, NoticeResponse
from app.core.ai_client import ai_client as client

router = APIRouter()


class NoticeComposeRequest(BaseModel):
    title: Optional[str] = None
    raw_prompt: str # e.g. "আগামী রবিবার স্কুল বন্ধ থাকবে..."
    urgency: str = "Normal" # Normal, High, Emergency


class NoticeAcknowledgeResponse(BaseModel):
    message: str
    notice_id: uuid.UUID
    acknowledged_at: datetime.datetime


@router.post("/compose")
def compose_multi_channel_notice_ai(
    req: NoticeComposeRequest,
    school_name: str,
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"]))
):
    """
    Takes a single-sentence instruction and drafts 3 distinct institutional versions.
    """
    system_instruction = (
        f"You are the Chief Communications Officer for '{school_name}'. "
        "Your duty is to generate three distinct versions of an institutional notice from a single raw instruction. "
        "Strictly maintain professional Bangladeshi school administrative tone. "
        "Format your response with the following three explicit JSON-friendly markers:\n"
        "===TITLE===\n(A formal notice title in Bangla)\n"
        "===OFFICIAL===\n(Full formal letter with date, salutation, body paragraphs, and Principal's signature block for A4 printing)\n"
        "===GUARDIAN_SMS===\n(Concise, polite, direct Bangla message within 2-3 sentences for SMS/WhatsApp)\n"
        "===SOCIAL===\n(Engaging, warm announcement format with emojis and clear bullet points for Facebook/Portal)"
    )

    prompt = (
        f"Institution: {req.title}\n"
        f"Urgency Level: {req.urgency}\n"
        f"Principal's Input: {req.raw_prompt}\n\n"
        "Generate the three communication formats now."
    )

    try:
        chat = client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
        )
        response = chat.send_message(prompt)
        text = response.text

        # Parsing the structured sections
        title = "জরুরি প্রাতিষ্ঠানিক বিজ্ঞপ্তি"
        official = ""
        sms = ""
        social = ""

        parts = text.split("===")
        for i in range(len(parts) - 1):
            tag = parts[i].strip()
            content = parts[i+1].strip()
            if tag == "TITLE":
                title = content.split("\n")[0].strip()
            elif tag == "OFFICIAL":
                official = content.replace("GUARDIAN_SMS", "").strip()
            elif tag == "GUARDIAN_SMS":
                sms = content.replace("SOCIAL", "").strip()
            elif tag == "SOCIAL":
                social = content.strip()

        # Fallback if AI didn't follow exact delimiter tags
        if not official:
            official = text
        if not sms:
            sms = req.raw_prompt
        if not social:
            social = text

        current_year = datetime.date.today().year
        memo_no = f"KS/NOTICE/{current_year}/{uuid.uuid4().hex[:4].upper()}"

        return {
            "memo_no": memo_no,
            "raw_prompt": req.raw_prompt,
            "title": title,
            "official_notice": official,
            "guardian_sms": sms,
            "social_copy": social
        }

    except Exception as e:
        print(f"Notice Composer Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Notice Engine Error: {str(e)}")


@router.post("/", response_model=NoticeResponse, status_code=status.HTTP_201_CREATED)
def publish_notice(
    payload: NoticeCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "superadmin"]))
):
    """
    Creates and publishes an official institutional notice with audience targeting.
    Restricted strictly to Platform Superadmin and School Administrators.
    """
    tid = str(tenant_id)
    author_id = None
    try:
        author_id = uuid.UUID(str(claims["user_id"]))
    except (ValueError, TypeError):
        pass

    notice = Notice(
        tenant_id=tid,
        title=payload.title,
        content=payload.content,
        official_notice=payload.content,
        target_audience=payload.target_audience.upper(),
        is_published=payload.is_published,
        expiry_date=payload.expiry_date,
        created_by_user_id=author_id,
        created_by=str(claims["user_id"]),
        status="Published" if payload.is_published else "Draft",
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@router.delete("/{notice_id}", status_code=status.HTTP_200_OK)
def delete_notice(
    notice_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "superadmin"]))
):
    """
    Deletes an institutional circular. Restricted strictly to Platform Superadmin and School Administrators.
    """
    tid = str(tenant_id)
    notice = db.query(Notice).filter(Notice.id == notice_id, Notice.tenant_id == tid).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found in this institutional workspace.")
    db.delete(notice)
    db.commit()
    return {"message": "Notice deleted successfully"}


@router.get("/", response_model=List[NoticeResponse])
def get_notices(
    audience: Optional[str] = Query(None),
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims)
):
    """
    Retrieves notices tailored to the requesting user's role and tenant.
    Enforces audience-level authorization:
    - Admin/Teachers see all notices.
    - Guardians only see notices targeting 'ALL' or 'PARENTS'.
    - Students only see notices targeting 'ALL' or 'STUDENTS'.
    """
    tid = str(tenant_id)
    user_role = (claims.get("role") or "").lower()

    query = db.query(Notice).filter(
        Notice.tenant_id == tid,
        Notice.is_published.is_(True)
    )

    if active_only:
        query = query.filter(
            or_(Notice.expiry_date.is_(None), Notice.expiry_date >= date.today())
        )

    # Audience authorization filters
    if user_role == "guardian":
        query = query.filter(func.upper(Notice.target_audience).in_(["ALL", "PARENTS"]))
    elif user_role == "student":
        query = query.filter(func.upper(Notice.target_audience).in_(["ALL", "STUDENTS"]))
    elif audience:
        query = query.filter(func.upper(Notice.target_audience).in_(["ALL", audience.strip().upper()]))

    notices = query.order_by(Notice.created_at.desc()).all()
    # Backfill content from official_notice if content was null or empty
    for n in notices:
        if not n.content and n.official_notice:
            n.content = n.official_notice
    return notices


@router.post("/{notice_id}/acknowledge", response_model=NoticeAcknowledgeResponse)
def acknowledge_notice_read(
    notice_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims)
):
    """
    Records that a student or guardian has acknowledged reading an official notice.
    """
    tid = str(tenant_id)
    user_id = str(claims["user_id"])

    notice = db.query(Notice).filter(Notice.id == notice_id, Notice.tenant_id == tid).first()
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found in this institutional workspace.")

    existing_ack = db.query(NoticeAcknowledgement).filter(
        NoticeAcknowledgement.tenant_id == tid,
        NoticeAcknowledgement.notice_id == notice_id,
        NoticeAcknowledgement.user_id == user_id
    ).first()

    now = datetime.datetime.now(datetime.timezone.utc)
    if not existing_ack:
        ack = NoticeAcknowledgement(
            tenant_id=tid,
            notice_id=notice_id,
            user_id=user_id,
            acknowledged_at=now
        )
        db.add(ack)
        db.commit()
    else:
        now = existing_ack.acknowledged_at

    return NoticeAcknowledgeResponse(
        message="Notice receipt acknowledged successfully.",
        notice_id=notice_id,
        acknowledged_at=now
    )
