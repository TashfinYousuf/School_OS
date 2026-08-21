from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import uuid

from app.models.approval import ApprovalTask
from app.schemas.approval import ApprovalTaskResponse, ApprovalTaskUpdate, ApprovalTaskCreate
from app.core.database import get_db
from app.api.deps import get_current_tenant_id

router = APIRouter()

@router.get("/", response_model=List[ApprovalTaskResponse])
def get_pending_tasks(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    return db.query(ApprovalTask).filter(
        ApprovalTask.tenant_id == tenant_id,
        ApprovalTask.status == "Pending"
    ).order_by(ApprovalTask.created_at.desc()).all()

@router.patch("/{task_id}", response_model=ApprovalTaskResponse)
def resolve_task(
    task_id: uuid.UUID,
    update_data: ApprovalTaskUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    task = db.query(ApprovalTask).filter(ApprovalTask.id == task_id, ApprovalTask.tenant_id == tenant_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update payload if edited
    if update_data.payload_content:
        task.payload_content = update_data.payload_content
    
    task.status = update_data.status
    db.commit()
    db.refresh(task)
    return task

# Demo endpoint to generate a fake AI task for UI testing
@router.post("/demo", response_model=ApprovalTaskResponse)
def create_demo_task(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    demo_task = ApprovalTask(
        tenant_id=tenant_id,
        title="Draft Notice: Unpaid Tuition Reminder",
        action_type="notice.draft",
        payload_content="Dear Parent,\nThis is a gentle reminder that the tuition fee for the current semester is overdue. Please process the payment by next week.\n\nRegards,\nKids Shine Academy.",
        risk_level="Medium"
    )
    db.add(demo_task)
    db.commit()
    db.refresh(demo_task)
    return demo_task