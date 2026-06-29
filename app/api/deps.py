from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.config import settings
from app.core.database import get_db
from app.models.tenant import User
from app.schemas.auth import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)

def get_current_user(
    db: Session = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    """
    টোকেন ডিকোড করে ইউজারের ভ্যালিডিটি চেক করবে।
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