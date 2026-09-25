from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types
from app.core.config import settings
from app.api.deps import require_roles

router = APIRouter()

clean_api_key = settings.GEMINI_API_KEY.strip().strip('"').strip("'")
ai_client = genai.Client(api_key=clean_api_key)

class DoubtQuery(BaseModel):
    student_name: str
    subject: str
    problem_text: str
    student_previous_step: str = ""

@router.post("/socratic-solve", dependencies=[Depends(require_roles(["admin", "teacher", "student"]))])
def socratic_doubt_solver(payload: DoubtQuery):
    """
    Socratic AI Model: Does NOT give the direct final answer.
    Guides the student step-by-step with intuitive mathematical reasoning.
    """
    system_instruction = (
        "You are the Socratic AI Study Buddy for an elite academic institution. "
        "Your pedagogical philosophy is: 'Teach, don't just answer.' "
        "Rule 1: Never output the final answer directly. "
        "Rule 2: Analyze what step the student is stuck on. "
        "Rule 3: Give 1 intuitive hint and ask a guiding question to lead them to the next step. "
        "Respond in standard English, or clean Bangla if the query is in Bangla."
    )

    try:
        chat = ai_client.chats.create(
            model='gemini-2.5-flash',
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3
            )
        )
        prompt = (
            f"Subject: {payload.subject}\n"
            f"Problem: {payload.problem_text}\n"
            f"What student tried so far: {payload.student_previous_step or 'I do not know how to begin.'}"
        )
        response = chat.send_message(prompt)
        return {
            "socratic_guidance": response.text,
            "pedagogical_mode": "Active Guided Learning"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Learning Studio AI Error: {str(e)}")