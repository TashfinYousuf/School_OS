# backend/app/core/db_utils.py
import logging
from typing import Callable, List, Optional, TypeVar

from psycopg2.extensions import TRANSACTION_STATUS_INERROR
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger("educationos.db_utils")
T = TypeVar("T")


def _is_transaction_aborted(db: Session) -> bool:
    """Check whether the underlying psycopg2 connection is in an error state."""
    try:
        raw = db.connection().connection.dbapi_connection
        return getattr(raw, "get_transaction_status", lambda: None)() == TRANSACTION_STATUS_INERROR
    except (AttributeError, SQLAlchemyError):
        return False


def optional_query(
    db: Session, 
    fn: Callable[[], T], 
    default: T, 
    label: str,
    failures: Optional[List[str]] = None,
    tenant_id: Optional[str] = None
) -> T:
    """
    Executes a read-only query within an isolated SQLAlchemy SAVEPOINT.
    If the nested query fails, only the savepoint is rolled back, leaving the outer session intact.
    Does NOT call top-level db.rollback() to avoid destroying unrelated session state.
    Records failures explicitly so callers can distinguish zero from a failed execution.
    """
    if _is_transaction_aborted(db):
        logger.warning(
            "Transaction already in error state prior to optional query; skipping execution",
            extra={"query_label": label, "tenant_id": tenant_id}
        )
        if failures is not None:
            failures.append(label)
        return default

    try:
        with db.begin_nested():
            return fn()
    except SQLAlchemyError as exc:
        logger.error(
            "Optional read-only query failed under savepoint",
            exc_info=True,
            extra={
                "query_label": label,
                "tenant_id": tenant_id,
                "exception_class": type(exc).__name__,
                "exception_msg": str(exc),
            }
        )
        if failures is not None:
            failures.append(label)
        return default


def count_rows(db: Session, model, *criteria) -> int:
    """
    Executes explicit SELECT count(*) FROM table WHERE criteria...
    Avoids selecting specific entity columns to prevent failure on non-critical column drift.
    """
    return db.query(func.count()).select_from(model).filter(*criteria).scalar() or 0


def optional_count(
    db: Session, 
    model, 
    *criteria, 
    label: str,
    failures: Optional[List[str]] = None,
    tenant_id: Optional[str] = None
) -> int:
    """Safely computes a row count inside an isolated savepoint."""
    return optional_query(
        db, 
        lambda: count_rows(db, model, *criteria), 
        0, 
        label=label, 
        failures=failures,
        tenant_id=tenant_id
    )
