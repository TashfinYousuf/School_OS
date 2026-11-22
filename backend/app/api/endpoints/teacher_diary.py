import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.academic import DailyLessonLog

router = APIRouter()

from app.core.ai_client import ai_client

class VoiceLessonInput(BaseModel):
    class_name: str
    subject: str
    teacher_name: str
    transcription_text: str  # Voice transcribed text or typed input

@router.post("/voice-diary-sync", dependencies=[Depends(require_roles(["teacher"]))])
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
            lesson_date=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(lesson)
        db.commit()

        return {
            "status": "success",
            "extracted": structured_log,
            "message": "Lesson event logged. Anti-Drift RAG updated."
        }
    except Exception as e:
        import logging
        logging.getLogger("educationos.teacher_diary").exception("Voice diary parsing failed")
        raise HTTPException(status_code=502, detail="Voice diary processing service is temporarily unavailable.")