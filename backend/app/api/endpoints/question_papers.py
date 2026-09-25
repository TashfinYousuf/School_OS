import uuid
import json
import re
import os
import datetime
import random

from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, model_validator
from google import genai
from google.genai import types

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_tenant_id, require_roles
from app.models.live_exam import LiveExam

router = APIRouter(tags=["Question Papers & Generator"])

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
    subject: str = Field(..., example="Physics 1st Paper")
    class_name: Optional[str] = None
    program_name: Optional[str] = None
    topic: Optional[str] = None
    topic_title: Optional[str] = None
    question_count: Optional[int] = 5
    total_marks: Optional[float] = 25.0
    duration_minutes: Optional[int] = 15
    difficulty: Optional[str] = "Engineering / Medical Standard"
    negative_marking_rate: Optional[float] = 0.25

    @model_validator(mode="after")
    def reconcile_fields(self):
        resolved_topic = self.topic or self.topic_title or "General Syllabus"
        self.topic = resolved_topic
        self.topic_title = resolved_topic

        resolved_class = self.class_name or self.program_name or "Academic Care (Udvash / Retina Model)"
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

    return {
        "id": str(paper.id),
        "title": paper.title,
        "total_marks": paper.total_marks,
        "duration_minutes": paper.duration_minutes,
        "negative_marking_rate": paper.negative_marking_rate,
        "institution_name": "Kids Shine International School & Academic Care",
        "campus_address": "Nazrul Avenue, Kandirpar, Cumilla-3500 • Phone: +8801971122084",
        "created_at": paper.created_at.strftime("%d %b, %Y") if paper.created_at else "Today",
        "questions": q_list
    }

# Subject-Specific Verified Question Bank for Fail-Safe Dynamic Fallbacks
SUBJECT_FALLBACK_POOLS = {
    "chemistry": [
        {
            "question": "[Organic Chemistry] Aliphatic hydrocarbon theke aromatic compound toirir proyash-e n-hexane ke Cr2O3 probhabok er upasthitite 500°C e uttapto korle ki utponno hoy?",
            "options": ["Benzene", "Toluene", "Cyclohexane", "Hexene"],
            "correct_option": "Benzene",
            "explanation": "Aromatization reaction-e n-hexane ke 500°C o high pressure-e Cr2O3/Al2O3 probhaboker upasthitite dehydrogenation o cyclization-er maddhome Benzene toiri hoy."
        },
        {
            "question": "[Organic Chemistry] Grignard reagent (R-Mg-X) er shathe Formaldehyde (HCHO) er bikriyar por adro-bishleshon (hydrolysis) korle kon alcohol utponno hoy?",
            "options": ["Primary (1°) Alcohol", "Secondary (2°) Alcohol", "Tertiary (3°) Alcohol", "Ether"],
            "correct_option": "Primary (1°) Alcohol",
            "explanation": "Formaldehyde er shathe Grignard reagent bikriya kore shobshomoy 1° alcohol toiri kore; onnanno aldehyde 2° ebong ketone 3° alcohol dey."
        },
        {
            "question": "[Chemistry] Kaolin ba China clay er shothik chemical formula konti?",
            "options": ["Al2O3·2SiO2·2H2O", "Al2O3·3H2O", "Na3AlF6", "K2O·Al2O3·6SiO2"],
            "correct_option": "Al2O3·2SiO2·2H2O",
            "explanation": "China clay ba Kaolinite er standard chemical formula holo Al2Si2O5(OH)4 ba oxide format-e Al2O3·2SiO2·2H2O."
        },
        {
            "question": "[Organic Chemistry] Cannizzaro bikriya nicher kon compound-ti pradarshan kore?",
            "options": ["Benzaldehyde", "Acetaldehyde", "Acetone", "Propanal"],
            "correct_option": "Benzaldehyde",
            "explanation": "Je shob aldehyde-e alpha-hydrogen thake na (e.g., Benzaldehyde, Formaldehyde) tara teebro ksharer upasthitite Cannizzaro bikriya dey."
        }
    ],
    "physics": [
        {
            "question": "[Physics • Dynamics] Ekti bostur upor F = (6i - 3j + 2k) N bol proyog koray boson r = (2i + 2j - k) m hoy. Krito kajer poriman koto?",
            "options": ["4 J", "10 J", "8 J", "12 J"],
            "correct_option": "4 J",
            "explanation": "W = F · r = (6*2) + (-3*2) + (2*-1) = 12 - 6 - 2 = 4 Joule."
        },
        {
            "question": "[Physics] Vrittakar pothe shushomo drutite ghurnayoman bostur khetre konti shothik?",
            "options": ["Toron kendramukhi", "Toron shunya", "Beg dhrubok", "Gotishokti poribortito hoy"],
            "correct_option": "Toron kendramukhi",
            "explanation": "Sushomo drutite cholleo beger dik poribortoner karone shobshomoy kendramukhi toron a = v^2/r thake."
        }
    ],
    "math": [
        {
            "question": "[Higher Math] 2x² - 5x + 2 = 0 shomikoroner muldoy er shobhab konti?",
            "options": ["Bastob o oshoman", "Bastob o shoman", "Jotil o oshoman", "O-bastob"],
            "correct_option": "Bastob o oshoman",
            "explanation": "Nishchayok D = b² - 4ac = (-5)² - 4(2)(2) = 25 - 16 = 9 > 0 (purno borgo), tai muldoy bastob, oshoman o mulod."
        }
    ],
    "biology": [
        {
            "question": "[Biology] Kosh bクロンg-er kon porjaye bishubiyo onchole chromosome-gulo shojjito hoy?",
            "options": ["Metaphase", "Prophase", "Anaphase", "Telophase"],
            "correct_option": "Metaphase",
            "explanation": "Metaphase dhape equatorial plate ba bishubiyo onchole chromosome shojjito hoy jake metakinesis bole."
        }
    ]
}

@router.post("/generate", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin", "teacher"]))])
def generate_question_paper_endpoint(
    payload: GenerateQuestionPaperPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    subject_raw = (payload.subject or "").lower()
    topic_clean = (payload.topic or payload.topic_title or "General Core Concepts").strip()
    q_count = max(payload.question_count or 5, 2)
    duration = payload.duration_minutes or 15

    # Determine Domain Strictly
    target_domain = "general"
    if "chem" in subject_raw or "রসায়ন" in subject_raw or "organic" in topic_clean.lower():
        target_domain = "chemistry"
    elif "phys" in subject_raw or "পদার্থ" in subject_raw:
        target_domain = "physics"
    elif "math" in subject_raw or "গণিত" in subject_raw:
        target_domain = "math"
    elif "bio" in subject_raw or "জীব" in subject_raw:
        target_domain = "biology"

    system_instruction = (
        f"You are a Strict Senior Faculty of {payload.subject} for Udvash, Retina, and Focus admission academies in Bangladesh. "
        f"CRITICAL RULE 1: You must generate questions STRICTLY and ONLY from the subject: '{payload.subject}' and topic: '{topic_clean}'. "
        f"CRITICAL RULE 2: Under NO circumstance should you output Physics concepts in a Chemistry paper, or Chemistry concepts in a Math paper. "
        f"CRITICAL RULE 3: Do not repeat common questions. Provide authentic admission standard questions with 4 distinct options and clean scientific explanation. "
        "Output ONLY a valid JSON array matching this exact schema: "
        "["
        "  {"
        "    \"id\": \"q_0\","
        "    \"question\": \"Question text strictly based on topic in Bangla or English\","
        "    \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],"
        "    \"correct_option\": \"Option A\","
        "    \"explanation\": \"Detailed step-by-step scientific justification\""
        "  }"
        "]"
    )

    prompt = (
        f"Generate {q_count} unique, authentic MCQ questions.\n"
        f"Target Subject: {payload.subject}\n"
        f"Topic: {topic_clean}\n"
        f"Standard: {payload.difficulty}\n"
        f"Format: Strict JSON only without markdown codeblocks."
    )

    questions_data = []

    # 1. Attempt AI Generation with Dynamic Seed
    if ai_client and clean_api_key and len(clean_api_key) > 10:
        try:
            chat = ai_client.chats.create(
                model='gemini-2.5-flash',
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.35, # Prevents identical repetitions
                    response_mime_type="application/json"
                )
            )
            response = chat.send_message(prompt)
            questions_data = extract_clean_json_array(response.text)
        except Exception as e:
            print(f"⚠️ Gemini Generator fallback active: {e}")
            questions_data = []

    # 2. Strict Subject-Domain Fail-Safe Fallback (No Physics in Chemistry!)
    if not questions_data:
        pool = SUBJECT_FALLBACK_POOLS.get(target_domain, SUBJECT_FALLBACK_POOLS["chemistry" if "chem" in target_domain else "physics"])
        # Shuffle to prevent exact identical question repeats
        selected = list(pool)
        random.shuffle(selected)
        questions_data = selected[:q_count]

    # Re-index unique IDs
    for idx, q in enumerate(questions_data):
        q["id"] = f"q_{idx}"

    now = datetime.datetime.now(datetime.timezone.utc)
    exam_title = f"{payload.subject}: {topic_clean} ({payload.difficulty or 'Admission Model Test'})"

    new_exam = LiveExam(
        tenant_id=str(tenant_id),
        title=exam_title,
        total_marks=float(len(questions_data) * 1.0),
        duration_minutes=duration,
        negative_marking_rate=payload.negative_marking_rate or 0.25,
        start_time=now,
        end_time=now + datetime.timedelta(days=14),
        is_published=True,
        questions_payload=questions_data
    )
    db.add(new_exam)
    db.commit()
    db.refresh(new_exam)

    return {
        "message": "Question paper generated and live exam published successfully",
        "paper_id": str(new_exam.id),
        "id": str(new_exam.id),
        "title": new_exam.title,
        "total_marks": new_exam.total_marks,
        "duration_minutes": new_exam.duration_minutes,
        "total_questions": len(questions_data),
        "institution_name": "Kids Shine International School & Future Academic Care",
        "campus_address": "Nazrul Avenue, Kandirpar, Cumilla-3500 • Phone: +8801971122084",
        "created_at": new_exam.created_at.strftime("%d %b, %Y"),
        "questions": questions_data
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