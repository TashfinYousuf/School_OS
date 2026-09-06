from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import datetime
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.notice import Notice

router = APIRouter()

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
client = genai.Client(api_key=clean_api_key)

class NoticeComposeRequest(BaseModel):
    title: Optional[str] = None
    raw_prompt: str # e.g. "আগামী রবিবার স্কুল বন্ধ থাকবে..."
    urgency: str = "Normal" # Normal, High, Emergency

class NoticeSaveRequest(BaseModel):
    memo_no: Optional[str] = None
    raw_prompt: str
    title: str
    official_notice: str
    guardian_sms: str
    social_copy: str

@router.post("/compose")
def compose_multi_channel_notice_ai(
    req: NoticeComposeRequest,
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Takes a single-sentence instruction and drafts 3 distinct institutional versions.
    """
    system_instruction = (
        "You are the Chief Communications Officer for 'Kids Shine International School'. "
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

@router.post("/", status_code=status.HTTP_201_CREATED)
def save_notice(
    payload: NoticeSaveRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    notice = Notice(
        tenant_id=tenant_id,
        memo_no=payload.memo_no,
        raw_prompt=payload.raw_prompt,
        title=payload.title,
        official_notice=payload.official_notice,
        guardian_sms=payload.guardian_sms,
        social_copy=payload.social_copy,
        status="Published",
        created_by=claims["user_id"]
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return {"message": "Notice published and archived successfully", "id": notice.id}

@router.get("/")
def list_notices(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    return db.query(Notice).filter(Notice.tenant_id == tenant_id).order_by(Notice.created_at.desc()).all()