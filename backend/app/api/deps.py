# backend/app/api/deps.py
import jwt
from typing import List, Optional
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_tenant_db
from app.models.tenant import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login/access-token")


def get_current_user_claims(
    token: str = Depends(oauth2_scheme),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID")
) -> dict:
    """
    Decodes the JWT and extracts user_id, tenant_id, and role.
    Supports dynamic workspace switching via X-Tenant-ID header.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        token_tenant_id = payload.get("tenant_id")
        user_id = payload.get("sub")
        role = payload.get("role", "student").lower()

        if not token_tenant_id or not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed token: Tenant context missing."
            )

        # Allow switching workspaces if header is provided
        active_tenant = x_tenant_id or token_tenant_id

        return {
            "tenant_id": str(active_tenant),
            "user_id": str(user_id),
            "role": role
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired. Please sign in again."
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security Violation: Could not validate credentials."
        )


def get_current_tenant_id(claims: dict = Depends(get_current_user_claims)) -> str:
    """Returns verified tenant_id string."""
    return claims["tenant_id"]


def get_db(tenant_id: str = Depends(get_current_tenant_id)):
    """Provides an RLS-locked database session tied to verified tenant."""
    yield from get_tenant_db(tenant_id)


def get_current_user(
    db: Session = Depends(get_db),
    claims: dict = Depends(get_current_user_claims)
) -> User:
    """
    Fetches the User ORM entity from the database for the active tenant.
    """
    user = db.query(User).filter(
        User.id == claims["user_id"],
        User.tenant_id == claims["tenant_id"]
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authenticated user account not found in this workspace."
        )
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Guarantees the account is active before executing sensitive operations.
    """
    if hasattr(current_user, "is_active") and not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended or deactivated."
        )
    return current_user


def require_roles(allowed_roles: List[str]):
    """
    FastAPI RBAC dependency guard.
    """
    def role_checker(claims: dict = Depends(get_current_user_claims)):
        user_role = claims.get("role", "").lower()
        normalized_allowed = [r.lower() for r in allowed_roles]

        if user_role not in normalized_allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Security Policy Violation: Requires roles {allowed_roles}, found '{user_role}'."
            )
        return claims
    return role_checker