from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantResponse

router = APIRouter()

@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant(tenant_in: TenantCreate, db: Session = Depends(get_db)):
    """
    Onboard a new School (Tenant) into SchoolOS.
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
def get_tenants(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    Retrieve all registered schools.
    """
    # Filter out soft-deleted tenants
    tenants = db.query(Tenant).filter(Tenant.deleted_at.is_(None)).offset(skip).limit(limit).all()
    return tenants