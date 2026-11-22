# backend/app/core/tenant_guard.py
"""
Central Architectural Tenant Isolation Guard (OWASP 2025 A06 / A01)
Automatically attaches tenant boundaries to all SELECT queries executed in SQLAlchemy sessions,
preventing data leaks even if developers omit .filter(tenant_id == ...).
"""
import uuid
import logging
from sqlalchemy import event
from sqlalchemy.orm import Session, with_loader_criteria
from sqlalchemy.types import Uuid
from app.models.base import Base

logger = logging.getLogger("educationos.security.tenant_guard")

_cached_scoped_models = None

def _get_tenant_scoped_models():
    """
    Discovers all registered SQLAlchemy ORM models containing a 'tenant_id' column,
    unless explicitly exempted via __tenant_exempt__ = True.
    """
    global _cached_scoped_models
    if _cached_scoped_models is None:
        scoped = []
        for mapper in Base.registry.mappers:
            model_cls = mapper.class_
            if "tenant_id" in mapper.local_table.c and not getattr(model_cls, "__tenant_exempt__", False):
                scoped.append(model_cls)
        _cached_scoped_models = scoped
    return _cached_scoped_models


@event.listens_for(Session, "do_orm_execute")
def enforce_tenant_criteria(execute_state):
    """
    SQLAlchemy do_orm_execute hook:
    Injects WHERE tenant_id = :session_tenant_id automatically into SELECT statements.
    """
    tenant_id = execute_state.session.info.get("tenant_id")

    # Skip if tenant_id is not set, query is not a SELECT, or explicitly exempted
    if not tenant_id or not execute_state.is_select or execute_state.execution_options.get("skip_tenant_guard"):
        return

    criteria_options = []
    for model_class in _get_tenant_scoped_models():
        column = model_class.__table__.c.tenant_id
        # Support both native PostgreSQL UUID columns and String columns seamlessly
        try:
            resolved_val = uuid.UUID(str(tenant_id)) if isinstance(column.type, Uuid) else str(tenant_id)
        except (ValueError, TypeError):
            resolved_val = str(tenant_id)

        criteria_options.append(
            with_loader_criteria(
                model_class,
                model_class.tenant_id == resolved_val,
                include_aliases=True
            )
        )

    if criteria_options:
        execute_state.statement = execute_state.statement.options(*criteria_options)

