from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List

from app.api.deps import get_current_tenant_id

router = APIRouter()

class ReadinessInsight(BaseModel):
    category: str
    total_records: int
    verified_records: int
    missing_fields: int
    action_required: str

class IPEMISResponse(BaseModel):
    system_status: str
    overall_readiness: int
    insights: List[ReadinessInsight]
    ai_recommendation: str

@router.get("/ipemis/readiness", response_model=IPEMISResponse)
def get_ipemis_readiness(tenant_id: str = Depends(get_current_tenant_id)):
    """
    Analyzes local SchoolOS database and maps it against Bangladesh Gov IPEMIS requirements.
    (Using dynamic dummy data for the UI simulation)
    """
    return {
        "system_status": "Connected to Gov Framework",
        "overall_readiness": 92,
        "insights": [
            {
                "category": "Students Data (2026-27)",
                "total_records": 486,
                "verified_records": 474,
                "missing_fields": 12,
                "action_required": "Birth Certificate (NID format) missing"
            },
            {
                "category": "Teachers Profile",
                "total_records": 28,
                "verified_records": 28,
                "missing_fields": 0,
                "action_required": "None"
            },
            {
                "category": "Infrastructure & Classrooms",
                "total_records": 14,
                "verified_records": 12,
                "missing_fields": 2,
                "action_required": "Verify Internet and Playground coordinates"
            }
        ],
        "ai_recommendation": "Overall readiness is excellent. Fix the 12 missing student birth certificates to unlock the 1-click IPEMIS Payload Generator."
    }