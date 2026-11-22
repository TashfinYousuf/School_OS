import uuid
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import (
    get_db,
    get_current_active_user,
    get_current_tenant_id,
    get_current_user_claims,
    require_roles,
    require_permissions
)
from app.core.rbac import (
    Permission,
    RoleEnum,
    ROLE_PERMISSIONS,
    normalize_role,
    validate_role_assignment
)
from app.core.security import get_password_hash, verify_password
from app.models.tenant import User, Tenant
from app.schemas.user import UserCreate, UserResponse

router = APIRouter()


class UpdateUserRolePayload(BaseModel):
    role: str


class UserProfileUpdatePayload(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class ChangePasswordPayload(BaseModel):
    old_password: str
    new_password: str


@router.get("/roles/catalog")
def list_roles_and_permissions(
    claims: dict = Depends(get_current_user_claims)
):
    """
    Returns the comprehensive catalog of platform and tenant roles and their effective permissions.
    """
    return {
        "roles": [r.value for r in RoleEnum],
        "permissions": {
            role: sorted(list(perms)) for role, perms in ROLE_PERMISSIONS.items()
        }
    }


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Create a new user under the verified Tenant (School) with role assignment validation.
    """
    target_role = getattr(user_in, "role", None) or "teacher"
    # Privilege escalation guard: validate actor can assign this role
    validate_role_assignment(
        actor_role=claims.get("role", ""),
        target_role=target_role,
        actor_user_id=claims.get("user_id", ""),
        target_user_id="new-user"
    )

    try:
        tenant_uuid = uuid.UUID(str(tenant_id)) if not isinstance(tenant_id, uuid.UUID) else tenant_id
    except (ValueError, AttributeError):
        tenant_uuid = tenant_id

    existing_user = db.query(User).filter(
        User.email == user_in.email, 
        User.tenant_id == tenant_uuid
    ).first()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="A user with this email already exists in this school."
        )

    hashed_password = get_password_hash(user_in.password)
    
    new_user = User(
        email=user_in.email,
        password_hash=hashed_password,
        tenant_id=tenant_uuid,
        role=normalize_role(target_role),
        is_active=user_in.is_active
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


@router.put("/{target_user_id}/role", response_model=UserResponse)
def update_user_role(
    target_user_id: uuid.UUID,
    payload: UpdateUserRolePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.ROLES_MANAGE]))
):
    """
    Assigns or updates a user's role within the tenant.
    Enforces strict privilege escalation checks (no self-escalation, no superadmin assignment by tenant admins).
    """
    validate_role_assignment(
        actor_role=claims.get("role", ""),
        target_role=payload.role,
        actor_user_id=claims.get("user_id", ""),
        target_user_id=str(target_user_id)
    )

    try:
        tenant_uuid = uuid.UUID(str(tenant_id)) if not isinstance(tenant_id, uuid.UUID) else tenant_id
    except (ValueError, AttributeError):
        tenant_uuid = tenant_id

    user = db.query(User).filter(
        User.id == target_user_id,
        User.tenant_id == tenant_uuid
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in this institution."
        )

    user.role = normalize_role(payload.role)
    db.commit()
    db.refresh(user)
    return user


# --- NEW PROTECTED ROUTE ---
@router.get("/me", response_model=UserResponse)
def read_user_me(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get current logged in user's profile.
    This is a PROTECTED route. You must be logged in to access this.
    """
    return current_user


@router.patch("/me")
def update_user_me(
    payload: UserProfileUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Updates the authenticated user's personal profile (first name, last name).
    """
    if payload.first_name is not None:
        current_user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        current_user.last_name = payload.last_name.strip()
    db.commit()
    db.refresh(current_user)
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "tenant_id": str(current_user.tenant_id),
    }


@router.post("/me/change-password")
def change_password_me(
    payload: ChangePasswordPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Changes the authenticated user's password after verifying the current password.
    Enforces password complexity policy (min 10 chars, letters & digits, max 72 bytes).
    """
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    new_pw = payload.new_password
    if len(new_pw) < 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at least 10 characters.")
    if len(new_pw.encode("utf-8")) > 72:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must be at most 72 bytes.")
    if not (re.search(r"[A-Za-z]", new_pw) and re.search(r"\d", new_pw)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Password must contain both letters and digits.")

    current_user.password_hash = get_password_hash(new_pw)
    db.commit()
    return {"message": "Password changed successfully."}


@router.get("/", response_model=List[UserResponse])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_permissions([Permission.USERS_READ]))
):
    """
    Get all users for the authenticated tenant.
    """
    try:
        t_uuid = uuid.UUID(str(tenant_id))
    except (ValueError, TypeError):
        t_uuid = tenant_id

    users = db.query(User).filter(
        User.tenant_id == t_uuid
    ).offset(skip).limit(limit).all()
    return users


# --- USER LIFECYCLE & SAFE DELETION MANAGEMENT ---
from app.services.lifecycle import LifecycleService

@router.get("/{target_user_id}/dependencies")
def get_user_dependencies(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Returns dependency inventory for target user (profiles, authored audits, etc.)
    """
    dep = LifecycleService.get_user_dependencies(db, str(tenant_id), target_user_id)
    if not dep.get("found"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return dep


@router.post("/{target_user_id}/deactivate")
def deactivate_user(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Safely deactivates user without deleting records or breaking dependencies.
    """
    actor_id = str(claims.get("user_id") or "admin")
    res = LifecycleService.deactivate_user(db, str(tenant_id), target_user_id, actor_id)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error"))
    return res


@router.post("/{target_user_id}/reactivate")
def reactivate_user(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Reactivates a deactivated user.
    """
    actor_id = str(claims.get("user_id") or "admin")
    res = LifecycleService.reactivate_user(db, str(tenant_id), target_user_id, actor_id)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error"))
    return res


@router.post("/{target_user_id}/anonymize")
def anonymize_user(
    target_user_id: uuid.UUID,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Anonymizes user PII while preserving audit and financial ledger integrity.
    """
    actor_id = str(claims.get("user_id") or "admin")
    res = LifecycleService.anonymize_user(db, str(tenant_id), target_user_id, actor_id)
    if not res.get("success"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error"))
    return res


@router.delete("/{target_user_id}")
def delete_user(
    target_user_id: uuid.UUID,
    permanent: bool = False,
    confirmed: bool = False,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_permissions([Permission.USERS_MANAGE]))
):
    """
    Safe User Deletion:
    Default behavior is SOFT DELETION (is_active=False, deleted_at=now).
    Permanent deletion requires permanent=true and confirmed=true.
    """
    actor_id = str(claims.get("user_id") or "admin")
    if permanent:
        res = LifecycleService.delete_user_permanent(db, str(tenant_id), target_user_id, actor_id, confirmed=confirmed)
        if not res.get("success"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=res.get("error"))
        return res
    else:
        res = LifecycleService.soft_delete_user(db, str(tenant_id), target_user_id, actor_id)
        if not res.get("success"):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=res.get("error"))
        return res
