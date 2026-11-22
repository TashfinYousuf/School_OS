import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_tenant_id, require_roles
from app.models.campus import CampusBranch
from app.services.institution import get_institution_profile

router = APIRouter()

class BranchCreatePayload(BaseModel):
    branch_name: str = Field(..., json_schema_extra={"example": "Main Campus"})
    address: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    is_main_branch: bool = True

@router.get("/branches")
def list_branches(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    inst = get_institution_profile(db, tenant_id)
    branches = db.query(CampusBranch).filter(CampusBranch.tenant_id == str(tenant_id)).all()
    
    if not branches:
        # Auto-seed default main branch if none exists
        default_b = CampusBranch(
            tenant_id=str(tenant_id),
            branch_name="Main Campus", 
            address=inst.address, 
            phone=inst.phone,
            branch_code=str,
            is_main_branch=True
        )
        db.add(default_b)
        db.commit()
        db.refresh(default_b)
        branches = [default_b]

    return branches

@router.post("/branches", status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    branch = CampusBranch(
        tenant_id=str(tenant_id),
        **payload.model_dump()
    )
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return {"message": "Branch established", "branch": branch}