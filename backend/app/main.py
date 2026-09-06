from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db, engine

from app.models.base import Base
from app.models.tenant import Tenant, Role, User
from app.models.audit import AuditLog
from app.models.approval import ApprovalTask
from app.models.attendance import AttendanceEvent
from app.models.academic import GradeLevel, Subject, ClassRoutine
from app.models.exam import Exam, ExamResult
from app.models.communication import Message
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink
from app.models.users import Teacher
from app.models.question_paper import QuestionPaper
from app.models.notice import Notice
from app.models.result import StudentResult
from app.models.tenant import SchoolProfile
from app.models.finance import FeePayment


Base.metadata.create_all(bind=engine)


# --- IMPORT ROUTERS ---
from app.api.endpoints import tenants
from app.api.endpoints import users
from app.api.endpoints import auth
from app.api.endpoints import academic
from app.api.endpoints import students
from app.api.endpoints import guardians
from app.api.endpoints import teachers
from app.api.endpoints import attendance
from app.api.endpoints import exams
from app.api.endpoints import ai
from app.api.endpoints import audit
from app.api.endpoints import approvals
from app.api.endpoints import communication
from app.api.endpoints import government
from app.api.endpoints import analytics

from app.api.endpoints.dashboard import router as dashboard_router
from app.api.endpoints.question_papers import router as qp_router
from app.api.endpoints.notices import router as notices_router
from app.api.endpoints.results import router as results_router
from app.api.endpoints.institution import router as institution_router
from app.api.endpoints.finance import router as finance_router


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    description="AI-Powered Autonomous School Operating System API"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- INCLUDE ROUTERS ---
app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
app.include_router(tenants.router, prefix=f"{settings.API_V1_STR}/tenants", tags=["Tenants (Schools)"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users & Auth"])
app.include_router(academic.router, prefix=f"{settings.API_V1_STR}/academic", tags=["Academics & Curriculum"])
app.include_router(students.router, prefix=f"{settings.API_V1_STR}/students", tags=["Students & Admission"]) 
app.include_router(guardians.router, prefix=f"{settings.API_V1_STR}/guardians", tags=["Guardians & Parents"])
app.include_router(teachers.router, prefix=f"{settings.API_V1_STR}/teachers", tags=["Teachers & Staff"])
app.include_router(attendance.router, prefix=f"{settings.API_V1_STR}/attendance", tags=["Smart Attendance"])
app.include_router(exams.router, prefix=f"{settings.API_V1_STR}/exams", tags=["Exams & Competencies"])
app.include_router(ai.router, prefix=f"{settings.API_V1_STR}/ai", tags=["AI Gateway"])
app.include_router(audit.router, prefix=f"{settings.API_V1_STR}/audit", tags=["Event & Audit Logs"])
app.include_router(approvals.router, prefix=f"{settings.API_V1_STR}/approvals", tags=["Action Center"])
app.include_router(communication.router, prefix=f"{settings.API_V1_STR}/communication", tags=["Communication OS"])
app.include_router(government.router, prefix=f"{settings.API_V1_STR}/government", tags=["Government Connector"])
app.include_router(analytics.router, prefix=f"{settings.API_V1_STR}/analytics", tags=["Dashboard Analytics"])
app.include_router(dashboard_router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["Daily Operations Dashboard"])
app.include_router(qp_router, prefix=f"{settings.API_V1_STR}/question-papers", tags=["Question Papers"])
app.include_router(notices_router, prefix=f"{settings.API_V1_STR}/notices", tags=["Notice Composer"])
app.include_router(results_router, prefix=f"{settings.API_V1_STR}/results", tags=["Result & Grading Engine"])
app.include_router(institution_router, prefix=f"{settings.API_V1_STR}/institution", tags=["Institution Profile & Bulk Migration"])
app.include_router(finance_router, prefix=f"{settings.API_V1_STR}/finance", tags=["Finance & Fee Ledger"])


@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "message": "SchoolOS API is up and running! 🚀"
    }

@app.get("/api/v1/health-db")
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connected successfully."}
    except Exception as e:
        return {"status": "error", "message": f"Database connection failed: {str(e)}"}