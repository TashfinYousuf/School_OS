from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.question_paper import QuestionPaper
from app.models.tenant import SchoolProfile

router = APIRouter()

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
client = genai.Client(api_key=clean_api_key)

class GenerateRequest(BaseModel):
    title: str
    class_name: str
    subject: str
    exam_term: str # e.g. "First Term Examination 2026"
    total_marks: int = 50
    duration: str = "1.5 Hours"
    chapters_or_topics: str
    difficulty: str = "Medium" # Easy, Medium, Hard
    question_types: Optional[str] = "MCQ, Fill in the blanks, Short Questions, Creative/Descriptive"

class SavePaperRequest(BaseModel):
    title: str
    class_name: str
    subject: str
    total_marks: int
    duration: str
    instructions: str
    content: str

@router.post("/generate")
def generate_question_paper_ai(
    req: GenerateRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    # 🚀 ডায়নামিক স্কুল প্রোফাইল লোড (Zero Hardcoding)
    school = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    school_name = school.school_name if school else "Educational Institution"

    """
    Generates a curriculum-aligned question paper blueprint using Gemini 2.5 Flash.
    """
    system_instruction = (
        "You are an expert primary & secondary school examination setter for Bangladesh curriculum (NCTB). "
        "Your task is to draft a clean, high-standard, error-free question paper for school students. "
        "Strictly adhere to the total marks specified. "
        "Format the output professionally with clear sections (e.g., Section A: Objective, Section B: Short Questions, Section C: Descriptive). "
        "Indicate marks beside each question in brackets like [5] or [1x5=5]. "
        "Use English or Bangla matching the medium of instruction for the requested subject."
    )

    prompt = (
        f"Institution: {req.title}\n"
        f"Exam: {req.exam_term}\n"
        f"Class: {req.class_name}\n"
        f"Subject: {req.subject}\n"
        f"Total Marks: {req.total_marks}\n"
        f"Time: {req.duration}\n"
        f"Topics/Chapters to cover: {req.chapters_or_topics}\n"
        f"Target Difficulty: {req.difficulty}\n"
        f"Included Question Types: {req.question_types}\n\n"
        "Draft the full question paper now. Do NOT include meta commentary or introductory remarks. Output ONLY the printable exam questions."
    )

    try:
        # Google AFC Warning Fix: Use chat.send_message instead of models.generate_content
        chat = client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
        )
        response = chat.send_message(prompt)

        return {
            "title": f"{req.exam_term} — {req.subject}",
            "class_name": req.class_name,
            "subject": req.subject,
            "total_marks": req.total_marks,
            "duration": req.duration,
            "instructions": "Answer all the questions. Figures in the right margin indicate full marks.",
            "content": response.text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Blueprint Engine Error: {str(e)}")


@router.post("/", status_code=status.HTTP_201_CREATED)
def save_question_paper(
    payload: SavePaperRequest,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher"]))
):
    paper = QuestionPaper(
        tenant_id=tenant_id,
        title=payload.title,
        class_name=payload.class_name,
        subject=payload.subject,
        total_marks=payload.total_marks,
        duration=payload.duration,
        instructions=payload.instructions,
        content=payload.content,
        status="Finalized",
        created_by=claims["user_id"]
    )
    db.add(paper)
    db.commit()
    db.refresh(paper)
    return {"message": "Paper saved successfully", "id": paper.id}

@router.get("/")
def list_saved_papers(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    return db.query(QuestionPaper).filter(QuestionPaper.tenant_id == tenant_id).order_by(QuestionPaper.created_at.desc()).all()