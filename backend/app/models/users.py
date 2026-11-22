from sqlalchemy import Column, String, DateTime, ForeignKey, Date, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import TenantAwareModel
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink

# Backward compatibility alias
StudentGuardian = GuardianStudentLink

class Teacher(TenantAwareModel):
    """
    Teacher profile model.
    """
    __tablename__ = "teachers"
    __table_args__ = {'extend_existing': True}

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    name_bn = Column(String(200), nullable=True)
    employee_id = Column(String(50), nullable=True, index=True)
    
    designation = Column(String(100), nullable=True) # e.g., "Senior Assistant Teacher"
    department = Column(String(100), nullable=True)  # e.g., "Science", "Commerce", "Arts"
    employment_type = Column(String(50), default="Permanent") # Permanent, Contractual, Part-time
    joining_date = Column(Date, nullable=True)
    assigned_class = Column(String, nullable=True)       # e.g., "Class 3" (Class Teacher)
    subjects_taught = Column(String, nullable=True)      # e.g., "English, Science"
    phone_number = Column(String, nullable=True)
    status = Column(String, default="Active")            # Active, On Leave, Inactive

    address = Column(Text, nullable=True)
    emergency_contact = Column(String(50), nullable=True)
    qualifications = Column(JSONB, default=list, nullable=True) # list of degrees/qualifications
    experience = Column(JSONB, default=list, nullable=True)     # list of prior employment records
    cv_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)

    attendance_today = Column(String, default="Pending") # Present, Absent, Pending
    created_at = Column(DateTime(timezone=True), default=func.now())

    # 🚀 User টেবিলের সঙ্গে নিরাপদ সম্পর্ক
    user = relationship("User", foreign_keys=[user_id])

    # 🚀 ডায়নামিক প্রোপার্টি: Pydantic স্বয়ংক্রিয়ভাবে user.email রিড করবে
    @property
    def email(self) -> str | None:
        return self.user.email if self.user else None

__all__ = ["Teacher", "Student", "Guardian", "GuardianStudentLink", "StudentGuardian"]