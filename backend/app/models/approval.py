# backend/app/models/approval.py
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, DateTime, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base

class ApprovalTask(Base):
    __tablename__ = "approval_tasks"
    __table_args__ = (
        Index("ix_approval_tasks_tenant_status", "tenant_id", "status"),
        {'extend_existing': True}
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    
    # Task metadata & approval workflow
    task_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True) # e.g. "RESULT_PUBLICATION", "FEE_ADJUSTMENT"
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Pending", nullable=False, index=True) # Pending, Approved, Rejected, Edited
    
    # Audit trail
    requested_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    reviewed_by_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Execution context payload
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict, nullable=True)
    
    # Backwards compatibility with 63d9333ead59 schema and approvals endpoint
    action_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    payload_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(32), default="Medium", nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

# 🚀 Dual-Export Alias: Resolves ApprovalRequest import error across all endpoints
ApprovalRequest = ApprovalTask