import logging, os
import time
import uuid

from fastapi import FastAPI, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from contextlib import asynccontextmanager

from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import get_db, engine, SessionLocal

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
from app.models.workspace import Workspace, WorkspaceMembership
from app.models.subscription import InstitutionSubscription

from app.services.ingestion_guard import sweep_stalled_jobs

# Import routers after models are defined
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
from app.api.endpoints import admissions
from app.api.endpoints import government
from app.api.endpoints import analytics
from app.api.endpoints import teacher_diary
from app.api.endpoints import learning_studio
from app.api.endpoints import billing

from app.api.endpoints.dashboard import router as dashboard_router
from app.api.endpoints.question_papers import router as qp_router
from app.api.endpoints.notices import router as notices_router
from app.api.endpoints.results import router as results_router
from app.api.endpoints.institution import router as institution_router
from app.api.endpoints.finance import router as finance_router
from app.api.endpoints.academy import router as academy_router
from app.api.endpoints.campus import router as campus_router
from app.api.endpoints.notifications import router as notifications_router


from app.api.endpoints import workspaces


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Asynchronous Application Lifespan Handler.
    Manages controlled startup, bounded database health probing,
    self-healing schema migrations, and deterministic shutdown.
    """
    logger = logging.getLogger("educationos.startup")
    logger.info("Initializing EducationOS Core API runtime...")

    # 1. Bounded database connectivity check with retry backoff
    db_connected = False
    max_retries = 3
    retry_delay = 1.0

    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
                db_connected = True
                logger.info("Database connection established (attempt %d/%d).", attempt, max_retries)
                break
        except Exception as exc:
            logger.warning(
                "Database probe attempt %d/%d failed: %s", 
                attempt, max_retries, str(exc).strip().splitlines()[0]
            )
            if attempt < max_retries:
                import time
                time.sleep(retry_delay)
                retry_delay *= 2

    is_production = getattr(settings, "ENVIRONMENT", "development").lower() == "production"

    if not db_connected:
        if is_production:
            logger.critical("FATAL: Database connection failed during production startup.")
            raise RuntimeError("Database connection failed during production startup.")
        else:
            logger.warning("Running in degraded/offline mode: database is currently unreachable.")

    # 2. Database readiness check (authoritative migrations are managed exclusively via Alembic)
    if db_connected:
        logger.info("Database connectivity verified. Schema management is authoritative via Alembic migrations.")
        if settings.AUTO_CREATE_TABLES:
            try:
                Base.metadata.create_all(bind=engine)
                logger.info("Auto-created database tables via metadata.")
            except Exception as e:
                logger.warning("Auto-create tables skipped: %s", e)

        # 3. Sweep orphaned ingestion jobs on startup
        try:
            prod = os.getenv("APP_ENV", "dev").lower() in {"prod", "production"}
            db_session = SessionLocal()
            try:
                n = sweep_stalled_jobs(db_session, None, older_than_s=900 if prod else 0)
                if n:
                    logger.warning("%s orphaned ingestion job(s) marked FAILED", n)
            finally:
                db_session.close()
        except Exception:
            logger.exception("ingestion sweep failed")

    yield

    logger.info("Shutting down EducationOS Core API runtime cleanly.")


is_production = getattr(settings, "ENVIRONMENT", "development").lower() == "production"

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Autonomous School Operating System API",
    lifespan=lifespan,
    openapi_url=None if is_production else f"{settings.API_V1_STR}/openapi.json",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc"
)

class RequestContextMiddleware(BaseHTTPMiddleware):
    """
    Observability & Correlation Middleware:
    Attaches a unique X-Request-ID and X-Correlation-ID and tracks request execution latency.
    """
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start_time = time.time()

        response: Response = await call_next(request)

        process_time = (time.time() - start_time) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Correlation-ID"] = request_id
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
        return response


# CORS configuration (F9 Hardening: Explicit origin whitelist)
cors_origins = getattr(settings, "CORS_ORIGINS", [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://schoolos.app"
])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins, 
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Retry-After", "X-Request-ID", "X-Correlation-ID", "X-Process-Time"]
)
app.add_middleware(RequestContextMiddleware)

# --- INCLUDE ROUTERS ---
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])
app.include_router(tenants.router, prefix=f"{settings.API_V1_STR}/tenants", tags=["Tenants (Schools)"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users & Auth"])
app.include_router(academic.router, prefix=f"{settings.API_V1_STR}/academic", tags=["Academics & Curriculum"])
app.include_router(students.router, prefix=f"{settings.API_V1_STR}/students", tags=["Students & Admission"]) 
app.include_router(admissions.router, prefix=f"{settings.API_V1_STR}/admissions", tags=["Admissions & Enrollment"])
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
app.include_router(teacher_diary.router, prefix=f"{settings.API_V1_STR}/teacher-os", tags=["TeacherOS & Intelligence"])
app.include_router(learning_studio.router, prefix=f"{settings.API_V1_STR}/learning-os", tags=["LearningOS & Student Studio"])
app.include_router(academy_router, prefix=f"{settings.API_V1_STR}/academy", tags=["AcademyOS & Coaching Engine"])
app.include_router(campus_router, prefix=f"{settings.API_V1_STR}/campus", tags=["Multiple Campus Branch"])
app.include_router(notifications_router, prefix=f"{settings.API_V1_STR}/notifications", tags=["Notification Engine & PWA WebPush"])
app.include_router(billing.router, prefix=f"{settings.API_V1_STR}/billing", tags=["SaaS Subscription & Billing"])
app.include_router(workspaces.router, prefix=f"{settings.API_V1_STR}/workspaces", tags=["Workspaces & School vs Academy Switcher"])


@app.get("/")
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "message": "EducationOS API is up and running! 🚀"
    }

@app.get("/api/v1/health-db")
def health_db(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connected successfully."}
    except Exception as e:
        return {"status": "error", "message": f"Database connection failed: {str(e)}"}


@app.get("/healthz", status_code=status.HTTP_200_OK, tags=["Infrastructure"])
def healthcheck():
    """Authoritative Health Check for Docker & Load Balancers"""
    db_status = "healthy"
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online",
        "service": "EducationOS Core API",
        "database": db_status,
    }


@app.get("/api/v1/health", status_code=status.HTTP_200_OK, tags=["Infrastructure"])
def api_v1_health():
    """Health check endpoint reporting API, database, and system status."""
    import datetime
    from app.services.storage_service import storage_service
    from app.services.communication_providers import get_communications_health

    db_status = "healthy"
    pool_info = {}
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        pool = engine.pool
        pool_info = {
            "size": pool.size() if hasattr(pool, "size") else 1,
            "checkedin": pool.checkedin() if hasattr(pool, "checkedin") else 0,
            "checkedout": pool.checkedout() if hasattr(pool, "checkedout") else 0,
            "overflow": pool.overflow() if hasattr(pool, "overflow") else 0,
        }
        db.close()
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    comms_health = {}
    try:
        comms_health = get_communications_health()
    except Exception:
        pass

    return {
        "status": "healthy" if "unhealthy" not in db_status else "degraded",
        "service": "EducationOS API",
        "database": db_status,
        "pool": pool_info,
        "storage": {
            "backend": getattr(storage_service, "backend", "local"),
            "bucket": getattr(storage_service, "bucket", "educationos-assets"),
        },
        "communications": comms_health,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }


@app.get("/api/v1/ready", status_code=status.HTTP_200_OK, tags=["Infrastructure"])
def api_v1_ready():
    """Readiness probe for Kubernetes / Docker Swarm traffic routing."""
    import json
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        return {"ready": True, "reason": "All core dependencies reachable."}
    except Exception as e:
        return Response(
            content=json.dumps({"ready": False, "reason": f"Database unreachable: {str(e)}"}),
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            media_type="application/json"
        )