# backend/app/api/endpoints/approval.py
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.models.approval import ApprovalTask
from app.models.audit import AuditLog
from app.schemas.approval import ApprovalTaskResponse, ApprovalTaskUpdate, ApprovalTaskCreate
from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles

router = APIRouter(prefix="/approvals", tags=["Action Center & Approvals"])

@router.get("/", response_model=List[ApprovalTaskResponse])
def get_pending_tasks(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Retrieves all pending AI action tasks awaiting admin review."""
    return db.query(ApprovalTask).filter(
        ApprovalTask.tenant_id == tenant_id,
        ApprovalTask.status == "Pending"
    ).order_by(ApprovalTask.created_at.desc()).all()


@router.patch("/{task_id}", response_model=ApprovalTaskResponse)
def resolve_task(
    task_id: uuid.UUID,
    update_data: ApprovalTaskUpdate,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    claims: dict = Depends(require_roles(["admin"]))
):
    """Allows an administrator to edit payload content and approve/reject AI tasks."""
    task = db.query(ApprovalTask).filter(
        ApprovalTask.id == task_id, 
        ApprovalTask.tenant_id == tenant_id
    ).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail="Task not found in approval queue."
        )
    
    # Track if payload was edited
    if update_data.payload_content and update_data.payload_content != task.payload_content:
        task.payload_content = update_data.payload_content
        if update_data.status == "Approved":
            task.status = "Edited"
        else:
            task.status = update_data.status
    else:
        task.status = update_data.status
    
    # 🚀 Immutable Audit Trail Entry upon resolution
    audit_entry = AuditLog(
        tenant_id=tenant_id,
        actor_id=claims.get("user_id", "system_admin"),
        action_type=f"approval.{task.status.lower()}",
        target_entity=task.title,
        risk_level=task.risk_level,
        event_payload={"task_id": str(task.id), "action_type": task.action_type}
    )
    db.add(audit_entry)
    
    db.commit()
    db.refresh(task)
    return task


@router.post("/demo", response_model=ApprovalTaskResponse, status_code=status.HTTP_201_CREATED)
def create_demo_task(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """Demo endpoint to generate a fake AI task for frontend UI testing."""
    demo_task = ApprovalTask(
        tenant_id=tenant_id,
        title="Draft Notice: Unpaid Tuition Reminder",
        action_type="notice.draft",
        payload_content="Dear Parent,\nThis is a gentle reminder that the tuition fee for the current semester is overdue. Please process the payment by next week.\n\nRegards,\nKids Shine Academy.",
        risk_level="Medium",
        status="Pending"
    )
    db.add(demo_task)
    db.commit()
    db.refresh(demo_task)
    return demo_task