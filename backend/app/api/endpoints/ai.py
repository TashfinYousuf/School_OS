import os
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.student import Student
from app.models.attendance import AttendanceEvent
from app.models.finance import FeePayment
from app.models.users import Teacher
from app.models.tenant import SchoolProfile
from app.models.audit import AuditLog

router = APIRouter()

# Clean API Key
clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

class QueryPayload(BaseModel):
    query: str
    context_type: Optional[str] = "general"

class AIResponse(BaseModel):
    answer: str
    response: str
    action_suggested: Optional[str] = "None"

def generate_grounded_response(query: str, tenant_id: str, db: Session) -> str:
    today = datetime.date.today()

    # 1. Real-time Campus Metrics
    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    school_name = school.school_name if school else "Kids Shine International School"

    total_students = db.query(Student).filter(Student.tenant_id == str(tenant_id), Student.status == "Active").count()
    total_teachers = db.query(Teacher).filter(Teacher.tenant_id == str(tenant_id)).count()

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

    amount_col = getattr(FeePayment, "amount", getattr(FeePayment, "amount_paid", None))
    fees_today = db.query(func.coalesce(func.sum(amount_col), 0.0)).filter(
        FeePayment.tenant_id == str(tenant_id),
        func.date(FeePayment.created_at) == today
    ).scalar() or 0.0

    total_revenue = db.query(func.sum(FeePayment.amount_paid)).filter(
        FeePayment.tenant_id == str(tenant_id)
    ).scalar() or 0.0

    attendance_pct = round((present_today / total_students * 100), 1) if total_students > 0 else 100.0

    # 2. Recent Audit Events (Memory)
    recent_events = db.query(AuditLog).filter(
        AuditLog.tenant_id == str(tenant_id)
    ).order_by(AuditLog.timestamp.desc()).limit(5).all()

    audit_context = ""
    for ev in recent_events:
        audit_context += f"- Action: {ev.action_type}, Target: {ev.target_entity}\n"

    # Context Blueprint
    context = f"""
    INSTITUTION: {school_name}
    DATE: {today.strftime('%d %B, %Y')}
    REAL-TIME OPERATIONAL METRICS:
    - Enrolled Active Students: {total_students}
    - Total Faculty/Educators: {total_teachers}
    - Today's Attendance: {present_today} Present ({attendance_pct}%), {absent_today} Absent
    - Fees Collected Today: ৳{fees_today:,.2f}
    - Total Institutional Revenue: ৳{total_revenue:,.2f}

    RECENT AUDIT EVENTS:
    {audit_context or "No recent critical audit events."}
    """

    system_instruction = (
        f"You are the executive operational partner (SchoolOS Copilot) for {school_name}. "
        "Answer questions concisely and factually based strictly on the live operational data provided. "
        "Prioritize competency, critical thinking, and clarity over traditional bureaucracy. "
        "Respond fluently in the same language (Bangla or English) as the query. "
        "Never invent numbers."
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2
            )
        )
        response = chat.send_message(f"Live Campus Context:\n{context}\n\nUser Question: {query}")
        return response.text
    except Exception as e:
        print(f"AI Grounding Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")


@router.post("/grounded-query", response_model=AIResponse)
def execute_grounded_query(
    payload: QueryPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    RAG Grounding: Answers executive queries using live Postgres operational state.
    """
    text = generate_grounded_response(payload.query, tenant_id, db)
    return AIResponse(answer=text, response=text, action_suggested="None")


@router.post("/ask", response_model=AIResponse)
def ask_schoolos_ai(
    payload: QueryPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Alias route for backward compatibility with CommandMenu.
    """
    text = generate_grounded_response(payload.query, tenant_id, db)
    return AIResponse(answer=text, response=text, action_suggested="None")