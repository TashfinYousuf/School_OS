# backend/tests/test_rls_negative_db.py
from sqlalchemy import text
from app.core.database import SessionLocal


def test_postgresql_rls_enforced_under_authenticated_role():
    """
    Phase 7 Positive/Negative RLS Gate:
    Verifies runtime ROLE authenticated enforces zero leakage when tenant GUC is unset or switched
    across critical domain tables (users, guardians, student_guardians, fee_payments, audit_logs,
    attendance_events, approval_tasks, student_results, subscription_payments, tenants).
    """
    db = SessionLocal()
    protected_tables = [
        "users",
        "guardians",
        "student_guardians",
        "student_results",
        "fee_payments",
        "audit_logs",
        "attendance_events",
        "approval_tasks",
        "subscription_payments",
        "tenants",
    ]
    try:
        db.execute(text("SET LOCAL ROLE authenticated;"))
        db.execute(text("SELECT set_config('app.current_tenant_id', '', true);"))
        for tbl in protected_tables:
            cnt = db.execute(text(f"SELECT count(*) FROM {tbl};")).scalar()
            assert cnt == 0, f"RLS leak detected on {tbl} when app.current_tenant_id is empty!"

        # Random non-existent tenant UUID must also observe 0 rows under ROLE authenticated
        db.execute(text("SELECT set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000009999', true);"))
        for tbl in protected_tables:
            cnt = db.execute(text(f"SELECT count(*) FROM {tbl};")).scalar()
            assert cnt == 0, f"RLS leak detected on {tbl} for foreign tenant UUID!"
    finally:
        db.rollback()
        db.close()

