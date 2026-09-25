# backend/app/models/attendance.py
import uuid
from sqlalchemy import Column, String, Date, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class AttendanceEvent(Base):
    """
    IoT & AI-Ready Attendance Engine.
    Records every attendance mark as an immutable event.
    Supports offline synchronization with idempotency keys.
    """
    __tablename__ = "attendance_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    # DB column is UUID referencing students.id
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), index=True, nullable=False)
    class_id = Column(String, index=True, nullable=True) 
    
    # Core Data
    date = Column(Date, default=func.current_date(), index=True, nullable=False)
    status = Column(String, nullable=False) # "Present", "Absent", "Late", "Excused"
    
    # IoT & Hardware Ready Fields (Vision 2030)
    check_in_time = Column(DateTime(timezone=True), default=func.now())
    is_biometric = Column(Boolean, default=False)
    device_id = Column(String, nullable=True) # E.g., "Gate-1-RFID"
    
    # Audit & AI
    marked_by = Column(String, nullable=True) # Teacher ID or System
    remarks = Column(String, nullable=True) # E.g., "Fever" or AI generated insights

    # Offline Sync & Exactly-once Delivery
    idempotency_key = Column(String(128), index=True, nullable=True)

    __table_args__ = (
        # Ensures no duplicate offline sync runs for the same transaction key within a tenant
        UniqueConstraint('tenant_id', 'idempotency_key', name='uq_tenant_attendance_idempotency'),
    )