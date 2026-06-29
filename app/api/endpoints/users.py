from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.tenant import User, Tenant
from app.schemas.user import UserCreate, UserResponse

# --- NEW: Import our dependencies for Protected Route ---
from app.api.deps import get_current_active_user

router = APIRouter()

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user under a specific Tenant (School).
    """
    tenant = db.query(Tenant).filter(Tenant.id == user_in.tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="The specified Tenant (School) does not exist."
        )

    existing_user = db.query(User).filter(
        User.email == user_in.email, 
        User.tenant_id == user_in.tenant_id
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
        tenant_id=user_in.tenant_id,
        is_active=user_in.is_active
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return new_user


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


@router.get("/", response_model=List[UserResponse])
def get_users(tenant_id: str, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Get all users for a specific school.
    """
    users = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.deleted_at.is_(None)
    ).offset(skip).limit(limit).all()
    return users