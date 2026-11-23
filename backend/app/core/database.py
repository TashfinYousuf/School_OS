# backend/app/core/database.py
import logging
import os
import psycopg2.extensions as pg_ext

from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker, declarative_base, Session
from app.core.config import settings

logger = logging.getLogger("educationos.security.database")

def normalize_database_url(url: str) -> str:
    """
    Normalizes PostgreSQL connection URLs to ensure psycopg2 dialect compatibility.
    Handles:
    - 'postgresql+psycopg://' (from Supabase UI SQLAlchemy tab) -> 'postgresql+psycopg2://'
    - 'postgres://' (legacy cloud provider schemes) -> 'postgresql+psycopg2://'
    - 'postgresql://' (standard URL without explicit DBAPI driver) -> 'postgresql+psycopg2://'
    Preserves SQLite and other database URLs untouched.
    """
    if not url:
        return url
    s = str(url).strip()
    if s.startswith("postgresql+psycopg://"):
        return "postgresql+psycopg2://" + s[len("postgresql+psycopg://"):]
    if s.startswith("postgres://"):
        return "postgresql+psycopg2://" + s[len("postgres://"):]
    if s.startswith("postgresql://") and not s.startswith("postgresql+"):
        return "postgresql+psycopg2://" + s[len("postgresql://"):]
    return s


DATABASE_URL = normalize_database_url(settings.DATABASE_URL)

# Create the SQLAlchemy engine with connection pool hardening
engine_kwargs = {"pool_pre_ping": True}
if "sqlite" not in str(DATABASE_URL).lower():
    engine_kwargs.update({
        "pool_size": 10,
        "pool_recycle": 300,
        "max_overflow": 20,
        "pool_timeout": 10,
    })
else:
    from sqlalchemy.pool import StaticPool
    engine_kwargs.update({
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool
    })

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Register central tenant guard SQLAlchemy event listeners
import app.core.tenant_guard  # noqa: F401


# ----------------------------------------------------------------------------------------
# PostgreSQL Session-Level & Connection Pool Event Listeners
# ----------------------------------------------------------------------------------------
@event.listens_for(Session, "after_begin")
def enforce_tenant_rls_context(session, transaction, connection):
    """
    Guarantees that every transaction opened within a tenant-scoped session
    (including transactions created after intermediate commits) receives
    the transaction-local 'SELECT set_config('app.current_tenant_id', :tenant_id, true)'
    and drops superuser bypassrls privileges via 'SET LOCAL ROLE authenticated'.
    """
    tenant_id = session.info.get("tenant_id")
    if tenant_id and connection.engine.dialect.name == "postgresql":
        try:
            connection.execute(
                text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                {"tenant_id": str(tenant_id)}
            )
            if os.getenv("DB_ENFORCE_RLS_ROLE", "true").lower() == "true":
                connection.execute(text("SET LOCAL ROLE authenticated"))
        except Exception as e:
            logger.warning("Failed to execute set_config/role switch in after_begin: %s", e)


@event.listens_for(engine, "checkin")
def reset_pooled_connection_on_checkin(dbapi_conn, _record):
    """
    Defensive pool cleanup: A pooled connection must be idle.
    Roll back anything left open so pre-ping and subsequent checkouts run cleanly without transaction leaks.
    """
    try:
        if hasattr(dbapi_conn, "closed") and not dbapi_conn.closed:
            if hasattr(dbapi_conn, "rollback"):
                dbapi_conn.rollback()
    except Exception:
        logger.warning("checkin rollback failed; discarding connection", exc_info=True)
        try:
            if hasattr(dbapi_conn, "close"):
                dbapi_conn.close()
        except Exception:
            pass


_never_return_dirty_connection = reset_pooled_connection_on_checkin


# ----------------------------------------------------------------------------------------
# Session Providers
# ----------------------------------------------------------------------------------------
def get_db():
    """
    Global database session for non-tenant background operations, public lookups,
    and webhook handlers. Does NOT inject tenant context.
    """
    db = SessionLocal()
    try:
        yield db
        if db.in_transaction():
            db.commit()
    except Exception:
        if db.in_transaction():
            db.rollback()
        raise
    finally:
        db.close()


def get_tenant_db(tenant_id: str):
    """
    Critical Multi-Tenant RLS Session Guard:
    1. Tags db.info['tenant_id'] for ORM-level tenant guard injection.
    2. Executes transaction-local set_config within transaction boundary.
    3. Handles commit / rollback safely.
    """
    db = SessionLocal()
    db.info["tenant_id"] = str(tenant_id)
    try:
        # If running against PostgreSQL, explicitly execute transaction-local set_config & non-bypass role
        if engine.dialect.name == "postgresql":
            try:
                db.execute(
                    text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                    {"tenant_id": str(tenant_id)}
                )
                if os.getenv("DB_ENFORCE_RLS_ROLE", "true").lower() == "true":
                    db.execute(text("SET LOCAL ROLE authenticated"))
            except Exception as e:
                logger.warning("Failed to set tenant context/role in get_tenant_db: %s", e)
        yield db
        if db.in_transaction():
            db.commit()
    except Exception:
        if db.in_transaction():
            db.rollback()
        raise
    finally:
        db.close()
