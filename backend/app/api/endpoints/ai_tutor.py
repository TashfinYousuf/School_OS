# backend/app/api/endpoints/ai_tutor.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user_claims, require_roles
from app.services.rate_limiter import RateLimiterService

router = APIRouter()

class SocraticQueryPayload(BaseModel):
    subject: str
    topic: str
    question_text: str

@router.post("/socratic-prompt")
def ask_socratic_tutor(
    payload: SocraticQueryPayload,
    db: Session = Depends(get_db),
    claims: dict = Depends(require_roles(["student", "teacher", "admin"]))
):
    user_id = claims["user_id"]
    tenant_id = claims["tenant_id"]

    # 1. User Session Rate Limit (10 AI requests/min)
    RateLimiterService.check_user_rate_limit(user_id=user_id, max_requests=10, window_seconds=60)

    # 2. AI Budget Wall Check
    RateLimiterService.verify_ai_firewall(db=db, tenant_id=tenant_id, estimated_tokens=1500)

    # 3. Execution (Simulated Gemini 2.5 Flash Response)
    socratic_response = f"Let's break this down. In {payload.subject}, what is the first principle behind {payload.topic}?"
    
    # 4. Token Burn Ledger Recording
    RateLimiterService.record_token_burn(
        db=db,
        tenant_id=tenant_id,
        user_id=user_id,
        feature="socratic_tutor",
        prompt_tokens=120,
        completion_tokens=45
    )

    return {
        "reply": socratic_response,
        "mode": "Socratic Guided Discovery",
        "tokens_spent": 165
    }