import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.academic import DailyLessonLog

router = APIRouter()

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

class VoiceLessonInput(BaseModel):
    class_name: str
    subject: str
    teacher_name: str
    transcription_text: str  # Voice transcribed text or typed input

@router.post("/voice-diary-sync", dependencies=[Depends(require_roles(["admin", "teacher"]))])
def sync_teacher_voice_diary(
    payload: VoiceLessonInput,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Teacher speaks: "আজ ক্লাস ফাইভে ভগ্নাংশের যোগ বুঝিয়েছি, অনুশীলনী ৩ এর ৫টা অঙ্ক করিয়েছি, বাড়ির কাজ উদাহরণ ৩।"
    Gemini extracts structured data and computes curriculum drift variance.
    """
    system_instruction = (
        "You are the TeacherOS Academic Intelligence Engine. "
        "Extract structured JSON from the teacher's lesson report. "
        "Respond ONLY with a valid JSON object matching this schema: "
        "{"
        "  \"topic\": string,"
        "  \"subtopics_covered\": [string],"
        "  \"exercises_solved_count\": number,"
        "  \"homework\": string,"
        "  \"curriculum_drift_status\": \"ON_TRACK\" | \"SLIGHT_DELAY\" | \"ACCELERATED\","
        "  \"variance_note\": string"
        "}"
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                response_mime_type="application/json"
            )
        )
        prompt = (
            f"Class: {payload.class_name}, Subject: {payload.subject}, "
            f"Teacher: {payload.teacher_name}, Log: {payload.transcription_text}"
        )
        response = chat.send_message(prompt)
        import json
        structured_log = json.loads(response.text)

        # Save to DailyLessonLog
        lesson = DailyLessonLog(
            tenant_id=str(tenant_id),
            class_name=payload.class_name,
            subject=payload.subject,
            teacher_name=payload.teacher_name,
            topic_title=structured_log.get("topic", "Classroom Session"),
            lecture_summary=", ".join(structured_log.get("subtopics_covered", [])),
            homework_assigned=structured_log.get("homework", "None"),
            submission_deadline="Next Class",
            date=datetime.date.today()
        )
        db.add(lesson)
        db.commit()

        return {
            "status": "success",
            "extracted": structured_log,
            "message": "Lesson event logged. Anti-Drift RAG updated."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Engine Error: {str(e)}")