import uuid
import json
import re
import os
import datetime
import logging

from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator
from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.live_exam import LiveExam
from app.services.ai_gateway import ai_gateway, AIGenerationError
from app.services.institution import get_institution_profile
from dotenv import load_dotenv, find_dotenv

router = APIRouter()

logger = logging.getLogger(__name__)

load_dotenv(find_dotenv(), override=True)

raw_api_key = (
    getattr(settings, "GEMINI_API_KEY", None) or 
    getattr(settings, "GOOGLE_API_KEY", None) or 
    os.getenv("GEMINI_API_KEY") or 
    os.getenv("GOOGLE_API_KEY") or 
    ""
)
clean_api_key = str(raw_api_key).strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key) if clean_api_key and len(clean_api_key) > 10 else None


class GenerateQuestionPaperPayload(BaseModel):
    subject: str = Field(..., min_length=2, max_length=80, pattern=r"^[\w\s.,:()&/'’\-\u0980-\u09FF]+$")
    class_name: Optional[str] = None
    program_name: Optional[str] = None
    topic: Optional[str] = Field(None, max_length=120, pattern=r"^[\w\s.,:()&/'’\-\u0980-\u09FF]+$")
    topic_title: Optional[str] = None
    question_count: Optional[int] = Field(5, ge=2, le=50)
    total_marks: Optional[float] = 25.0
    duration_minutes: Optional[int] = Field(15, ge=1, le=180)
    difficulty: Optional[str] = Field("Medium", pattern=r"^(Easy|Medium|Hard)$")
    negative_marking_rate: Optional[float] = Field(0.25, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def reconcile_fields(self):
        resolved_topic = self.topic or self.topic_title or "General Syllabus"
        self.topic = resolved_topic
        self.topic_title = resolved_topic

        resolved_class = self.class_name or self.program_name or "General"
        self.class_name = resolved_class
        self.program_name = resolved_class

        if not self.total_marks and self.question_count:
            self.total_marks = float(self.question_count * 1.0)
        return self


def extract_clean_json_array(text: str) -> List[Dict[str, Any]]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    match = re.search(r'\[.*\]', cleaned, re.DOTALL)
    if match:
        cleaned = match.group(0)

    return json.loads(cleaned)


# 1. List All Question Paper Drafts
@router.get("/")
def list_question_papers(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    papers = db.query(LiveExam).filter(
        LiveExam.tenant_id == str(tenant_id)
    ).order_by(LiveExam.created_at.desc()).limit(50).all()

    results = []
    for p in papers:
        q_list = p.questions_payload or []
        if isinstance(q_list, str):
            try:
                q_list = json.loads(q_list)
            except Exception:
                q_list = []

        results.append({
            "id": str(p.id),
            "title": p.title,
            "total_marks": p.total_marks,
            "duration_minutes": p.duration_minutes,
            "negative_marking_rate": p.negative_marking_rate,
            "total_questions": len(q_list),
            "is_published": bool(p.is_published),
            "status": "Published" if p.is_published else "Draft / Review Required",
            "created_at": p.created_at.strftime("%d %b, %Y • %I:%M %p") if p.created_at else "Recent",
            "sample_question": q_list[0].get("question") if q_list else "No questions in draft."
        })
    return results


# 2. Get Single Full Question Paper Draft with Questions & Answers
@router.get("/{paper_id}")
def get_single_question_paper(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    paper = db.query(LiveExam).filter(
        LiveExam.id == paper_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Question paper draft not found.")

    q_list = paper.questions_payload or []
    if isinstance(q_list, str):
        try:
            q_list = json.loads(q_list)
        except Exception:
            q_list = []

    inst = get_institution_profile(db, tenant_id)
    campus_address = " • ".join(
        p for p in (inst.address, f"Phone: {inst.phone}" if inst.phone else None) if p
    )

    return {
        "id": str(paper.id),
        "title": paper.title,
        "total_marks": paper.total_marks,
        "duration_minutes": paper.duration_minutes,
        "negative_marking_rate": paper.negative_marking_rate,
        "institution_name": inst.name,
        "campus_address": campus_address,
        "created_at": paper.created_at.strftime("%d %b, %Y") if paper.created_at else "Today",
        "questions": q_list
    }

# 3. Approve and Publish Question Paper Draft
@router.post("/{paper_id}/approve", dependencies=[Depends(require_roles(["admin", "teacher"]))])
def approve_and_publish_question_paper(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Teacher / Admin Review Sign-Off: Transitions draft AI blueprint to approved live exam.
    Enforces human-in-the-loop validation prior to student exposure.
    """
    paper = db.query(LiveExam).filter(
        LiveExam.id == paper_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Question paper draft not found.")

    paper.is_published = True
    db.commit()
    db.refresh(paper)

    return {
        "status": "APPROVED_AND_PUBLISHED",
        "paper_id": str(paper.id),
        "title": paper.title,
        "is_published": True,
        "message": "Question paper successfully approved by educator and published to live exam stream."
    }


@router.post("/generate", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin", "teacher"]))])
def generate_question_paper_endpoint(
    payload: GenerateQuestionPaperPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Production-Hardened AI Question Paper Generator.
    Guarantees:
      1. Zero Domain Contamination (e.g. No Physics in Organic Chemistry).
      2. ZERO Fake Preset Fallbacks.
      3. Strict Deterministic Schema Enforcement.
    """
    q_count = max(min(payload.question_count or 5, 25), 2)
    duration = payload.duration_minutes or 15

    try:
        # Route through AI Gateway with Strict Domain Verification
        questions = ai_gateway.generate_exam_mcqs(
            subject=payload.subject,
            topic=payload.topic,
            question_count=q_count,
            difficulty=payload.difficulty,
            program_name=payload.class_name
        )
    except AIGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{exc.message} Please create questions manually or choose from verified institutional Question Bank."
        )

    # Persist authoritative examination record
    now = datetime.datetime.now(datetime.timezone.utc)
    exam_title = f"{payload.subject}: {payload.topic} ({payload.difficulty})"

    new_exam = LiveExam(
        tenant_id=str(tenant_id),
        title=exam_title,
        total_marks=float(len(questions) * 1.0),
        duration_minutes=duration,
        negative_marking_rate=payload.negative_marking_rate or 0.25,
        start_time=now,
        end_time=now + datetime.timedelta(days=14),
        is_published=False,  # Held for review to prevent unverified AI content going live (F6)
        questions_payload=questions
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    return {
        "message": "Question paper generated and validated successfully",
        "paper_id": str(new_exam.id),
        "id": str(new_exam.id),
        "title": new_exam.title,
        "total_marks": new_exam.total_marks,
        "duration_minutes": new_exam.duration_minutes,
        "total_questions": len(questions),
        "questions": questions
    }


# 4. Delete Question Paper Draft
@router.delete("/{paper_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_roles(["admin"]))])
def delete_question_paper(
    paper_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    paper = db.query(LiveExam).filter(
        LiveExam.id == paper_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()

    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found.")

    db.delete(paper)
    db.commit()
    return None