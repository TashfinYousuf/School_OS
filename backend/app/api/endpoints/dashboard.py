from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.users import Teacher
from app.models.attendance import AttendanceEvent
from app.models.approval import ApprovalTask
from app.models.student import Student

router = APIRouter()

class SchoolDayMetrics(BaseModel):
    total_students: int
    present_today: int
    absent_today: int
    total_teachers: int
    pending_approvals: int
    system_status: str

@router.get("/metrics", response_model=SchoolDayMetrics)
def get_daily_operational_metrics(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    today = date.today()

    # ১. মোট শিক্ষার্থী গণনা (রিয়েল ডাটাবেস থেকে)
    total_students = db.query(Student).filter(Student.tenant_id == tenant_id).count()

    # ২. আজকের উপস্থিতি/অনুপস্থিতি (রিয়েল ইভেন্ট থেকে)
    present_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tenant_id,
        AttendanceEvent.date == today,
        AttendanceEvent.status == "Present"
    ).count()

    absent_today = db.query(AttendanceEvent).filter(
        AttendanceEvent.tenant_id == tenant_id,
        AttendanceEvent.date == today,
        AttendanceEvent.status == "Absent"
    ).count()

    # ৩. মোট শিক্ষক সংখ্যা
    total_teachers = db.query(Teacher).filter(Teacher.tenant_id == tenant_id).count()

    # ৪. অপেক্ষমাণ এআই/প্রশাসনিক টাস্ক (Action Center Queue)
    pending_approvals = db.query(ApprovalTask).filter(
        ApprovalTask.tenant_id == tenant_id,
        ApprovalTask.status == "Pending"
    ).count()

    return {
        "total_students": total_students,
        "present_today": present_today,
        "absent_today": absent_today,
        "total_teachers": total_teachers,
        "pending_approvals": pending_approvals,
        "system_status": "All engines operational"
    }