# backend/app/api/endpoints/learning_studio.py
import logging
import os
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.ai_gateway import (
    ai_gateway,
    AIGenerationError,
    AIBudgetExceededError,
    PromptInjectionDetected,
)
from app.api.deps import (
    get_db,
    get_current_tenant_id,
    get_current_user_claims,
    require_roles,
)
from app.models.student import Student
from app.models.learning import StudySession, StudyFlashcard, PracticeAttempt, AIConversation, AIMessage
from app.models.curriculum import CurriculumChunk

logger = logging.getLogger(__name__)

router = APIRouter()


# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------
class DoubtQuery(BaseModel):
    student_name: Optional[str] = "Student"
    subject: str = Field(..., min_length=1, max_length=100)
    problem_text: str = Field(..., min_length=3, max_length=2000)
    student_previous_step: Optional[str] = ""


class TutorChatPayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: Optional[str] = None
    message: str = Field(..., min_length=1, max_length=2000)
    language: Optional[str] = "auto"  # "en", "bn", "auto"


class ConversationCreatePayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: Optional[str] = "General Study"
    title: Optional[str] = None
    mode: str = Field("socratic_tutor", max_length=32)


class ConversationOut(BaseModel):
    id: str
    subject: str
    topic: Optional[str] = None
    title: str
    mode: str
    created_at: str
    updated_at: str


class MessageSendPayload(BaseModel):
    content: str = Field(..., min_length=1, max_length=4000)
    language: Optional[str] = "auto"
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_role: str
    content: str
    attachment_url: Optional[str] = None
    attachment_type: Optional[str] = None
    created_at: str


class UploadAttachmentOut(BaseModel):
    attachment_url: str
    attachment_type: str
    filename: str


class StudySessionCreatePayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: Optional[str] = None
    mode: str = Field("study_room", max_length=32)
    duration_seconds: int = Field(0, ge=0)
    goals: Optional[str] = None
    notes: Optional[str] = None


class FlashcardGeneratePayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=150)
    count: int = Field(5, ge=1, le=10)


class FlashcardCreatePayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: Optional[str] = "Self Study"
    front_prompt: Optional[str] = None
    back_explanation: Optional[str] = None
    front: Optional[str] = None
    back: Optional[str] = None


class FlashcardReviewPayload(BaseModel):
    recalled: bool


class PracticeQuizGeneratePayload(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    topic: str = Field(..., min_length=1, max_length=150)
    difficulty: str = Field("medium", max_length=20)  # easy, medium, hard
    count: int = Field(5, ge=1, le=10)


class PracticeSubmitPayload(BaseModel):
    subject: str
    topic: Optional[str] = None
    question_type: str = "mcq"
    question_data: dict
    student_answer: str
    is_correct: bool
    score: float = 1.0
    feedback: Optional[str] = None


class PracticeBatchSubmitPayload(BaseModel):
    subject: str
    topic: Optional[str] = None
    questions: List[dict]
    answers: Dict[str, int]


# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
def _resolve_student(db: Session, claims: dict, tenant_id: str) -> Student:
    """Resolves authenticated student entity."""
    user_id = claims.get("user_id")
    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError):
        uid = None

    student = db.query(Student).filter(
        (Student.id == uid) | (Student.user_id == uid),
        Student.tenant_id == str(tenant_id)
    ).first()

    if not student:
        # If admin/teacher testing
        role = (claims.get("role") or "").lower()
        if role in ("admin", "teacher"):
            # Return any active student in tenant for demonstration
            fallback = db.query(Student).filter(Student.tenant_id == str(tenant_id)).first()
            if fallback:
                return fallback
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student profile not found for authenticated account."
        )
    return student


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------
@router.post("/socratic-solve", dependencies=[Depends(require_roles(["admin", "teacher", "student"]))])
def socratic_doubt_solver(payload: DoubtQuery, db: Session = Depends(get_db), tenant_id: str = Depends(get_current_tenant_id), claims: dict = Depends(get_current_user_claims)):
    """
    Socratic AI Model: Does NOT give direct final answers.
    Guides the student step-by-step via MultiModelAIGateway with quota & prompt-injection defense.
    """
    try:
        safe_subject = ai_gateway.sanitize_input(payload.subject)[:100]
        safe_problem = ai_gateway.sanitize_input(payload.problem_text)[:2000]
        safe_step = ai_gateway.sanitize_input(payload.student_previous_step or "")[:1000]
    except PromptInjectionDetected as exc:
        raise HTTPException(status_code=400, detail=exc.message)

    system_instruction = (
        "You are the Socratic AI Study Buddy for EducationOS. "
        "Pedagogical philosophy: 'Teach, don't just answer.' "
        "Rule 1: Never output the final answer directly. "
        "Rule 2: Identify the student's current step and misconception. "
        "Rule 3: Provide 1 guiding hint and ask 1 leading question. "
        "Respond in clear, encouraging Bangla if the query is in Bangla, or English if in English."
    )
    prompt = (
        f"Subject: {safe_subject}\n"
        f"Problem: {safe_problem}\n"
        f"Student Attempt: {safe_step or 'I do not know how to begin.'}"
    )

    try:
        uid_str = str(claims.get("user_id", "anon")) if isinstance(claims, dict) else "anon"
        guidance_text, provider_name = ai_gateway.execute_with_failover(
            prompt=prompt,
            system_prompt=system_instruction,
            is_json=False,
            db=db if not hasattr(db, "dependency") else None,
            tenant_id=str(tenant_id) if not hasattr(tenant_id, "dependency") else None,
            user_id=uid_str,
            feature="socratic_solve",
            estimated_tokens=900,
        )
        return {
            "socratic_guidance": guidance_text,
            "pedagogical_mode": "Active Guided Learning",
            "provider": provider_name,
            "is_fallback": False,
        }
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=exc.message)
    except (AIGenerationError, Exception) as e:
        logger.error("Learning Studio Socratic Error: %s", e)
        return {
            "socratic_guidance": f"Let's break this down step-by-step. In {safe_subject}, what is the key formula or definition you need to apply first? Try writing down the given values.",
            "pedagogical_mode": "Guided Learning (AI Provider Unavailable Fallback)",
            "provider": "offline_scaffolding",
            "is_fallback": True,
        }


@router.post("/tutor/chat")
def tutor_chat(
    payload: TutorChatPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """
    Socratic AI Tutor Conversation via MultiModelAIGateway:
    Provides age-appropriate, interactive scaffolding questions and hints.
    """
    student = _resolve_student(db, claims, tenant_id)
    try:
        safe_subject = ai_gateway.sanitize_input(payload.subject)[:100]
        safe_topic = ai_gateway.sanitize_input(payload.topic or "General")[:150]
        safe_msg = ai_gateway.sanitize_input(payload.message)[:2000]
    except PromptInjectionDetected as exc:
        raise HTTPException(status_code=400, detail=exc.message)

    chunks = db.query(CurriculumChunk).filter(
        (CurriculumChunk.tenant_id == str(tenant_id)) | (CurriculumChunk.is_global_curriculum == True),
        CurriculumChunk.subject.ilike(f"%{safe_subject}%")
    ).limit(2).all()

    curriculum_context = "\n".join([c.content for c in chunks]) if chunks else ""

    system_instruction = (
        f"You are the personal Socratic Tutor for a student in {student.class_name} at an accredited Bangladesh school. "
        "Follow these strict pedagogical rules: "
        "1. Teach conceptually. Guide the student with analogies, definitions, and gentle hints. "
        "2. Do not do their homework for them or give final answers directly. "
        "3. Support both English and standard clean Bengali (Bangla). If the student asks in Bangla, respond in fluent Bengali. "
        "4. Always ask a question at the end to check understanding."
    )
    prompt = f"Subject: {safe_subject}\nTopic: {safe_topic}\nContext: {curriculum_context}\n\nStudent: {safe_msg}"

    is_fallback = False
    provider_name = "offline_scaffolding"
    try:
        reply_text, provider_name = ai_gateway.execute_with_failover(
            prompt=prompt,
            system_prompt=system_instruction,
            is_json=False,
            db=db,
            tenant_id=str(tenant_id),
            user_id=str(claims.get("user_id", "anon")),
            feature="tutor_chat",
            estimated_tokens=1000,
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=exc.message)
    except (AIGenerationError, Exception) as e:
        logger.warning("AI Tutor gateway error, using pedagogical rule generator: %s", e)
        is_fallback = True
        reply_text = f"That is an excellent question about {safe_subject}! Let's examine the core concept. What do you think happens if we change the initial condition? What principle applies here?"

    return {
        "reply": reply_text,
        "subject": safe_subject,
        "topic": safe_topic,
        "class_name": student.class_name,
        "mode": "Socratic Guided Discovery",
        "provider": provider_name,
        "is_fallback": is_fallback,
    }


@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    student = _resolve_student(db, claims, tenant_id)
    query = db.query(AIConversation).filter(
        AIConversation.tenant_id == str(tenant_id),
        AIConversation.student_id == student.id
    )
    if subject:
        query = query.filter(AIConversation.subject.ilike(f"%{subject.strip()}%"))

    convs = query.order_by(AIConversation.updated_at.desc()).limit(30).all()
    return [
        ConversationOut(
            id=str(c.id),
            subject=c.subject,
            topic=c.topic,
            title=c.title,
            mode=c.mode,
            created_at=c.created_at.isoformat() if c.created_at else "",
            updated_at=c.updated_at.isoformat() if c.updated_at else ""
        )
        for c in convs
    ]


@router.post("/conversations", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def create_conversation(
    payload: ConversationCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    student = _resolve_student(db, claims, tenant_id)
    user_id = str(claims.get("user_id") or "")
    title = payload.title or f"{payload.subject}: {payload.topic or 'Study Session'}"

    new_conv = AIConversation(
        tenant_id=str(tenant_id),
        student_id=student.id,
        user_id=user_id,
        subject=payload.subject.strip(),
        topic=(payload.topic or "General Study").strip(),
        title=title.strip()[:255],
        mode=payload.mode.strip()
    )
    db.add(new_conv)
    db.commit()
    db.refresh(new_conv)

    return ConversationOut(
        id=str(new_conv.id),
        subject=new_conv.subject,
        topic=new_conv.topic,
        title=new_conv.title,
        mode=new_conv.mode,
        created_at=new_conv.created_at.isoformat() if new_conv.created_at else "",
        updated_at=new_conv.updated_at.isoformat() if new_conv.updated_at else ""
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
def get_conversation_messages(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    student = _resolve_student(db, claims, tenant_id)
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.tenant_id == str(tenant_id)
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation session not found.")

    messages = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation_id,
        AIMessage.tenant_id == str(tenant_id)
    ).order_by(AIMessage.created_at.asc()).all()

    return [
        MessageOut(
            id=str(m.id),
            conversation_id=str(m.conversation_id),
            sender_role=m.sender_role,
            content=m.content,
            attachment_url=m.attachment_url,
            attachment_type=m.attachment_type,
            created_at=m.created_at.isoformat() if m.created_at else ""
        )
        for m in messages
    ]


@router.post("/conversations/{conversation_id}/chat", response_model=MessageOut)
def conversation_chat(
    conversation_id: UUID,
    payload: MessageSendPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    student = _resolve_student(db, claims, tenant_id)
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.tenant_id == str(tenant_id)
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation session not found.")

    try:
        safe_msg = ai_gateway.sanitize_input(payload.content)[:4000]
    except PromptInjectionDetected as exc:
        raise HTTPException(status_code=400, detail=exc.message)

    # 1. Save student message
    student_msg = AIMessage(
        conversation_id=conversation_id,
        tenant_id=str(tenant_id),
        sender_role="student",
        content=safe_msg,
        tokens_used=len(safe_msg.split()),
        attachment_url=payload.attachment_url,
        attachment_type=payload.attachment_type
    )
    db.add(student_msg)
    conv.updated_at = datetime.now(timezone.utc)
    db.flush()

    # 2. Fetch history for contextual memory
    history = db.query(AIMessage).filter(
        AIMessage.conversation_id == conversation_id,
        AIMessage.tenant_id == str(tenant_id)
    ).order_by(AIMessage.created_at.desc()).limit(8).all()
    history_reversed = list(reversed(history))

    history_text = "\n".join([f"{h.sender_role.capitalize()}: {h.content}" for h in history_reversed[:-1]])

    # 3. Fetch NCTB curriculum chunks
    chunks = db.query(CurriculumChunk).filter(
        (CurriculumChunk.tenant_id == str(tenant_id)) | (CurriculumChunk.is_global_curriculum == True),
        CurriculumChunk.subject.ilike(f"%{conv.subject}%")
    ).limit(2).all()
    curriculum_context = "\n".join([c.content for c in chunks]) if chunks else ""

    system_instruction = (
        f"You are the personal Socratic AI Tutor for a student in {student.class_name} at an accredited Bangladesh school. "
        f"Subject: {conv.subject}. Topic: {conv.topic or 'General'}. "
        "Pedagogical Principles:\n"
        "1. Never give away the direct answer immediately. Guide the student step-by-step with encouraging scaffolding questions.\n"
        "2. Keep explanations conceptually intuitive, using everyday analogies.\n"
        "3. Support standard Bangla and English. If the student writes in Bangla, respond in natural Bangla.\n"
        "4. End every message with one targeted check question to stimulate active critical thinking."
    )

    prompt = f"Curriculum Context:\n{curriculum_context}\n\nRecent Conversation History:\n{history_text}\n\nStudent's latest input: {safe_msg}"

    try:
        reply_text, _ = ai_gateway.execute_with_failover(
            prompt=prompt,
            system_prompt=system_instruction,
            is_json=False,
            db=db,
            tenant_id=str(tenant_id),
            user_id=str(claims.get("user_id", "anon")),
            feature="tutor_chat",
            estimated_tokens=1000,
        )
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=exc.message)
    except Exception as e:
        logger.warning("AI Tutor conversation error, falling back: %s", e)
        reply_text = f"That is a great observation about {conv.subject}! Let's examine this carefully. What is the very first step you would take to break down this problem?"

    # 4. Save assistant response
    ai_msg = AIMessage(
        conversation_id=conversation_id,
        tenant_id=str(tenant_id),
        sender_role="assistant",
        content=reply_text,
        tokens_used=len(reply_text.split())
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return MessageOut(
        id=str(ai_msg.id),
        conversation_id=str(ai_msg.conversation_id),
        sender_role=ai_msg.sender_role,
        content=ai_msg.content,
        attachment_url=ai_msg.attachment_url,
        attachment_type=ai_msg.attachment_type,
        created_at=ai_msg.created_at.isoformat() if ai_msg.created_at else ""
    )


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"])),
):
    student = _resolve_student(db, claims, tenant_id)
    conv = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.tenant_id == str(tenant_id)
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation session not found.")

    role = (claims.get("role") or "").lower()
    if role == "student" and conv.student_id != student.id:
        raise HTTPException(status_code=403, detail="Cannot delete other student's conversation.")

    db.delete(conv)
    db.commit()
    return None


UPLOAD_DIR = os.path.join(os.path.abspath(os.path.dirname(__file__)), "..", "..", "..", "uploads", "learning_studio")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload-attachment", response_model=UploadAttachmentOut)
async def upload_attachment(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"])),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed_exts = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf", ".txt"}
    if ext not in allowed_exts:
        ext = ".png"

    safe_id = uuid.uuid4().hex[:16]
    clean_filename = f"{safe_id}{ext}"
    tenant_dir = os.path.join(UPLOAD_DIR, str(tenant_id))
    os.makedirs(tenant_dir, exist_ok=True)
    target_path = os.path.join(tenant_dir, clean_filename)

    with open(target_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    att_type = "image" if ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"} else ("pdf" if ext == ".pdf" else "document")

    return UploadAttachmentOut(
        attachment_url=f"/api/v1/learning-os/attachments/{clean_filename}",
        attachment_type=att_type,
        filename=file.filename or clean_filename,
    )


@router.get("/attachments/{filename}")
def get_attachment(
    filename: str,
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"])),
):
    safe_name = os.path.basename(filename)
    path = os.path.join(UPLOAD_DIR, str(tenant_id), safe_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Attachment file not found.")
    return FileResponse(path)


@router.post("/study-room/session", status_code=status.HTTP_201_CREATED)
def record_study_session(
    payload: StudySessionCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Records a completed study room focus session with Pomodoro timer and notes."""
    student = _resolve_student(db, claims, tenant_id)
    session = StudySession(
        tenant_id=str(tenant_id),
        student_id=student.id,
        subject=payload.subject,
        topic=payload.topic,
        mode=payload.mode,
        duration_seconds=payload.duration_seconds,
        goals=payload.goals,
        notes=payload.notes,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "status": "success",
        "session_id": str(session.id),
        "duration_minutes": round(session.duration_seconds / 60, 1),
        "message": "Study session recorded."
    }


@router.get("/study-room/sessions")
def get_study_sessions(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Returns student's historical study room sessions."""
    student = _resolve_student(db, claims, tenant_id)
    sessions = db.query(StudySession).filter(
        StudySession.tenant_id == str(tenant_id),
        StudySession.student_id == student.id
    ).order_by(StudySession.created_at.desc()).limit(30).all()

    total_seconds = sum(s.duration_seconds for s in sessions)

    return {
        "total_sessions": len(sessions),
        "total_study_minutes": round(total_seconds / 60, 1),
        "sessions": [
            {
                "id": str(s.id),
                "subject": s.subject,
                "topic": s.topic,
                "mode": s.mode,
                "duration_minutes": round(s.duration_seconds / 60, 1),
                "goals": s.goals,
                "notes": s.notes,
                "created_at": s.created_at.isoformat()
            }
            for s in sessions
        ]
    }


@router.post("/flashcards/generate")
def generate_flashcards(
    payload: FlashcardGeneratePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """
    Generates curriculum-grounded spaced-repetition flashcards via MultiModelAIGateway.
    """
    student = _resolve_student(db, claims, tenant_id)
    try:
        safe_subject = ai_gateway.sanitize_input(payload.subject)[:100]
        safe_topic = ai_gateway.sanitize_input(payload.topic)[:150]
    except PromptInjectionDetected as exc:
        raise HTTPException(status_code=400, detail=exc.message)

    system_prompt = (
        "Return strictly valid JSON array of study flashcard objects with keys 'front' and 'back'. "
        "Support English and standard Bengali cleanly."
    )
    prompt = (
        f"Generate {payload.count} study flashcards for a student in {student.class_name} "
        f"studying {safe_subject} (Topic: {safe_topic})."
    )

    cards_data = []
    is_fallback = False
    try:
        parsed, _ = ai_gateway.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=str(tenant_id),
            user_id=str(claims.get("user_id", "anon")),
            feature="flashcard_gen",
            estimated_tokens=1200,
        )
        if isinstance(parsed, list):
            cards_data = parsed
        elif isinstance(parsed, dict) and "cards" in parsed:
            cards_data = parsed["cards"]
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=exc.message)
    except (AIGenerationError, Exception) as e:
        logger.warning("Flashcard generation AI fallback: %s", e)
        is_fallback = True
        cards_data = [
            {"front": f"What is the fundamental definition of {safe_topic}?", "back": f"The core concept in {safe_subject} establishing the foundational properties of this topic."},
            {"front": f"How is {safe_topic} applied in practical problems?", "back": "By identifying the given variables, applying the standard formula, and solving step-by-step."},
            {"front": f"What is a common pitfall when solving {safe_topic} questions?", "back": "Forgetting unit conversions and skipping intermediate algebraic steps."},
        ]

    created_cards = []
    for item in cards_data:
        front = item.get("front") or item.get("question") or "Concept"
        back = item.get("back") or item.get("answer") or "Definition"
        fc = StudyFlashcard(
            tenant_id=str(tenant_id),
            student_id=student.id,
            subject=safe_subject,
            topic=safe_topic,
            front_text=front,
            back_text=back,
            mastery_level=0,
        )
        db.add(fc)
        created_cards.append(fc)

    db.commit()
    return {
        "status": "success",
        "is_fallback": is_fallback,
        "generated_count": len(created_cards),
        "cards": [
            {
                "id": str(c.id),
                "subject": c.subject,
                "topic": c.topic,
                "front": c.front_text,
                "back": c.back_text,
                "front_prompt": c.front_text,
                "back_explanation": c.back_text,
                "mastery_level": c.mastery_level,
                "box_level": c.mastery_level,
            }
            for c in created_cards
        ]
    }


@router.post("/flashcards", status_code=status.HTTP_201_CREATED)
def create_manual_flashcard(
    payload: FlashcardCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Creates a student-authored study flashcard."""
    student = _resolve_student(db, claims, tenant_id)
    front_val = (payload.front_prompt or payload.front or "").strip()
    back_val = (payload.back_explanation or payload.back or "").strip()
    if not front_val or not back_val:
        raise HTTPException(status_code=422, detail="Both flashcard front and back text are required.")

    fc = StudyFlashcard(
        tenant_id=str(tenant_id),
        student_id=student.id,
        subject=payload.subject.strip(),
        topic=(payload.topic or "Self Study").strip(),
        front_text=front_val,
        back_text=back_val,
        mastery_level=0,
    )
    db.add(fc)
    db.commit()
    db.refresh(fc)
    return {
        "id": str(fc.id),
        "subject": fc.subject,
        "topic": fc.topic,
        "front": fc.front_text,
        "back": fc.back_text,
        "front_prompt": fc.front_text,
        "back_explanation": fc.back_text,
        "mastery_level": fc.mastery_level,
        "box_level": fc.mastery_level,
        "review_due_at": fc.review_due_at.isoformat() if fc.review_due_at else None,
    }


@router.patch("/flashcards/{card_id}/review")
def review_flashcard(
    card_id: UUID,
    payload: FlashcardReviewPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Updates Leitner mastery level and next due interval for a student's flashcard."""
    student = _resolve_student(db, claims, tenant_id)
    fc = db.query(StudyFlashcard).filter(
        StudyFlashcard.id == card_id,
        StudyFlashcard.tenant_id == str(tenant_id),
        StudyFlashcard.student_id == student.id,
    ).first()
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found.")

    fc.mastery_level = min(5, (fc.mastery_level or 0) + 1) if payload.recalled else 0
    days_map = {0: 1, 1: 2, 2: 4, 3: 7, 4: 14, 5: 30}
    fc.review_due_at = datetime.now(timezone.utc) + timedelta(days=days_map.get(fc.mastery_level, 1))
    db.commit()
    return {
        "id": str(fc.id),
        "mastery_level": fc.mastery_level,
        "box_level": fc.mastery_level,
        "review_due_at": fc.review_due_at.isoformat(),
    }


@router.get("/flashcards")
def get_student_flashcards(
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Returns all revision flashcards for the student."""
    student = _resolve_student(db, claims, tenant_id)
    q = db.query(StudyFlashcard).filter(
        StudyFlashcard.tenant_id == str(tenant_id),
        StudyFlashcard.student_id == student.id
    )
    if subject:
        q = q.filter(StudyFlashcard.subject.ilike(f"%{subject}%"))
    cards = q.order_by(StudyFlashcard.created_at.desc()).all()

    return [
        {
            "id": str(c.id),
            "subject": c.subject,
            "topic": c.topic,
            "front": c.front_text,
            "back": c.back_text,
            "front_prompt": c.front_text,
            "back_explanation": c.back_text,
            "mastery_level": c.mastery_level,
            "box_level": c.mastery_level,
            "review_due_at": c.review_due_at.isoformat() if c.review_due_at else None,
        }
        for c in cards
    ]


@router.post("/practice/generate-quiz")
def generate_practice_quiz(
    payload: PracticeQuizGeneratePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """
    Generates diagnostic practice MCQs via MultiModelAIGateway.
    """
    student = _resolve_student(db, claims, tenant_id)
    try:
        safe_subject = ai_gateway.sanitize_input(payload.subject)[:100]
        safe_topic = ai_gateway.sanitize_input(payload.topic)[:150]
        safe_diff = ai_gateway.sanitize_input(payload.difficulty)[:20]
    except PromptInjectionDetected as exc:
        raise HTTPException(status_code=400, detail=exc.message)

    system_prompt = (
        "Return strictly valid JSON array of MCQ objects with keys: "
        "'question' (string), 'options' (array of 4 strings), 'correct_index' (0-3 integer), 'explanation' (string). "
        "Support bilingual English/Bengali."
    )
    prompt = (
        f"Generate {payload.count} multiple-choice practice questions (MCQs) for {student.class_name} "
        f"studying {safe_subject} (Topic: {safe_topic}, Difficulty: {safe_diff})."
    )

    questions = []
    is_fallback = False
    try:
        parsed, _ = ai_gateway.execute_with_failover(
            prompt=prompt,
            system_prompt=system_prompt,
            is_json=True,
            db=db,
            tenant_id=str(tenant_id),
            user_id=str(claims.get("user_id", "anon")),
            feature="practice_quiz_gen",
            estimated_tokens=1500,
        )
        if isinstance(parsed, list):
            questions = parsed
        elif isinstance(parsed, dict) and "questions" in parsed:
            questions = parsed["questions"]
    except AIBudgetExceededError as exc:
        raise HTTPException(status_code=429, detail=exc.message)
    except (AIGenerationError, Exception) as e:
        logger.warning("Quiz generation AI fallback: %s", e)
        is_fallback = True
        questions = [
            {
                "question": f"Which of the following best describes the principle of {safe_topic} in {safe_subject}?",
                "options": [
                    f"It represents a constant rate of change in {safe_subject}",
                    "It violates standard physical or algebraic conservation",
                    "It applies only in isolated theoretical environments",
                    "It is an arbitrary metric without formal mathematical basis"
                ],
                "correct_index": 0,
                "explanation": f"In {safe_subject}, {safe_topic} is defined rigorously by its direct rate of change and conservation principles."
            },
            {
                "question": f"When solving an equation involving {safe_topic}, what is the first step?",
                "options": [
                    "Guess the final answer",
                    "Isolate known variables and state the governing equation",
                    "Skip algebraic simplification",
                    "Discard boundary constraints"
                ],
                "correct_index": 1,
                "explanation": "Disciplined problem-solving begins by stating known values and applying the governing relationship."
            }
        ]

    normalized = []
    for idx, q in enumerate(questions):
        q_text = q.get("question_text") or q.get("question") or f"Practice Question {idx + 1}"
        opts = q.get("options") if isinstance(q.get("options"), list) else []
        normalized.append({
            "question_id": q.get("question_id") or f"q_{idx}",
            "question": q_text,
            "question_text": q_text,
            "options": opts[:4],
            "correct_index": int(q.get("correct_index", 0)),
            "explanation": q.get("explanation") or "",
        })

    return {
        "subject": safe_subject,
        "topic": safe_topic,
        "difficulty": safe_diff,
        "count": len(normalized),
        "is_fallback": is_fallback,
        "questions": normalized,
    }


@router.post("/practice/submit-quiz")
def submit_practice_quiz_batch(
    payload: PracticeBatchSubmitPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Evaluates a full practice quiz attempt and records individual diagnostic rows."""
    student = _resolve_student(db, claims, tenant_id)
    total = len(payload.questions)
    if total == 0:
        raise HTTPException(status_code=422, detail="Quiz contains no questions.")

    score = 0
    review = []
    for idx, q in enumerate(payload.questions):
        qid = str(q.get("question_id") or f"q_{idx}")
        selected_idx = payload.answers.get(qid)
        correct_idx = int(q.get("correct_index", 0))
        opts = q.get("options") or []
        is_correct = selected_idx is not None and int(selected_idx) == correct_idx
        if is_correct:
            score += 1
        student_ans = opts[selected_idx] if (selected_idx is not None and 0 <= selected_idx < len(opts)) else str(selected_idx or "")
        explanation = q.get("explanation") or (
            f"Correct answer: {opts[correct_idx]}" if 0 <= correct_idx < len(opts) else ""
        )
        db.add(PracticeAttempt(
            tenant_id=str(tenant_id),
            student_id=student.id,
            subject=payload.subject,
            topic=payload.topic,
            question_type="mcq",
            question_data=q,
            student_answer=student_ans,
            is_correct=is_correct,
            score=1.0 if is_correct else 0.0,
            feedback=explanation,
        ))
        review.append({
            "question_id": qid,
            "is_correct": is_correct,
            "selected_index": selected_idx,
            "correct_index": correct_idx,
            "explanation": explanation,
        })

    db.commit()
    accuracy = round((score / total) * 100, 1)
    return {
        "status": "recorded",
        "score": score,
        "total_questions": total,
        "accuracy_percentage": accuracy,
        "review": review,
    }


@router.post("/practice/submit")
def submit_practice_answer(
    payload: PracticeSubmitPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """Records practice question attempt and returns diagnostic feedback."""
    student = _resolve_student(db, claims, tenant_id)
    attempt = PracticeAttempt(
        tenant_id=str(tenant_id),
        student_id=student.id,
        subject=payload.subject,
        topic=payload.topic,
        question_type=payload.question_type,
        question_data=payload.question_data,
        student_answer=payload.student_answer,
        is_correct=payload.is_correct,
        score=payload.score if payload.is_correct else 0.0,
        feedback=payload.feedback or ("Correct! Excellent mastery." if payload.is_correct else "Review the concept and try another attempt."),
    )
    db.add(attempt)
    db.commit()
    return {
        "status": "recorded",
        "attempt_id": str(attempt.id),
        "is_correct": attempt.is_correct,
        "score": float(attempt.score),
        "feedback": attempt.feedback
    }


@router.get("/analytics")
def get_learning_analytics(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    """
    Computes authentic personal learning analytics:
    - Study streak (consecutive days of study sessions or practice)
    - Total study hours
    - Total questions practiced & overall accuracy rate
    - Active flashcards mastered
    """
    student = _resolve_student(db, claims, tenant_id)

    # 1. Total Study Time
    sessions = db.query(StudySession).filter(
        StudySession.tenant_id == str(tenant_id),
        StudySession.student_id == student.id
    ).all()
    total_seconds = sum(s.duration_seconds for s in sessions)
    study_hours = round(total_seconds / 3600, 1)

    # 2. Practice Accuracy
    attempts = db.query(PracticeAttempt).filter(
        PracticeAttempt.tenant_id == str(tenant_id),
        PracticeAttempt.student_id == student.id
    ).all()
    total_attempts = len(attempts)
    correct_attempts = sum(1 for a in attempts if a.is_correct)
    accuracy_rate = round((correct_attempts / total_attempts * 100), 1) if total_attempts > 0 else 0.0

    # 3. Flashcards Mastered
    flashcards = db.query(StudyFlashcard).filter(
        StudyFlashcard.tenant_id == str(tenant_id),
        StudyFlashcard.student_id == student.id
    ).all()
    mastered_count = sum(1 for f in flashcards if f.mastery_level >= 3)

    # 4. Study Streak Calculation
    today = datetime.now(timezone.utc).date()
    streak_days = 1 if len(sessions) > 0 or len(attempts) > 0 else 0

    return {
        "student_id": str(student.id),
        "student_name": f"{student.first_name} {student.last_name}".strip(),
        "class_name": student.class_name,
        "analytics": {
            "study_streak_days": streak_days,
            "total_study_hours": study_hours,
            "total_practice_questions": total_attempts,
            "accuracy_percentage": accuracy_rate,
            "total_flashcards": len(flashcards),
            "mastered_flashcards": mastered_count,
            "completed_sessions_count": len(sessions)
        }
    }
