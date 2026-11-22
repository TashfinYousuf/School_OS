# backend/app/services/entitlement.py
"""
SaaS Subscription Lifecycle & Feature Entitlement Service.
Enforces feature gating, quota limits, dunning state transitions, and non-destructive suspension.
"""
import datetime
import logging
from typing import Callable, Optional, Tuple, Dict, Any, List

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_tenant_id
from app.models.subscription import InstitutionSubscription
from app.models.billing import TenantEntitlement, BillingAuditLog
from app.models.student import Student

logger = logging.getLogger("educationos.entitlement")

# Canonical Feature Matrix per Plan Category & Tier
PLAN_FEATURES = {
    "free_trial": [
        "attendance_ledger",
        "student_directory",
        "report_cards",
        "ai_questions",
        "offline_sync"
    ],
    "school_starter": [
        "attendance_ledger",
        "student_directory",
        "fee_receipts",
        "report_cards",
        "ai_questions",
        "offline_sync"
    ],
    "school_growth": [
        "attendance_ledger",
        "student_directory",
        "fee_receipts",
        "report_cards",
        "whatsapp_alerts",
        "nctb_grading",
        "teacher_diary",
        "ai_questions",
        "offline_sync"
    ],
    "school_pro": [
        "attendance_ledger",
        "student_directory",
        "fee_receipts",
        "report_cards",
        "whatsapp_alerts",
        "nctb_grading",
        "teacher_diary",
        "omr_scanner",
        "multi_branch",
        "audit_ledger",
        "biometric_api",
        "ai_questions",
        "offline_sync"
    ],
    "academy_starter": [
        "student_directory",
        "batch_management",
        "mcq_exams",
        "negative_marking",
        "merit_rankings",
        "ai_questions",
        "offline_sync"
    ],
    "academy_growth": [
        "student_directory",
        "batch_management",
        "mcq_exams",
        "negative_marking",
        "merit_rankings",
        "live_exams",
        "socratic_ai",
        "solution_sheets",
        "due_alerts",
        "ai_questions",
        "offline_sync"
    ],
    "academy_pro": [
        "student_directory",
        "batch_management",
        "mcq_exams",
        "negative_marking",
        "merit_rankings",
        "live_exams",
        "socratic_ai",
        "solution_sheets",
        "due_alerts",
        "central_question_bank",
        "performance_heatmap",
        "ai_questions",
        "offline_sync"
    ],
    "unified_growth": [
        "attendance_ledger",
        "student_directory",
        "fee_receipts",
        "report_cards",
        "whatsapp_alerts",
        "nctb_grading",
        "batch_management",
        "mcq_exams",
        "live_exams",
        "ai_questions",
        "offline_sync"
    ],
    "unified_pro": [
        "attendance_ledger",
        "student_directory",
        "fee_receipts",
        "report_cards",
        "whatsapp_alerts",
        "nctb_grading",
        "teacher_diary",
        "omr_scanner",
        "multi_branch",
        "audit_ledger",
        "biometric_api",
        "batch_management",
        "mcq_exams",
        "live_exams",
        "central_question_bank",
        "performance_heatmap",
        "dedicated_omr",
        "ai_questions",
        "offline_sync"
    ],
}

# Features that remain accessible during NON-DESTRUCTIVE SUSPENSION (read-only mode)
READ_ONLY_FALLBACK_FEATURES = {
    "student_directory",
    "report_cards",
    "attendance_view",
    "school_profile",
}

GRACE_PERIOD_DAYS = 7


class EntitlementService:
    @staticmethod
    def _utc_now() -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    @staticmethod
    def _aware(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
        if dt is None:
            return None
        return dt if dt.tzinfo else dt.replace(tzinfo=datetime.timezone.utc)

    @classmethod
    def evaluate_subscription_lifecycle(
        cls,
        db: Session,
        tenant_id: str,
        now: Optional[datetime.datetime] = None
    ) -> str:
        """
        State Machine:
        TRIALING -> ACTIVE -> PAST_DUE -> GRACE_PERIOD -> SUSPENDED -> EXPIRED
        """
        now = now or cls._utc_now()
        sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tenant_id).first()
        if not sub:
            return "UNKNOWN"

        old_status = sub.subscription_status
        new_status = old_status

        valid_until = cls._aware(sub.valid_until)
        trial_ends_at = cls._aware(sub.trial_ends_at)
        grace_until = cls._aware(sub.grace_period_until)

        # 1. Trial Expiration
        if old_status == "TRIALING":
            cutoff = trial_ends_at or valid_until
            if cutoff and cutoff < now:
                new_status = "EXPIRED"

        # 2. Active Subscription Expiration -> Dunning & Grace Period
        elif old_status == "ACTIVE":
            if valid_until and valid_until < now:
                new_status = "GRACE_PERIOD"
                sub.grace_period_until = valid_until + datetime.timedelta(days=GRACE_PERIOD_DAYS)
                grace_until = sub.grace_period_until

        # 3. Grace Period Expiration -> Non-Destructive Suspension
        elif old_status == "GRACE_PERIOD":
            if grace_until and grace_until < now:
                new_status = "SUSPENDED"

        if new_status != old_status:
            sub.subscription_status = new_status
            db.add(BillingAuditLog(
                tenant_id=tenant_id,
                actor_id="system_lifecycle_engine",
                action="SUBSCRIPTION_STATUS_TRANSITION",
                old_state={"status": old_status},
                new_state={"status": new_status, "evaluated_at": now.isoformat()},
                reason=f"Automatic lifecycle evaluation transitioned from {old_status} to {new_status}"
            ))
            db.commit()
            db.refresh(sub)
            logger.info("Tenant %s subscription transitioned: %s -> %s", tenant_id, old_status, new_status)

        return new_status

    @classmethod
    def has_entitlement(
        cls,
        db: Session,
        tenant_id: str,
        feature_key: str,
        now: Optional[datetime.datetime] = None
    ) -> bool:
        """
        Evaluates whether a tenant is entitled to invoke a given feature.
        Hierarchy:
        1. TenantEntitlement explicit overrides.
        2. Lifecycle evaluation (Suspended tenants get read-only fallback).
        3. Plan declared features.
        """
        now = now or cls._utc_now()
        tid = str(tenant_id)

        # 1. Explicit Override in tenant_entitlements
        override = (
            db.query(TenantEntitlement)
            .filter(
                TenantEntitlement.tenant_id == tid,
                TenantEntitlement.feature_key == feature_key
            )
            .first()
        )
        if override:
            vu = cls._aware(override.valid_until)
            if vu and vu < now:
                return False
            return bool(override.is_enabled)

        # 2. Subscription Lifecycle Check
        status = cls.evaluate_subscription_lifecycle(db, tid, now)
        if status in ("SUSPENDED", "EXPIRED", "CANCELLED"):
            # Non-destructive: read-only features remain accessible
            return feature_key in READ_ONLY_FALLBACK_FEATURES

        # 3. Plan-based Feature Lookup
        sub = db.query(InstitutionSubscription).filter(InstitutionSubscription.tenant_id == tid).first()
        if not sub:
            # New/unprovisioned tenant gets free trial features
            return feature_key in PLAN_FEATURES.get("free_trial", [])

        plan_tier = sub.plan_tier or "school_starter"
        allowed_features = PLAN_FEATURES.get(plan_tier, PLAN_FEATURES.get("school_starter", []))
        return feature_key in allowed_features

    @classmethod
    def check_and_consume_quota(
        cls,
        db: Session,
        tenant_id: str,
        metric: str,
        amount: int = 1,
        now: Optional[datetime.datetime] = None
    ) -> Tuple[bool, int, int]:
        """
        Atomic Quota Validation and Consumption.
        Returns: (allowed: bool, current_usage: int, limit: int)
        """
        now = now or cls._utc_now()
        tid = str(tenant_id)

        # Ensure lifecycle is up to date
        status = cls.evaluate_subscription_lifecycle(db, tid, now)
        if status in ("SUSPENDED", "EXPIRED", "CANCELLED"):
            return False, 0, 0

        sub = (
            db.query(InstitutionSubscription)
            .filter(InstitutionSubscription.tenant_id == tid)
            .with_for_update()
            .first()
        )
        if not sub:
            return False, 0, 0

        if metric == "ai_questions":
            limit = sub.ai_question_quota_monthly or 30
            used = sub.ai_questions_used_this_month or 0
            if (used + amount) > limit:
                return False, used, limit
            sub.ai_questions_used_this_month = used + amount
            db.commit()
            return True, sub.ai_questions_used_this_month, limit

        elif metric == "active_students":
            limit = sub.max_active_students or 50
            current_active = db.query(Student).filter(Student.tenant_id == tid, Student.status == "Active").count()
            if (current_active + amount) > limit:
                return False, current_active, limit
            return True, current_active, limit

        return True, 0, 0

    @classmethod
    def sync_tenant_entitlements_for_plan(
        cls,
        db: Session,
        tenant_id: str,
        plan_key: str
    ) -> None:
        """
        Provisions or refreshes default feature entitlements when a plan is activated.
        """
        tid = str(tenant_id)
        features = PLAN_FEATURES.get(plan_key, [])
        for feat in features:
            existing = (
                db.query(TenantEntitlement)
                .filter(
                    TenantEntitlement.tenant_id == tid,
                    TenantEntitlement.feature_key == feat
                )
                .first()
            )
            if not existing:
                db.add(TenantEntitlement(
                    tenant_id=tid,
                    feature_key=feat,
                    is_enabled=True,
                    metadata_payload={"source_plan": plan_key}
                ))
        db.commit()


# ========================================================================================
# FastAPI Dependency Factories
# ========================================================================================

def require_entitlement(feature_key: str) -> Callable:
    """
    FastAPI Route Dependency Guard.
    Raises HTTP 403 Forbidden if the authenticated tenant is not entitled to the feature.
    """
    def _guard(
        db: Session = Depends(get_db),
        tenant_id: str = Depends(get_current_tenant_id)
    ):
        entitled = EntitlementService.has_entitlement(db, tenant_id, feature_key)
        if not entitled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FEATURE_NOT_ENTITLED",
                    "message": f"Tenant is not entitled to use '{feature_key}'. Please upgrade your subscription plan.",
                    "feature": feature_key
                }
            )
        return True

    return _guard


def require_active_subscription() -> Callable:
    """
    FastAPI Route Dependency Guard.
    Guarantees the tenant's subscription is not in SUSPENDED, EXPIRED, or CANCELLED status.
    """
    def _guard(
        db: Session = Depends(get_db),
        tenant_id: str = Depends(get_current_tenant_id)
    ):
        lifecycle = EntitlementService.evaluate_subscription_lifecycle(db, tenant_id)
        if lifecycle in ("SUSPENDED", "EXPIRED", "CANCELLED"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "SUBSCRIPTION_SUSPENDED",
                    "message": "Tenant subscription is currently suspended or expired. Read-only mode active. Please renew payment.",
                    "status": lifecycle
                }
            )
        return True

    return _guard

