from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.config import settings
from app.core.database import get_db
from app.models.tenant import User
from app.schemas.auth import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/login/access-token")

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    """
    টোকেন ডিকোড করে ইউজারের ভ্যালিডিটি চেক করবে
    """
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=["HS256"]
        )
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user = db.query(User).filter(User.id == token_data.sub).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    চেক করবে ইউজার অ্যাক্টিভ আছে কিনা।
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_tenant_id(
    current_user: User = Depends(get_current_active_user),
) -> str:
    """
    লগইন করা ইউজারের টোকেন থেকে সরাসরি তার স্কুলের ID (tenant_id) রিটার্ন করবে।
    ভবিষ্যতে সব API-তে আমরা ডেটা ফিল্টার করতে এটি ব্যবহার করব।
    """
    return str(current_user.tenant_id)


def get_current_user_claims(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # JWT Secret থেকে পেলোড ডিকোড করা
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        tenant_id: str = payload.get("tenant_id")
        user_id: str = payload.get("sub")
        role: str = payload.get("role", "admin").lower()
        if tenant_id is None or user_id is None:
            raise credentials_exception
        return {"tenant_id": tenant_id, "user_id": user_id, "role": role}
    except JWTError:
        raise credentials_exception

def get_current_tenant_id(claims: dict = Depends(get_current_user_claims)) -> str:
    """Returns strictly verified tenant_id from JWT."""
    return claims["tenant_id"]

def require_roles(allowed_roles: list[str]):
    """
    RBAC Gatekeeper: Ensures the logged-in entity has proper clearance.
    Usage: Depends(require_roles(["admin", "teacher"]))
    """
    def role_checker(claims: dict = Depends(get_current_user_claims)):
        if claims["role"] not in [r.lower() for r in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for this institutional operation"
            )
        return claims
    return role_checker