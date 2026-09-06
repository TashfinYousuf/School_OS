import uuid
from sqlalchemy import Column, String, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class AttendanceEvent(Base):
    """
    IoT & AI-Ready Attendance Engine.
    Records every attendance mark as an immutable event.
    """
    __tablename__ = "attendance_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    
    # 🚀 DB column is VARCHAR, keep it String to avoid type casting conflicts
    student_id = Column(String, index=True, nullable=False)
    class_id = Column(String, index=True, nullable=True) 
    
    # Core Data
    date = Column(Date, default=func.current_date(), index=True)
    status = Column(String, nullable=False) # "Present", "Absent", "Late", "Excused"
    
    # IoT & Hardware Ready Fields (Vision 2030)
    check_in_time = Column(DateTime(timezone=True), default=func.now())
    is_biometric = Column(Boolean, default=False)
    device_id = Column(String, nullable=True) # E.g., "Gate-1-RFID"
    
    # Audit & AI
    marked_by = Column(String, nullable=True) # Teacher ID or System
    remarks = Column(String, nullable=True) # E.g., "Fever" or AI generated insights