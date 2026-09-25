import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.campus import CampusBranch

router = APIRouter(tags=["CampusOS & Multi-Branch"])

class BranchCreatePayload(BaseModel):
    branch_name: str = Field(..., example="Kandirpar Main Campus")
    branch_code: str = Field(..., example="KSIS-MAIN")
    address: str = Field(default="Nazrul Avenue, Kandirpar, Cumilla-3500")
    phone: str = Field(default="+8801971122084")
    is_main_branch: bool = True

@router.get("/branches")
def list_branches(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    branches = db.query(CampusBranch).filter(CampusBranch.tenant_id == str(tenant_id)).all()
    if not branches:
        # Auto-seed default main branch if none exists
        default_b = CampusBranch(
            tenant_id=str(tenant_id),
            branch_name="Main Campus (Kandirpar)",
            branch_code="KSIS-MAIN",
            address="Nazrul Avenue, Kandirpar, Cumilla-3500",
            phone="+8801971122084",
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