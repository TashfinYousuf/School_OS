import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import google.genai as genai 
from google.genai import types
from sqlalchemy.orm import Session
from pathlib import Path
from dotenv import load_dotenv

from app.core.config import settings
from app.api.deps import get_current_tenant_id
from app.core.database import get_db
from app.models.audit import AuditLog

router = APIRouter()

# Load Env
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Clean Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").replace('"', '').replace("'", "").strip()

gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# SDK-এর জন্য সরাসরি OS Environment-এ সেট করে দেওয়া (সবচেয়ে সেফ পদ্ধতি)
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
client = genai.Client() # Client অটোমেটিক OS Environment থেকে Key নিয়ে নেবে

class PromptRequest(BaseModel):
    query: str
    context_type: str = "general"

class AIResponse(BaseModel):
    response: str
    action_suggested: str | None = None

@router.post("/ask", response_model=AIResponse)
async def ask_schoolos_ai(
    request: PromptRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    try:
        # ১. ডাটাবেস থেকে স্কুলের সাম্প্রতিক ইভেন্ট (মেমোরি) বের করা
        recent_events = db.query(AuditLog).filter(
            AuditLog.tenant_id == tenant_id
        ).order_by(AuditLog.timestamp.desc()).limit(5).all()
        
        memory_context = "\n--- RECENT SCHOOL EVENTS (MEMORY) ---\n"
        if recent_events:
            for event in recent_events:
                memory_context += f"- Action: {event.action_type}, Target: {event.target_entity}, Risk: {event.risk_level}\n"
        else:
            memory_context += "No recent events recorded yet.\n"

        # ২. Vision 2030 Master Prompt + Memory Context
        system_instruction = (
            f"You are the AI Operating System (SchoolOS) for Tenant: {tenant_id}. "
            "You are an autonomous engineering partner and an advanced education mentor. "
            f"{memory_context}"
            "Always prioritize competency, critical thinking, and student potential over traditional GPAs. "
            "If the user asks about recent events or school status, use the memory context provided above. "
            "Respond directly and professionally in the language the user asks. Use clean formatting."
        )

        # ৩. Google-এর রেকমেন্ডেশন অনুযায়ী Chat API ব্যবহার (500 Error Fix)
        chat = client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.7,
            )
        )
        
        # মেসেজ সেন্ড করা
        response = chat.send_message(request.query)
        
        return AIResponse(
            response=response.text,
            action_suggested="None"
        )
        
    except Exception as e:
        print(f"--- AI GATEWAY ERROR ---: {str(e)}") # টার্মিনালে ডিটেইলস দেখাবে
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")