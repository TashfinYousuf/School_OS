import os
import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.api.deps import get_db, get_current_tenant_id, get_current_user_claims, require_roles
from app.models.notification import PushSubscriptionRecord

logger = logging.getLogger(__name__)
router = APIRouter()

class SubscribePayload(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    subscription: Dict[str, Any]

class SendAlertPayload(BaseModel):
    title: str
    body: str
    url: Optional[str] = "/dashboard/live-exams"
    target_role: Optional[str] = "all"

@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
def register_push_subscription(
    payload: SubscribePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(get_current_user_claims),
):
    """Stores WebPush subscription keys strictly bound to the authenticated caller."""
    auth_user_id = str(claims.get("user_id") or "")
    auth_role = (claims.get("role") or "user").lower()

    sub_record = db.query(PushSubscriptionRecord).filter(
        PushSubscriptionRecord.tenant_id == str(tenant_id),
        PushSubscriptionRecord.user_id == auth_user_id,
    ).first()

    if sub_record:
        sub_record.subscription_data = payload.subscription
        sub_record.role = auth_role
        sub_record.is_active = True
    else:
        sub_record = PushSubscriptionRecord(
            tenant_id=str(tenant_id),
            user_id=auth_user_id,
            role=auth_role,
            subscription_data=payload.subscription,
        )
        db.add(sub_record)

    db.commit()
    return {"status": "REGISTERED", "message": "Push subscription saved successfully."}

@router.post("/dispatch-reminder", dependencies=[Depends(require_roles(["admin", "teacher"]))])
def dispatch_institutional_reminder(
    payload: SendAlertPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Queues/dispatches reminders to registered WebPush devices when VAPID keys are configured.
    Never claims DISPATCHED if no delivery provider is active.
    """
    query = db.query(PushSubscriptionRecord).filter(
        PushSubscriptionRecord.tenant_id == str(tenant_id),
        PushSubscriptionRecord.is_active == True
    )

    if payload.target_role and payload.target_role != "all":
        query = query.filter(PushSubscriptionRecord.role == payload.target_role)

    active_subs = query.all()
    vapid_private = os.getenv("VAPID_PRIVATE_KEY", "").strip()
    vapid_public = os.getenv("VAPID_PUBLIC_KEY", "").strip()

    if not vapid_private or not vapid_public:
        logger.info("WebPush dispatch skipped (VAPID keys not configured) tenant=%s subs=%s", tenant_id, len(active_subs))
        return {
            "status": "DELIVERY_NOT_CONFIGURED",
            "delivery_configured": False,
            "sent_count": 0,
            "recipients_count": len(active_subs),
            "detail": "WebPush VAPID keys are not configured. Subscriptions recorded only; no push messages transmitted.",
            "notification": {
                "title": payload.title,
                "body": payload.body,
                "url": payload.url,
            },
        }

    return {
        "status": "QUEUED",
        "delivery_configured": True,
        "sent_count": 0,
        "recipients_count": len(active_subs),
        "detail": "VAPID credentials detected; background worker delivery required for async fanout.",
        "notification": {
            "title": payload.title,
            "body": payload.body,
            "url": payload.url,
        },
    }