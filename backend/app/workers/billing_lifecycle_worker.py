# backend/app/workers/billing_lifecycle_worker.py
"""
EducationOS SaaS Billing & Subscription Lifecycle Automation Worker.
Executes scheduled sweeps across all tenant subscriptions to evaluate:
1. Subscription validity and renewal dates.
2. Dunning transitions (ACTIVE -> GRACE_PERIOD -> SUSPENDED).
3. Free trial expiration (TRIALING -> EXPIRED).
4. Non-destructive suspension enforcement (preserves read-only access).
5. Automated dunning alerts and audit ledger logging.
"""
import sys
import logging
import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.subscription import InstitutionSubscription
from app.models.billing import BillingAuditLog
from app.services.entitlement import EntitlementService

logger = logging.getLogger("educationos.workers.billing_lifecycle")


class BillingLifecycleWorker:
    """
    Automated worker executing daily/periodic subscription lifecycle evaluations,
    dunning workflows, and non-destructive suspension transitions.
    """

    def __init__(self, db: Session, custom_logger: Optional[logging.Logger] = None):
        self.db = db
        self.log = custom_logger or logger

    @staticmethod
    def _utc_now() -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    @staticmethod
    def _aware(dt: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=datetime.timezone.utc)
        return dt.astimezone(datetime.timezone.utc)

    def evaluate_tenant(
        self,
        subscription: InstitutionSubscription,
        now: Optional[datetime.datetime] = None
    ) -> Dict[str, Any]:
        """
        Evaluates a single tenant subscription's lifecycle status and executes dunning actions.
        """
        now = now or self._utc_now()
        tid = str(subscription.tenant_id)
        old_status = subscription.subscription_status
        notifications_sent: List[str] = []

        # 1. Execute canonical lifecycle evaluation via EntitlementService
        new_status = EntitlementService.evaluate_subscription_lifecycle(self.db, tid, now)

        # 2. Dunning Notice Stage 1: Transitioned from ACTIVE to GRACE_PERIOD
        if old_status == "ACTIVE" and new_status == "GRACE_PERIOD":
            grace_until = self._aware(subscription.grace_period_until)
            grace_iso = grace_until.isoformat() if grace_until else ""
            self.log.warning(
                "Tenant %s entered GRACE_PERIOD until %s. Initiating Stage 1 dunning notice.",
                tid, grace_iso
            )
            self.db.add(BillingAuditLog(
                tenant_id=tid,
                actor_id="billing_lifecycle_worker",
                action="DUNNING_NOTICE_STAGE_1",
                old_state={"status": old_status},
                new_state={"status": new_status, "grace_period_until": grace_iso},
                reason=f"Subscription invoice overdue. 7-day grace period active until {grace_iso}."
            ))
            notifications_sent.append("DUNNING_STAGE_1_GRACE_PERIOD")

        # 3. Dunning Notice Stage 2: Transitioned from GRACE_PERIOD to SUSPENDED
        elif old_status == "GRACE_PERIOD" and new_status == "SUSPENDED":
            self.log.warning(
                "Tenant %s grace period elapsed. Transitioning to non-destructive SUSPENDED state.",
                tid
            )
            self.db.add(BillingAuditLog(
                tenant_id=tid,
                actor_id="billing_lifecycle_worker",
                action="DUNNING_NOTICE_STAGE_2",
                old_state={"status": old_status},
                new_state={"status": new_status, "mode": "NON_DESTRUCTIVE_READ_ONLY"},
                reason="Grace period expired without settlement. Write capabilities locked; read-only data access preserved."
            ))
            notifications_sent.append("DUNNING_STAGE_2_SUSPENDED")

        # 4. Proactive Grace Warning: Remaining grace period <= 2 days
        elif new_status == "GRACE_PERIOD":
            grace_until = self._aware(subscription.grace_period_until)
            if grace_until:
                remaining_seconds = (grace_until - now).total_seconds()
                remaining_days = remaining_seconds / 86400.0
                if 0 < remaining_days <= 2.0:
                    self.log.info(
                        "Tenant %s has %.1f days remaining in grace period. Emitting urgent warning.",
                        tid, remaining_days
                    )
                    self.db.add(BillingAuditLog(
                        tenant_id=tid,
                        actor_id="billing_lifecycle_worker",
                        action="DUNNING_URGENT_WARNING",
                        old_state={"status": "GRACE_PERIOD"},
                        new_state={"remaining_days": round(remaining_days, 1)},
                        reason=f"Urgent: {round(remaining_days, 1)} days remaining before non-destructive account suspension."
                    ))
                    notifications_sent.append("DUNNING_URGENT_WARNING")

        # 5. Free Trial Expiration: Transitioned to EXPIRED
        elif old_status == "TRIALING" and new_status == "EXPIRED":
            self.log.info("Tenant %s trial period ended. Status set to EXPIRED.", tid)
            self.db.add(BillingAuditLog(
                tenant_id=tid,
                actor_id="billing_lifecycle_worker",
                action="TRIAL_EXPIRED_NOTICE",
                old_state={"status": old_status},
                new_state={"status": new_status},
                reason="Institution 14-day free trial has concluded without paid plan activation."
            ))
            notifications_sent.append("TRIAL_EXPIRED")

        if notifications_sent:
            self.db.commit()

        return {
            "tenant_id": tid,
            "old_status": old_status,
            "new_status": new_status,
            "transitioned": old_status != new_status,
            "notifications": notifications_sent
        }

    def run_sweep(self, now: Optional[datetime.datetime] = None) -> Dict[str, Any]:
        """
        Executes a full lifecycle sweep across all active, trialing, and grace-period subscriptions.
        """
        now = now or self._utc_now()
        subscriptions = self.db.query(InstitutionSubscription).all()

        summary: Dict[str, Any] = {
            "evaluated_at": now.isoformat(),
            "total_evaluated": len(subscriptions),
            "transitions_count": 0,
            "active_count": 0,
            "grace_period_count": 0,
            "suspended_count": 0,
            "expired_count": 0,
            "notifications_dispatched": 0,
            "errors": [],
            "details": []
        }

        for sub in subscriptions:
            try:
                res = self.evaluate_tenant(sub, now=now)
                summary["details"].append(res)
                if res["transitioned"]:
                    summary["transitions_count"] += 1
                summary["notifications_dispatched"] += len(res["notifications"])

                # Count final status
                final_st = res["new_status"]
                if final_st == "ACTIVE":
                    summary["active_count"] += 1
                elif final_st == "GRACE_PERIOD":
                    summary["grace_period_count"] += 1
                elif final_st == "SUSPENDED":
                    summary["suspended_count"] += 1
                elif final_st == "EXPIRED":
                    summary["expired_count"] += 1

            except Exception as exc:
                self.log.error("Error evaluating subscription for tenant %s: %s", sub.tenant_id, exc, exc_info=True)
                summary["errors"].append({
                    "tenant_id": str(sub.tenant_id),
                    "error": str(exc)
                })

        return summary


def run_billing_lifecycle_sweep(
    db: Session,
    now: Optional[datetime.datetime] = None
) -> Dict[str, Any]:
    """
    Convenience function to run a billing lifecycle sweep against a provided database session.
    """
    worker = BillingLifecycleWorker(db=db)
    return worker.run_sweep(now=now)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        results = run_billing_lifecycle_sweep(db)
        print("Billing Lifecycle Sweep Complete:")
        print(f"Total Evaluated: {results['total_evaluated']}")
        print(f"Transitions:     {results['transitions_count']}")
        print(f"Active:          {results['active_count']}")
        print(f"Grace Period:    {results['grace_period_count']}")
        print(f"Suspended:       {results['suspended_count']}")
        print(f"Expired:         {results['expired_count']}")
        print(f"Notifications:   {results['notifications_dispatched']}")
        if results["errors"]:
            print(f"Errors ({len(results['errors'])}): {results['errors']}")
            sys.exit(1)
    finally:
        db.close()

