# backend/app/core/database.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create the SQLAlchemy engine with connection pool hardening
engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    Fallback standard database session for non-tenant background operations.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_tenant_db(tenant_id: str):
    """
    Critical RLS Session Guard: Executes SET LOCAL within a transaction boundary.
    Prevents data leakage across pooled database connections.
    """
    db = SessionLocal()
    try:
        db.begin()
        db.execute(text("SET LOCAL app.current_tenant_id = :tenant_id"), {"tenant_id": tenant_id})
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()