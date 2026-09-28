import jwt

from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional, Dict
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("Password too long (max 72 bytes)")
    return pwd_context.hash(password)


def create_access_token(
    data: Optional[Dict[str, Any]] = None,
    subject: Optional[Union[str, Any]] = None,
    expires_delta: Optional[timedelta] = None,
    **kwargs: Any
) -> str:
    """
    Production-grade flexible JWT token generator.
    Safely merges `data`, `subject`, and arbitrary payload kwargs.
    """
    to_encode: Dict[str, Any] = {}
    if data:
        to_encode.update(data)
    if subject:
        to_encode["sub"] = str(subject)
    if kwargs:
        to_encode.update(kwargs)

    now = datetime.now(timezone.utc)
    expire = now + (expires_delta if expires_delta else timedelta(days=7))
    to_encode.update({"exp": expire, "iat": now})

    secret = getattr(settings, "JWT_SECRET_KEY", None) or getattr(settings, "SECRET_KEY", "educationos_secret_key_2026")
    algorithm = getattr(settings, "JWT_ALGORITHM", "HS256")

    return jwt.encode(to_encode, secret, algorithm=algorithm)