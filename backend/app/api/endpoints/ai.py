import os
import datetime
import google.genai as genai 

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.genai import types
from sqlalchemy.orm import Session
from sqlalchemy import func
from pathlib import Path
from dotenv import load_dotenv

from app.core.config import settings
from app.api.deps import get_current_tenant_id
from app.core.database import get_db
from app.models.audit import AuditLog

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import date
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.models.users import Teacher
from app.models.finance import FeePayment

router = APIRouter()

# Load Env
env_path = Path('.') / '.env'
load_dotenv(dotenv_path=env_path, override=True)

# Clean Keys
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").replace('"', '').replace("'", "").strip()

gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

# SDK-এর জন্য সরাসরি OS Environment-এ সেট করে দেওয়া (সবচেয়ে সেফ পদ্ধতি)
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

class QueryPayload(BaseModel):
    query: str

class PromptRequest(BaseModel):
    query: str
    context_type: str = "general"

class AIResponse(BaseModel):
    response: str
    action_suggested: str | None = None

class AICommandRequest(BaseModel):
    query: str

    
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
        chat = ai_client.chats.create(
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


@router.post("/grounded-query")
def grounded_school_query(
    payload: AICommandRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    today = date.today()
    
    # Live Digital Twin Metrics
    total_students = db.query(Student).filter(Student.tenant_id == tenant_id, Student.status == "Active").count()
    total_teachers = db.query(Teacher).filter(Teacher.tenant_id == tenant_id).count()
    present_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tenant_id, 
        AttendanceEvent.date == today, 
        AttendanceEvent.status == "Present"
    ).count()
    absent_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tenant_id, 
        AttendanceEvent.date == today, 
        AttendanceEvent.status == "Absent"
    ).count()

    context = (
        f"Institution: Kids Shine International School\n"
        f"Date: {today}\n"
        f"Total Active Students: {total_students}\n"
        f"Total Teachers: {total_teachers}\n"
        f"Students Present Today: {present_today}\n"
        f"Students Absent Today: {absent_today}\n"
    )

    system_instruction = (
        "You are the executive operational copilot for Kids Shine International School. "
        "Answer the principal or teacher's query concisely based on the live operational data provided. "
        "Respond in the same language (Bangla or English) as the query. Do not invent false data."
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        response = chat.send_message(f"Live Campus Context:\n{context}\n\nUser Question: {payload.query}")
        return {"answer": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")

@router.post("/grounded-query")
def execute_grounded_ai_query(
    payload: QueryPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    RAG Grounding: Pulls real-time campus operational data from Postgres 
    and answers executive queries with Gemini 2.5 Flash.
    """
    today = datetime.date.today()

    # 1. Real-time Metrics
    total_students = db.query(Student).filter(Student.tenant_id == str(tenant_id), Student.status == "Active").count()
    present_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.date == today,
        AttendanceEvent.status == "Present"
    ).count()
    absent_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == str(tenant_id),
        AttendanceEvent.date == today,
        AttendanceEvent.status == "Absent"
    ).count()

    fees_today = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.tenant_id == str(tenant_id),
        func.date(FeePayment.payment_date) == today
    ).scalar() or 0.0

    total_revenue = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.tenant_id == str(tenant_id)
    ).scalar() or 0.0

    context = f"""
    CAMPUS REAL-TIME SNAPSHOT ({today.strftime('%d %B, %Y')}):
    - Total Enrolled Students: {total_students}
    - Students Present Today: {present_today}
    - Students Absent Today: {absent_today}
    - Tuition Fees Collected Today: ৳{fees_today}
    - Total Institutional Revenue: ৳{total_revenue}
    """

    system_instruction = (
        "You are SchoolOS Copilot, the AI executive partner for Kids Shine International School. "
        "Answer the administrator or teacher's query concisely and accurately using ONLY the live campus data provided. "
        "Support both Bangla and English fluently. Never invent numbers."
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        response = chat.send_message(f"Current Context:\n{context}\n\nQuestion: {payload.query}")
        return {"answer": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")