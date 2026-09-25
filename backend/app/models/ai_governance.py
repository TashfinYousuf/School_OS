# backend/app/models/ai_governance.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, BigInteger, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class TenantAIBudget(Base):
    """
    Stores hard limits and current consumption of AI tokens per tenant.
    """
    __tablename__ = "tenant_ai_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, unique=True, index=True, nullable=False)
    
    # Monthly ceiling limits
    monthly_token_limit = Column(BigInteger, default=2_000_000, nullable=False) # 2M tokens/month default
    used_tokens_current_cycle = Column(BigInteger, default=0, nullable=False)
    
    # Cost ceiling in USD / BDT
    monthly_budget_usd = Column(Integer, default=25, nullable=False) # $25 hard stop
    is_hard_locked = Column(Boolean, default=False, nullable=False)
    
    billing_cycle_start = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AIUsageLog(Base):
    """
    Immutable audit log for every generative token burn.
    """
    __tablename__ = "ai_usage_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    user_id = Column(String, index=True, nullable=False)
    
    model_name = Column(String, default="gemini-2.5-flash", nullable=False)
    feature = Column(String, index=True, nullable=False) # "socratic_tutor", "voice_diary", "exam_gen"
    
    prompt_tokens = Column(Integer, default=0, nullable=False)
    completion_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)