# backend/app/services/rate_limiter.py
import time
from collections import defaultdict
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.ai_governance import TenantAIBudget, AIUsageLog

# In-memory sliding window cache for ultra-fast checks (backed by Redis in P4)
# Structure: { key: [timestamp1, timestamp2, ...] }
_REQUEST_TIMESTAMPS = defaultdict(list)

class RateLimiterService:
    @staticmethod
    def check_user_rate_limit(user_id: str, max_requests: int = 15, window_seconds: int = 60):
        """Prevents single user script spamming."""
        now = time.time()
        key = f"usr:{user_id}"
        timestamps = _REQUEST_TIMESTAMPS[key]
        
        # Prune expired timestamps
        valid_timestamps = [t for t in timestamps if now - t < window_seconds]
        _REQUEST_TIMESTAMPS[key] = valid_timestamps
        
        if len(valid_timestamps) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: You can only perform {max_requests} actions per minute. Please pause."
            )
        _REQUEST_TIMESTAMPS[key].append(now)

    @staticmethod
    def verify_ai_firewall(db: Session, tenant_id: str, estimated_tokens: int = 2000):
        """
        Enforces tenant monthly budget and hard wall locks.
        """
        budget = db.query(TenantAIBudget).filter(TenantAIBudget.tenant_id == tenant_id).first()
        if not budget:
            # Auto-provision default tier budget
            budget = TenantAIBudget(tenant_id=tenant_id)
            db.add(budget)
            db.commit()
            db.refresh(budget)

        if budget.is_hard_locked or (budget.used_tokens_current_cycle + estimated_tokens > budget.monthly_token_limit):
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Monthly AI Token Budget Reached. Core school features remain active; AI assists require quota renewal."
            )

    @staticmethod
    def record_token_burn(db: Session, tenant_id: str, user_id: str, feature: str, prompt_tokens: int, completion_tokens: int):
        total = prompt_tokens + completion_tokens
        
        # Log immutable usage
        log = AIUsageLog(
            tenant_id=tenant_id,
            user_id=user_id,
            feature=feature,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total
        )
        db.add(log)

        # Update budget counter
        budget = db.query(TenantAIBudget).filter(TenantAIBudget.tenant_id == tenant_id).first()
        if budget:
            budget.used_tokens_current_cycle += total
            if budget.used_tokens_current_cycle >= budget.monthly_token_limit:
                budget.is_hard_locked = True
        
        db.commit()