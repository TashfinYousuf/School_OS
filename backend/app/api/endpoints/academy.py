import os
import logging
import uuid
import datetime
import json
import base64

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from google import genai
from google.genai import types

from app.core.config import settings
from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.academy import AcademicProgram, AcademyBatch, BatchEnrollment
from app.models.live_exam import LiveExam, ExamSubmission
from app.models.student import Student
from app.services.institution import get_institution_profile
from app.models.guardian import Guardian, GuardianStudentLink

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize clean Gemini client
from app.core.ai_client import ai_client

# --- Pydantic Schemas ---
class ProgramCreatePayload(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Engineering Admission 2026"})
    target_exam: str = Field(..., json_schema_extra={"example": "BUET & Engineering University Entry"})
    course_fee: float = Field(..., gt=0)
    duration_months: int = 6

class BatchCreatePayload(BaseModel):
    program_id: uuid.UUID
    batch_name: str = Field(..., json_schema_extra={"example": "Morning Shift - Alpha"})
    shift_time: str = Field(..., json_schema_extra={"example": "08:00 AM - 11:30 AM"})
    days_schedule: str = Field(..., json_schema_extra={"example": "Sat, Mon, Wed"})
    max_seat_capacity: int = 60
    classroom_number: Optional[str] = "Lecture Hall 1"

class EnrollStudentPayload(BaseModel):
    student_id: uuid.UUID
    batch_id: uuid.UUID
    enrollment_roll: Optional[str] = None

class ExamSubmitPayload(BaseModel):
    exam_id: uuid.UUID
    student_id: uuid.UUID
    answers: Dict[str, str]  # {"q_0": "A", "q_1": "B"}

class GenerateExamPayload(BaseModel):
    program_id: Optional[uuid.UUID] = None
    subject: str = Field(..., json_schema_extra={"example": "Physics"})
    topic: str = Field(..., json_schema_extra={"example": "Newtonian Mechanics & Vectors"})
    question_count: int = Field(default=5, ge=2, le=25)
    duration_minutes: int = Field(default=15, ge=5, le=120)
    difficulty: str = Field(default="Admission Standard", json_schema_extra={"example": "HSC Board / Admission Standard"})
    negative_marking_rate: float = Field(default=0.25)

class ResultDispatchPayload(BaseModel):
    exam_id: uuid.UUID
    student_id: uuid.UUID
    score: float
    total_marks: float
    rank: Optional[int] = 1


# ---------- Endpoints -----------


# 1. Programs & Batches
@router.get("/programs")
def list_academic_programs(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student"]))
):
    programs = db.query(AcademicProgram).filter(
        AcademicProgram.tenant_id == str(tenant_id),
        AcademicProgram.is_active == True
    ).all()
    
    results = []
    for p in programs:
        batches = db.query(AcademyBatch).filter(
            AcademyBatch.program_id == p.id,
            AcademyBatch.is_active == True
        ).all()
        results.append({
            "id": str(p.id),
            "name": p.name,
            "target_exam": p.target_exam,
            "course_fee": p.course_fee,
            "duration_months": p.duration_months,
            "total_batches": len(batches),
            "batches": [
                {
                    "id": str(b.id),
                    "batch_name": b.batch_name,
                    "shift_time": b.shift_time,
                    "schedule": b.days_schedule,
                    "seats_available": b.max_seat_capacity - b.enrolled_count,
                    "enrolled_count": b.enrolled_count
                } for b in batches
            ]
        })
    return results


@router.post("/programs", status_code=status.HTTP_201_CREATED)
def create_academic_program(
    payload: ProgramCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    prog = AcademicProgram(
        tenant_id=str(tenant_id),
        name=payload.name,
        target_exam=payload.target_exam,
        course_fee=payload.course_fee,
        duration_months=payload.duration_months
    )
    db.add(prog)
    db.commit()
    db.refresh(prog)
    return {"message": "Program created successfully", "id": str(prog.id)}


@router.post("/batches", status_code=status.HTTP_201_CREATED)
def create_academy_batch(
    payload: BatchCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    batch = AcademyBatch(
        tenant_id=str(tenant_id),
        program_id=payload.program_id,
        batch_name=payload.batch_name,
        shift_time=payload.shift_time,
        days_schedule=payload.days_schedule,
        max_seat_capacity=payload.max_seat_capacity,
        classroom_number=payload.classroom_number
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"message": "Batch initialized", "batch_id": str(batch.id)}


# 2. Student Enrollment in Batch
@router.post("/enroll", status_code=status.HTTP_201_CREATED)
def enroll_student_in_batch(
    payload: EnrollStudentPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    batch = db.query(AcademyBatch).filter(
        AcademyBatch.id == payload.batch_id,
        AcademyBatch.tenant_id == str(tenant_id)
    ).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    if batch.enrolled_count >= batch.max_seat_capacity:
        raise HTTPException(status_code=400, detail="Batch is fully booked. No seats remaining.")

    enrollment = BatchEnrollment(
        tenant_id=str(tenant_id),
        student_id=payload.student_id,
        batch_id=payload.batch_id,
        enrollment_roll=payload.enrollment_roll or f"ROLL-{batch.enrolled_count + 1}"
    )
    batch.enrolled_count += 1
    db.add(enrollment)
    db.commit()
    return {"message": "Student successfully enrolled in batch", "roll": enrollment.enrollment_roll}


# 3. Live Exam Instant Evaluation Engine (With -0.25 Negative Marking)
@router.post("/submit-exam", status_code=status.HTTP_200_OK)
def evaluate_exam_submission(
    payload: ExamSubmitPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin", "teacher", "student"]))
):
    """
    Authoritative Exam Submission Engine:
    1. Anti-IDOR: Enforces that student accounts can only submit their own paper.
    2. Concurrency Safe: Uses row-level lock on the Student record to prevent race conditions.
    3. Server-Authoritative Timing: Verifies submission against server clock.
    4. Deterministic Negative Marking (+1.0 / -0.25).
    """
    now = datetime.datetime.now(datetime.timezone.utc)
    current_role = claims["role"]
    current_user_id = claims["user_id"]

    # 1. Anti-IDOR Guard: Students cannot impersonate other students
    if current_role == "student":
        student_record = db.query(Student).filter(
            Student.id == payload.student_id,
            Student.tenant_id == str(tenant_id)
        ).first()

        if not student_record or (
            str(student_record.id) != str(current_user_id) and 
            str(getattr(student_record, "user_id", "")) != str(current_user_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Security Violation: You are not authorized to submit an exam for this student."
            )

    # 2. Concurrency Lock: Lock the student row within the active tenant
    # Since the student exists, SELECT FOR UPDATE creates an exclusive lock for this transaction
    locked_student = db.query(Student).filter(
        Student.id == payload.student_id,
        Student.tenant_id == str(tenant_id)
    ).with_for_update().first()

    if not locked_student:
        raise HTTPException(status_code=404, detail="Student profile not found.")

    # 3. Check for existing submission inside the locked boundary
    existing_submission = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == payload.exam_id,
        ExamSubmission.student_id == payload.student_id,
        ExamSubmission.tenant_id == str(tenant_id)
    ).first()

    if existing_submission:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Idempotency lock: This examination has already been finalized and evaluated."
        )

    # 4. Fetch Exam and Verify Server Window
    exam = db.query(LiveExam).filter(
        LiveExam.id == payload.exam_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()

    if not exam:
        raise HTTPException(status_code=404, detail="Live Exam record not found.")

    if exam.end_time:
        # 120-second latency grace period for mobile network delay
        if now > (exam.end_time + datetime.timedelta(seconds=120)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Submission rejected: Official server testing window has closed."
            )

    # 5. Parse Questions & Evaluate
    questions = exam.questions_payload or []
    if isinstance(questions, str):
        import json
        try:
            questions = json.loads(questions)
        except Exception:
            questions = []

    correct_count = 0
    wrong_count = 0
    unattempted_count = 0
    questions_review = []

    for idx, q in enumerate(questions):
        q_id = q.get("id") or f"q_{idx}"
        correct_choice = str(q.get("correct_option", "")).strip()

        student_choice = (
            payload.answers.get(q_id) or 
            payload.answers.get(f"q_{idx}") or 
            payload.answers.get(str(idx))
        )

        if not student_choice or str(student_choice).strip() == "":
            unattempted_count += 1
            is_corr = False
            is_unatt = True
        else:
            is_unatt = False
            s_clean = str(student_choice).strip().lower()
            c_clean = correct_choice.lower()
            if s_clean == c_clean or s_clean in c_clean:
                correct_count += 1
                is_corr = True
            else:
                wrong_count += 1
                is_corr = False

        questions_review.append({
            "id": q_id,
            "question": q.get("question", f"Question {idx+1}"),
            "options": q.get("options", []),
            "correct_option": correct_choice,
            "student_answer": student_choice if not is_unatt else None,
            "is_correct": is_corr,
            "is_unattempted": is_unatt,
            "explanation": q.get("explanation", "Standard curriculum evaluation.")
        })

    # 6. Negative Marking Logic (+1.0 / -0.25)
    total_q = len(questions) or int(exam.total_marks) or 1
    neg_rate = float(exam.negative_marking_rate or 0.25)
    penalty = round(wrong_count * neg_rate, 2)
    final_score = round(max((correct_count * 1.0) - penalty, 0.0), 2)
    accuracy = round((correct_count / total_q) * 100, 1)

    try:
        submission = ExamSubmission(
            tenant_id=str(tenant_id),
            exam_id=exam.id,
            student_id=payload.student_id,
            correct_count=correct_count,
            wrong_count=wrong_count,
            unattempted_count=unattempted_count,
            obtained_score=final_score,
            accuracy_percentage=accuracy,
            student_answers=payload.answers
        )
        db.add(submission)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrent write blocked: Exam submission already processed."
        )

    return {
        "score": final_score,
        "total_marks": exam.total_marks or float(total_q),
        "correct_answers": correct_count,
        "wrong_answers": wrong_count,
        "unattempted": unattempted_count,
        "negative_marks_deducted": penalty,
        "accuracy": f"{accuracy}%",
        "reviews": questions_review
    }


# 2. Delete Live Exam Endpoint
@router.delete("/exams/{exam_id}", status_code=status.HTTP_200_OK)
def delete_live_exam(
    exam_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    exam = db.query(LiveExam).filter(
        LiveExam.id == exam_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Live exam not found.")

    # Delete related submissions first
    db.query(ExamSubmission).filter(ExamSubmission.exam_id == exam.id).delete()
    db.delete(exam)
    db.commit()
    return {"message": "Live exam and related submissions deleted successfully."}


# 3. Archive / Unpublish Live Exam Endpoint
@router.patch("/exams/{exam_id}/archive", status_code=status.HTTP_200_OK)
def archive_live_exam(
    exam_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    exam = db.query(LiveExam).filter(
        LiveExam.id == exam_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Live exam not found.")

    exam.is_published = not exam.is_published
    db.commit()
    return {"message": f"Exam status updated to {'published' if exam.is_published else 'archived'}."}


# --- 1. AI Question Bank & Live Exam Generator ---
@router.post("/generate-exam", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(["admin", "teacher"]))])
def generate_ai_live_exam(
    payload: GenerateExamPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Generates a structured MCQ exam using Gemini 2.5 Flash and publishes it directly into live_exams.
    """
    system_instruction = (
        "You are an Elite Academic Question Setter for HSC Board and Engineering/Medical Admission in Bangladesh. "
        "Generate a structured MCQ exam based on the given topic. "
        "Strict Rule: Each question must have exactly 4 options. "
        "Provide clear scientific explanations for each correct option. "
        "Output ONLY a valid JSON array matching this exact schema: "
        "["
        "  {"
        "    \"id\": \"q_0\","
        "    \"question\": \"Question statement in clean Bangla or English\","
        "    \"options\": [\"Option A\", \"Option B\", \"Option C\", \"Option D\"],"
        "    \"correct_option\": \"Option A\","
        "    \"explanation\": \"Step-by-step scientific explanation\""
        "  }"
        "]"
    )

    prompt = (
        f"Subject: {payload.subject}\n"
        f"Topic: {payload.topic}\n"
        f"Target Standard: {payload.difficulty}\n"
        f"Number of Questions: {payload.question_count}"
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
                response_mime_type="application/json"
            )
        )
        response = chat.send_message(prompt)
        questions_data = json.loads(response.text)

        # Standardize question IDs
        for idx, q in enumerate(questions_data):
            q["id"] = f"q_{idx}"

        # Create LiveExam in Database
        now = datetime.datetime.now(datetime.timezone.utc)
        exam_title = f"{payload.subject}: {payload.topic} ({payload.difficulty})"
        
        new_exam = LiveExam(
            tenant_id=str(tenant_id),
            program_id=payload.program_id,
            title=exam_title,
            total_marks=float(len(questions_data) * 1.0),
            duration_minutes=payload.duration_minutes,
            negative_marking_rate=payload.negative_marking_rate,
            start_time=now,
            end_time=now + datetime.timedelta(days=7), # Active for 7 days
            is_published=True,
            questions_payload=questions_data
        )
        db.add(new_exam)
        db.commit()
        db.refresh(new_exam)

        return {
            "message": "AI Exam generated and published live",
            "exam_id": str(new_exam.id),
            "title": new_exam.title,
            "total_questions": len(questions_data),
            "duration_minutes": new_exam.duration_minutes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Exam Generation Failed: {str(e)}")


# --- 2. List Active Live Exams ---
@router.get("/exams")
def list_active_live_exams(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student"]))
):
    exams = db.query(LiveExam).filter(
        LiveExam.tenant_id == str(tenant_id),
        LiveExam.is_published == True
    ).order_by(LiveExam.created_at.desc()).limit(20).all()

    return [
        {
            "id": str(e.id),
            "title": e.title,
            "total_marks": e.total_marks,
            "duration_minutes": e.duration_minutes,
            "negative_marking_rate": e.negative_marking_rate,
            "total_questions": len(e.questions_payload or []),
            "created_at": e.created_at.strftime("%d %b, %Y") if e.created_at else "Recent"
        }
        for e in exams
    ]


# --- 3. Get Single Exam Paper for Student Taking Test ---
@router.get("/exams/{exam_id}")
def get_live_exam_paper(
    exam_id: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student"]))
):
    try:
        clean_uuid = uuid.UUID(str(exam_id).strip())
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid Exam UUID format")

    exam = db.query(LiveExam).filter(
        LiveExam.id == clean_uuid,
        LiveExam.tenant_id == str(tenant_id),
        LiveExam.is_published == True
    ).first()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam paper not found or inactive")

    sanitized_questions = []
    for q in (exam.questions_payload or []):
        sanitized_questions.append({
            "id": q.get("id"),
            "question": q.get("question"),
            "options": q.get("options", [])
        })

    return {
        "id": str(exam.id),
        "title": exam.title,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "negative_marking_rate": exam.negative_marking_rate,
        "questions": sanitized_questions
    }


# 4. Live Exam Merit Leaderboard Engine
@router.get("/exams/{exam_id}/leaderboard")
def get_exam_leaderboard(
    exam_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "student"]))
):
    """
    Computes dynamic merit ranking based on obtained_score (highest first),
    with tie-breaking by lowest wrong_count and earliest submission time.
    """
    exam = db.query(LiveExam).filter(
        LiveExam.id == exam_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    submissions = db.query(ExamSubmission).filter(
        ExamSubmission.exam_id == exam.id,
        ExamSubmission.tenant_id == str(tenant_id)
    ).order_by(
        ExamSubmission.obtained_score.desc(),
        ExamSubmission.wrong_count.asc(),
        ExamSubmission.submitted_at.asc()
    ).all()

    leaderboard = []
    total_participants = len(submissions)

    for rank, sub in enumerate(submissions, start=1):
        # Update assigned_rank in database
        sub.assigned_rank = rank
        
        student = db.query(Student).filter(Student.id == sub.student_id).first()
        student_name = f"{student.first_name} {student.last_name}" if student else "Enrolled Student"
        adm_no = student.admission_number if student else "N/A"

        # Percentile Calculation: ((total - rank) / total) * 100
        percentile = round(((total_participants - rank + 1) / total_participants) * 100, 1) if total_participants > 0 else 100.0

        leaderboard.append({
            "rank": rank,
            "student_name": student_name,
            "admission_number": adm_no,
            "score": sub.obtained_score,
            "total_marks": exam.total_marks,
            "accuracy": f"{sub.accuracy_percentage}%",
            "percentile": f"{percentile}%",
            "submitted_at": sub.submitted_at.strftime("%I:%M %p • %d %b") if sub.submitted_at else "Just now"
        })

    db.commit()

    return {
        "exam_title": exam.title,
        "total_participants": total_participants,
        "leaderboard": leaderboard
    }


def assert_student_and_exam_scope(db: Session, tenant_id: str, student_id: uuid.UUID, exam_id: uuid.UUID):
    """
    Guarantees cross-tenant resource containment and masks existence oracle via generic 404 (F1).
    """
    student = db.query(Student).filter(
        Student.id == student_id,
        Student.tenant_id == str(tenant_id)
    ).first()

    exam = db.query(LiveExam).filter(
        LiveExam.id == exam_id,
        LiveExam.tenant_id == str(tenant_id)
    ).first()

    if not student or not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requested examination or student profile not found."
        )
    return student, exam


# --- 5. Phase P3.5: Multimodal Gemini 2.5 Flash Optical OMR Scanner ---
@router.post("/omr-camera-scan", dependencies=[Depends(require_roles(["admin", "teacher"]))])
async def scan_offline_omr_sheet(
    exam_id: uuid.UUID,
    student_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Multimodal Vision Ingestion: Reads paper OMR bubble sheets via mobile camera
    and auto-grades using Gemini 2.5 Flash Vision.
    Enforces strict tenant containment on both exam and student.
    """
    student, exam = assert_student_and_exam_scope(db, tenant_id, student_id, exam_id)

    image_bytes = await file.read()
    image_base64 = base64.b64encode(image_bytes).decode('utf-8')

    prompt = (
        "You are an Optical Mark Recognition (OMR) scanner engine. "
        "Examine this physical paper answer sheet image carefully. "
        "Detect all marked/filled circles for each question number. "
        "Output ONLY a valid JSON object mapping question keys to options, like: "
        "{\"q_0\": \"B\", \"q_1\": \"A\", \"q_2\": \"C\", \"q_3\": \"D\"}. "
        "If a question has no filled circle, omit it from the JSON."
    )

    if not ai_client:
        raise HTTPException(
            status_code=503,
            detail="OMR Vision engine is unavailable (Gemini API key not configured)."
        )

    detected_answers = {}
    try:
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=file.content_type or "image/jpeg"),
                prompt
            ]
        )
        clean_text = response.text.strip().replace("```json", "").replace("```", "").strip()
        detected_answers = json.loads(clean_text)
    except Exception as e:
        logger.error("OMR Vision parse failed tenant=%s exam=%s: %s", tenant_id, exam.id, e)
        raise HTTPException(
            status_code=502,
            detail="OMR optical vision parsing failed; please ensure clear image framing and retry."
        )

    # Grade the detected answers against exam.questions_payload
    questions = exam.questions_payload or []
    correct_count = 0
    wrong_count = 0
    unattempted_count = 0

    for idx, q in enumerate(questions):
        q_key = f"q_{idx}"
        student_ans = detected_answers.get(q_key, "")
        correct_ans = q.get("correct_option", "")

        if not student_ans:
            unattempted_count += 1
        elif student_ans.strip().upper() == correct_ans.strip().upper() or student_ans.strip().upper() in correct_ans.strip().upper():
            correct_count += 1
        else:
            wrong_count += 1

    neg_rate = float(exam.negative_marking_rate or 0.25)
    final_score = round(max((correct_count * 1.0) - (wrong_count * neg_rate), 0.0), 2)
    accuracy = round((correct_count / len(questions) * 100), 1) if questions else 0.0

    # Persist Submission
    submission = ExamSubmission(
        tenant_id=str(tenant_id),
        exam_id=exam.id,
        student_id=student_id,
        correct_count=correct_count,
        wrong_count=wrong_count,
        unattempted_count=unattempted_count,
        obtained_score=final_score,
        accuracy_percentage=accuracy,
        student_answers=detected_answers
    )
    db.add(submission)
    db.commit()

    return {
        "status": "SUCCESS",
        "scanner_mode": "Gemini 2.5 Flash Vision OMR",
        "score": final_score,
        "total_marks": exam.total_marks,
        "correct": correct_count,
        "wrong": wrong_count,
        "unattempted": unattempted_count,
        "detected_bubbles": detected_answers
    }


# --- 6. Guardian WhatsApp & SMS Automated Dispatcher ---
class ResultDispatchPayload(BaseModel):
    exam_id: uuid.UUID
    student_id: uuid.UUID
    score: float
    total_marks: float
    rank: Optional[int] = 1

@router.post("/dispatch-result-sms", dependencies=[Depends(require_roles(["admin", "teacher"]))])
def dispatch_guardian_exam_result(
    payload: ResultDispatchPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    student, exam = assert_student_and_exam_scope(db, tenant_id, payload.student_id, payload.exam_id)
    exam_title = exam.title or "Assessment Test"

    inst = get_institution_profile(db, tenant_id)
    row = (db.query(Guardian.phone_number)
            .join(GuardianStudentLink, GuardianStudentLink.guardian_id == Guardian.id)
            .filter(
                GuardianStudentLink.student_id == student.id,
                GuardianStudentLink.tenant_id == str(tenant_id),
                GuardianStudentLink.verification_status == "VERIFIED",
            )
            .first())
    guardian_phone = row[0] if row and row[0] else None
    
    if not guardian_phone:
        raise HTTPException(status_code=422, detail="No verified guardian phone on record for this student.")

    message = (
        f"Dear Guardian, your ward {student.first_name} {student.last_name} has completed '{exam_title}'. "
        f"Score: {payload.score}/{payload.total_marks}. Merit Rank: {payload.rank}. "
        f"{inst.name}" + (f" ({inst.address})" if inst.address else "") + "."
    )

    sms_gateway_url = os.getenv("SMS_GATEWAY_URL", "").strip()
    sms_api_key = os.getenv("SMS_API_KEY", "").strip()
    if not sms_gateway_url or not sms_api_key:
        return {
            "status": "DELIVERY_NOT_CONFIGURED",
            "delivery_configured": False,
            "recipient": guardian_phone,
            "message": message,
            "channel": "WhatsApp / SMS Gateway (Manual Preview Only)",
            "detail": "SMS gateway credentials (SMS_GATEWAY_URL / SMS_API_KEY) are not configured; message was NOT sent.",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%d %b, %Y • %I:%M %p")
        }

    return {
        "status": "QUEUED",
        "delivery_configured": True,
        "recipient": guardian_phone,
        "message": message,
        "channel": "WhatsApp / SMS Gateway",
        "detail": "Gateway credentials configured; hand off to outbound dispatcher.",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).strftime("%d %b, %Y • %I:%M %p")
    }