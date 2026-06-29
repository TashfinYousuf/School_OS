from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.config import settings
from app.core.database import get_db

# --- IMPORT ROUTERS ---
from app.api.endpoints import tenants
from app.api.endpoints import users
from app.api.endpoints import auth
from app.api.endpoints import academic
from app.api.endpoints import students
from app.api.endpoints import guardians
from app.api.endpoints import teachers

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
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}", tags=["Authentication"])
app.include_router(tenants.router, prefix=f"{settings.API_V1_STR}/tenants", tags=["Tenants (Schools)"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["Users & Auth"])
app.include_router(academic.router, prefix=f"{settings.API_V1_STR}/academic", tags=["Academic Core"])
app.include_router(students.router, prefix=f"{settings.API_V1_STR}/students", tags=["Students & Admission"]) 
app.include_router(guardians.router, prefix=f"{settings.API_V1_STR}/guardians", tags=["Guardians & Parents"])
app.include_router(teachers.router, prefix=f"{settings.API_V1_STR}/teachers", tags=["Teachers & Staff"])

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