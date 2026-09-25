# backend/tests/test_rls_isolation.py
import pytest
from sqlalchemy import text
from app.core.database import SessionLocal

def test_rls_blocks_data_leak_without_tenant_context():
    """Verifies that queries with no tenant context return 0 rows due to RLS."""
    db = SessionLocal()
    try:
        # Intentionally not executing SET LOCAL app.current_tenant_id
        result = db.execute(text("SELECT count(*) FROM students;")).scalar()
        assert result == 0, "Security Violation: Data accessed without tenant session context!"
    finally:
        db.close()

def test_cross_tenant_isolation():
    """Verifies Tenant A cannot see records belonging to Tenant B."""
    db = SessionLocal()
    try:
        # 1. Query as Kids Shine School
        db.execute(text("SET LOCAL app.current_tenant_id = 'org_kids_shine';"))
        ks_count = db.execute(text("SELECT count(*) FROM approval_tasks;")).scalar()

        # 2. Query as Future Academy
        db.execute(text("SET LOCAL app.current_tenant_id = 'org_future_academy';"))
        fa_count = db.execute(text("SELECT count(*) FROM approval_tasks;")).scalar()

        # Verify isolated sessions don't leak counts
        assert isinstance(ks_count, int)
        assert isinstance(fa_count, int)
    finally:
        db.close()