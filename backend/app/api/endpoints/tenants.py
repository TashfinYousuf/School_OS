import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import require_roles
from app.core.database import get_db as get_global_db
from app.models.tenant import Tenant
from app.models.subscription import InstitutionSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.student import Student
from app.models.audit import AuditLog
from app.schemas.tenant import TenantCreate, TenantResponse

router = APIRouter()

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(
    tenant_in: TenantCreate,
    db: Session = Depends(get_global_db),
    _=Depends(require_roles(["superadmin"]))
):
    """
    Onboard a new School (Tenant) into EducationOS (Superadmin only).
    """
    # Check if domain already exists to prevent duplicates
    if tenant_in.domain:
        existing_tenant = db.query(Tenant).filter(Tenant.domain == tenant_in.domain).first()
        if existing_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="This domain is already registered to another school."
            )

    # Create new SQLAlchemy model instance
    new_tenant = Tenant(
        school_name=tenant_in.school_name,
        domain=tenant_in.domain,
        address=tenant_in.address
    )
    
    # Save to database
    db.add(new_tenant)
    db.commit()
    db.refresh(new_tenant) # Get the generated ID and timestamps
    
    return new_tenant


@router.get("/", response_model=List[TenantResponse])
def get_tenants(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_global_db),
    _=Depends(require_roles(["superadmin"]))
):
    """
    Retrieve all registered schools (Superadmin only).
    """
    tenants = db.query(Tenant).offset(skip).limit(limit).all()
    return tenants


@router.get("/overview/stats")
def get_platform_overview_stats(
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Platform-wide high-level metrics for Platform Superadmin Console.
    """
    total_tenants = db.query(Tenant).count()
    active_subscriptions = db.query(InstitutionSubscription).filter(
        InstitutionSubscription.subscription_status == "ACTIVE"
    ).count()
    trialing_subscriptions = db.query(InstitutionSubscription).filter(
        InstitutionSubscription.subscription_status == "TRIALING"
    ).count()
    suspended_subscriptions = db.query(InstitutionSubscription).filter(
        InstitutionSubscription.subscription_status.in_(["SUSPENDED", "CANCELLED", "EXPIRED"])
    ).count()
    pending_payments = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.status.in_(["PENDING", "SUBMITTED"])
    ).count()

    return {
        "status": "healthy",
        "total_tenants": total_tenants,
        "active_subscriptions": active_subscriptions,
        "trialing_subscriptions": trialing_subscriptions,
        "suspended_subscriptions": suspended_subscriptions,
        "pending_payments": pending_payments,
        "system_health": "operational",
    }


@router.get("/directory")
def get_tenant_directory(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Detailed tenant directory with subscription status, tier, and student count.
    """
    tenants = db.query(Tenant).offset(skip).limit(limit).all()
    result = []
    for t in tenants:
        tid_str = str(t.id)
        sub = db.query(InstitutionSubscription).filter(
            InstitutionSubscription.tenant_id == tid_str
        ).first()
        student_count = db.query(Student).filter(
            Student.tenant_id == tid_str,
            Student.status == "Active"
        ).count()
        result.append({
            "id": tid_str,
            "school_name": t.school_name,
            "domain": t.domain,
            "address": t.address,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "plan_tier": sub.plan_tier if sub else "growth",
            "subscription_status": sub.subscription_status if sub else "ACTIVE",
            "monthly_fee": sub.monthly_fee if sub else 2490.0,
            "max_active_students": sub.max_active_students if sub else 500,
            "active_students": student_count,
            "valid_until": sub.valid_until.isoformat() if sub and sub.valid_until else None,
        })
    return result


@router.post("/{tenant_id}/suspend")
def suspend_tenant(
    tenant_id: str,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Suspends tenant institutional subscription and logs audit action.
    """
    operator_id = str(claims.get("user_id") or claims.get("sub") or "platform_superadmin")
    sub = db.query(InstitutionSubscription).filter(
        InstitutionSubscription.tenant_id == tenant_id
    ).first()
    if not sub:
        sub = InstitutionSubscription(
            tenant_id=tenant_id,
            subscription_status="SUSPENDED",
            valid_until=datetime.datetime.now(datetime.timezone.utc)
        )
        db.add(sub)
    else:
        sub.subscription_status = "SUSPENDED"

    audit = AuditLog(
        tenant_id=tenant_id,
        actor_id=operator_id,
        action_type="tenant.suspended",
        target_entity=f"Tenant {tenant_id}",
        risk_level="High",
        event_payload={"tenant_id": tenant_id, "status": "SUSPENDED"}
    )
    db.add(audit)
    db.commit()
    return {"status": "suspended", "tenant_id": tenant_id}


@router.post("/{tenant_id}/activate")
def activate_tenant(
    tenant_id: str,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Reactivates tenant institutional subscription and logs audit action.
    """
    operator_id = str(claims.get("user_id") or claims.get("sub") or "platform_superadmin")
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    sub = db.query(InstitutionSubscription).filter(
        InstitutionSubscription.tenant_id == tenant_id
    ).first()
    if not sub:
        sub = InstitutionSubscription(
            tenant_id=tenant_id,
            subscription_status="ACTIVE",
            valid_until=now_utc + datetime.timedelta(days=30)
        )
        db.add(sub)
    else:
        sub.subscription_status = "ACTIVE"
        vu = sub.valid_until
        if vu and vu.tzinfo is None:
            vu = vu.replace(tzinfo=datetime.timezone.utc)
        if not vu or vu < now_utc:
            sub.valid_until = now_utc + datetime.timedelta(days=30)

    audit = AuditLog(
        tenant_id=tenant_id,
        actor_id=operator_id,
        action_type="tenant.activated",
        target_entity=f"Tenant {tenant_id}",
        risk_level="Medium",
        event_payload={"tenant_id": tenant_id, "status": "ACTIVE"}
    )
    db.add(audit)
    db.commit()
    return {"status": "active", "tenant_id": tenant_id}


# --- TENANT LIFECYCLE & SAFE ARCHIVAL / DELETION ---
from app.services.lifecycle import LifecycleService

@router.get("/{tenant_id}/dependencies")
def get_tenant_dependencies(
    tenant_id: str,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Returns complete dependency inventory for a school/tenant before archival or deletion.
    """
    dep = LifecycleService.get_tenant_dependencies(db, tenant_id)
    if not dep.get("found"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return dep


@router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: str,
    permanent: bool = False,
    confirmed: bool = False,
    db: Session = Depends(get_global_db),
    claims: dict = Depends(require_roles(["superadmin"]))
):
    """
    Safe Tenant Deletion:
    Default behavior is ARCHIVAL (is_active=False, deleted_at=now, user accounts deactivated).
    Permanent deletion requires permanent=true and confirmed=true.
    """
    actor_id = str(claims.get("user_id") or claims.get("sub") or "superadmin")
    if permanent:
        res = LifecycleService.delete_tenant_permanent(db, tenant_id, actor_id, confirmed=confirmed)
        if not res.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error"))
        return res
    else:
        res = LifecycleService.archive_tenant(db, tenant_id, actor_id)
        if not res.get("success"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error"))
        return res
