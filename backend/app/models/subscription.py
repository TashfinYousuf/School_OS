import uuid
import datetime
from sqlalchemy import Column, String, Float, DateTime, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base

class InstitutionSubscription(Base):
    __tablename__ = "institution_subscriptions"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), unique=True, nullable=False, index=True)
    
    # Plans: 'starter', 'growth', 'professional', 'enterprise'
    plan_tier = Column(String(50), default="growth", nullable=False)
    workspace_scope = Column(String(50), default="unified") # 'school', 'academy', 'unified'
    
    monthly_fee = Column(Float, default=2490.0)
    billing_cycle = Column(String(20), default="monthly") # 'monthly', 'annual'
    currency = Column(String(3), default="BDT", nullable=False)
    
    # Feature Quotas
    ai_question_quota_monthly = Column(Integer, default=100)
    ai_questions_used_this_month = Column(Integer, default=0)
    max_active_students = Column(Integer, default=500)
    
    # Lifecycle states: TRIALING, ACTIVE, PAST_DUE, GRACE_PERIOD, SUSPENDED, CANCELLED, EXPIRED
    subscription_status = Column(String(30), default="ACTIVE")
    current_period_start = Column(DateTime(timezone=True), nullable=True)
    valid_until = Column(DateTime(timezone=True), nullable=False)
    trial_ends_at = Column(DateTime(timezone=True), nullable=True)
    grace_period_until = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def is_active_or_grace(self, now: datetime.datetime = None) -> bool:
        if now is None:
            now = datetime.datetime.now(datetime.timezone.utc)
        if self.subscription_status in ("ACTIVE", "TRIALING"):
            vu = self.valid_until
            if vu and not vu.tzinfo:
                vu = vu.replace(tzinfo=datetime.timezone.utc)
            return vu is not None and vu >= now
        if self.subscription_status == "GRACE_PERIOD":
            gu = self.grace_period_until
            if gu and not gu.tzinfo:
                gu = gu.replace(tzinfo=datetime.timezone.utc)
            return gu is not None and gu >= now
        return False

    def is_suspended(self) -> bool:
        return self.subscription_status in ("SUSPENDED", "CANCELLED", "EXPIRED")


# Parity alias
TenantSubscription = InstitutionSubscription
