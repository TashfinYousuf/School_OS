"""
Owner-Authorized Live Database Hygiene Script (Dry-Run by Default).

Audits and (ONLY when --execute --i-understand-production-impact are explicitly passed):
1. Corrects historical role='admin' pollution on student1@kidsshine.com, student2@kidsshine.com, father@kidsshine.com.
2. Removes orphan 'Reconstruction Test Academy' test tenants left from pre-RC3 runs.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from sqlalchemy import text
from app.core.database import SessionLocal

POLLUTED_ROLE_TARGETS = {
    "student1@kidsshine.com": "student",
    "student2@kidsshine.com": "student",
    "father@kidsshine.com": "guardian",
}


def main():
    parser = argparse.ArgumentParser(description="Owner-authorized DB hygiene script")
    parser.add_argument("--execute", action="store_true", help="Apply fixes (default is read-only dry-run)")
    parser.add_argument("--i-understand-production-impact", action="store_true", dest="ack", help="Explicit confirmation")
    args = parser.parse_args()

    execute = bool(args.execute and args.ack)
    if args.execute and not args.ack:
        print("REFUSED: Pass --i-understand-production-impact alongside --execute to mutate live data.")
        sys.exit(2)

    db = SessionLocal()
    try:
        print(f"=== MODE: {'EXECUTE (LIVE MUTATION)' if execute else 'DRY-RUN (READ-ONLY)'} ===")
        for email, expected_role in POLLUTED_ROLE_TARGETS.items():
            row = db.execute(
                text("SELECT id, email, role, tenant_id FROM users WHERE lower(email) = :e"),
                {"e": email.lower()},
            ).fetchone()
            print(f"User check {email}: {row} -> target role={expected_role}")
            if execute and row and row[2] != expected_role:
                db.execute(
                    text("UPDATE users SET role = :r WHERE id = :id"),
                    {"r": expected_role, "id": row[0]},
                )

        orphan_tenants = db.execute(
            text("SELECT id, school_name, domain, created_at FROM tenants WHERE school_name = 'Reconstruction Test Academy'")
        ).fetchall()
        print(f"Orphan 'Reconstruction Test Academy' tenants found: {len(orphan_tenants)}")
        for t in orphan_tenants:
            print(" ", t)
            if execute:
                tid = t[0]
                db.execute(text("DELETE FROM attendance_events WHERE tenant_id = :t"), {"t": str(tid)})
                db.execute(text("DELETE FROM student_results WHERE tenant_id = :t"), {"t": str(tid)})
                db.execute(text("DELETE FROM account_invitations WHERE tenant_id = :t"), {"t": str(tid)})
                db.execute(text("DELETE FROM student_guardians WHERE tenant_id = :t"), {"t": tid})
                db.execute(text("DELETE FROM guardians WHERE tenant_id = :t"), {"t": tid})
                db.execute(text("DELETE FROM students WHERE tenant_id = :t"), {"t": tid})
                db.execute(text("DELETE FROM users WHERE tenant_id = :t"), {"t": tid})
                db.execute(text("DELETE FROM tenants WHERE id = :t"), {"t": tid})

        if execute:
            db.commit()
            print("COMMITTED live DB remediation cleanly.")
        else:
            db.rollback()
            print("Dry-run complete. No rows modified.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

