"""
Curriculum ingestion: guaranteed terminal state + audit trail.
- Job kokhono forever "in progress" thakbe na: success, failure, crash ba restart sob-i terminal status e shesh hoy.
- Ek process e ek document e ek-i worker.
- GET request theke kokhono thread spawn hoy na.
"""
import datetime
import importlib
import logging
import pkgutil
import threading
import time
from typing import Dict, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.audit import AuditLog
from app.services.curriculum_rag import curriculum_rag

logger = logging.getLogger("educationos.ingestion")

TERMINAL = {"INDEXED", "COMPLETED", "READY", "FAILED", "CANCELLED", "CANCELED"}

_running: Dict[str, float] = {}
_lock = threading.Lock()
_model = None


def get_doc_model():
    """Curriculum document model ke table nam diye khuje ney, import path guess korte hoy na."""
    global _model
    if _model is not None:
        return _model
    import app.models as pkg
    for m in pkgutil.iter_modules(pkg.__path__):
        try:
            mod = importlib.import_module(f"app.models.{m.name}")
        except Exception:
            continue
        for obj in list(vars(mod).values()):
            tn = getattr(obj, "__tablename__", None)
            if isinstance(tn, str) and tn.startswith("curriculum_doc"):
                _model = obj
                return obj
    raise RuntimeError("Curriculum document model not found (table name 'curriculum_doc*' expected).")


def is_running(doc_id) -> bool:
    with _lock:
        return str(doc_id) in _running


def _now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def _parse_iso(value) -> Optional[datetime.datetime]:
    if not value:
        return None
    try:
        return datetime.datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _age_seconds(dt) -> Optional[float]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    return (_now() - dt).total_seconds()


# ----------------------------------------------------------------------------- audit
def audit_event(db: Session, tenant_id, actor_id, action: str, target: str,
                payload: Optional[dict] = None, risk: str = "Low") -> None:
    """Caller er transaction e audit row add kore (commit caller kore)."""
    db.add(AuditLog(
        tenant_id=str(tenant_id),
        actor_id=str(actor_id),
        action_type=action,
        target_entity=target[:190],
        event_payload=payload or {},
        risk_level=risk,
    ))


def audit_now(tenant_id, actor_id, action: str, target: str,
              payload: Optional[dict] = None, risk: str = "Low") -> None:
    """Background worker er jonno: nijer session e likhe commit kore, kokhono raise kore na."""
    db = SessionLocal()
    try:
        audit_event(db, tenant_id, actor_id, action, target, payload, risk)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("audit write failed: %s", action)
    finally:
        db.close()


# ----------------------------------------------------------------------------- state
def mark_failed(tenant_id, doc_id, message: str) -> bool:
    db = SessionLocal()
    try:
        M = get_doc_model()
        doc = db.query(M).filter(M.id == doc_id, M.tenant_id == str(tenant_id)).first()
        if doc is None or str(doc.status).upper() in TERMINAL:
            return False
        meta = dict(doc.metadata_payload or {})
        meta.update({"stage": "failed", "failed_at": _now().isoformat()})
        doc.status = "FAILED"
        doc.error_message = message[:500]
        doc.metadata_payload = meta
        db.commit()
        return True
    except Exception:
        db.rollback()
        logger.exception("could not mark document %s as FAILED", doc_id)
        return False
    finally:
        db.close()


def run_ingestion_job(doc_id, tenant_id: str, actor_id: str = "system") -> None:
    """Background entry point: always ends in a terminal status, always audited, never raises."""
    key = str(doc_id)
    target = f"CurriculumDocument {key}"
    with _lock:
        if key in _running:
            logger.warning("ingestion %s already running in this process; duplicate start skipped", key)
            return
        _running[key] = time.monotonic()
    started = time.monotonic()
    audit_now(tenant_id, actor_id, "curriculum.ingestion_started", target, {"document_id": key})
    try:
        curriculum_rag.process_document_background(doc_id, str(tenant_id))

        db = SessionLocal()
        try:
            stat = curriculum_rag.get_document_status(db=db, tenant_id=str(tenant_id), document_id=doc_id)
        finally:
            db.close()

        took = round(time.monotonic() - started, 1)
        status = str((stat or {}).get("status") or "").upper()
        if stat is None:
            audit_now(tenant_id, actor_id, "curriculum.ingestion_vanished", target,
                      {"note": "document deleted while processing", "duration_s": took})
        elif status not in TERMINAL:
            mark_failed(tenant_id, doc_id, "Worker exited without finishing. Server log e 'DB ERROR' ba exception line dekho.")
            audit_now(tenant_id, actor_id, "curriculum.ingestion_failed", target,
                      {"reason": "worker_exited_unfinished", "last_status": status,
                       "last_stage": stat.get("stage"), "duration_s": took}, "Medium")
        elif status == "FAILED":
            audit_now(tenant_id, actor_id, "curriculum.ingestion_failed", target,
                      {"error": stat.get("error_message"), "duration_s": took}, "Medium")
        else:
            audit_now(tenant_id, actor_id, "curriculum.ingestion_completed", target,
                      {"status": status, "chunks": stat.get("chunks_count") or stat.get("chunks_indexed"),
                       "duration_s": took})
    except Exception as exc:
        logger.exception("ingestion %s crashed", key)
        msg = f"{type(exc).__name__}: {str(exc)[:300]}"
        mark_failed(tenant_id, doc_id, msg)
        audit_now(tenant_id, actor_id, "curriculum.ingestion_failed", target,
                  {"error": msg, "duration_s": round(time.monotonic() - started, 1)}, "Medium")
    finally:
        with _lock:
            _running.pop(key, None)


def sweep_stalled_jobs(db: Session, tenant_id: Optional[str] = None, older_than_s: int = 120) -> int:
    """
    Non-terminal kintu kono worker nei emon job ke FAILED kore (server restart/crash er por).
    Kono thread spawn kore na. Retry button user ke dewa hoy.
    """
    M = get_doc_model()
    q = db.query(M).filter(~func.upper(M.status).in_(list(TERMINAL)))
    if tenant_id:
        q = q.filter(M.tenant_id == str(tenant_id))
    swept = 0
    for doc in q.all():
        key = str(doc.id)
        if is_running(key):
            continue
        meta = dict(doc.metadata_payload or {})
        ages = [a for a in (_age_seconds(getattr(doc, "created_at", None)),
                            _age_seconds(_parse_iso(meta.get("queued_at")))) if a is not None]
        if ages and min(ages) < older_than_s:
            continue
        if mark_failed(doc.tenant_id, doc.id,
                       "Interrupted (server restart ba crashed worker). Retry button chapo."):
            audit_now(doc.tenant_id, "system", "curriculum.ingestion_failed", f"CurriculumDocument {key}",
                      {"reason": "orphaned", "last_status": str(doc.status)}, "Medium")
            swept += 1
    return swept