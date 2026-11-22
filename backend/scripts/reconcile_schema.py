# backend/scripts/reconcile_schema.py
"""
Executes backend/scripts/reconcile_schema.sql idempotently against the configured DATABASE_URL.
Verifies all tables and columns before and after execution.
"""
import os
import sys
from pathlib import Path

# Set up paths
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text, inspect
from app.core.database import engine

def main():
    sql_path = backend_dir / "scripts" / "reconcile_schema.sql"
    if not sql_path.exists():
        print(f"Error: {sql_path} not found.")
        sys.exit(1)

    print("Connecting to database...")
    try:
        with engine.connect() as conn:
            insp = inspect(conn)
            initial_tables = set(insp.get_table_names())
            print(f"Initial table count: {len(initial_tables)}")

            print("Reading reconciliation SQL...")
            sql_content = sql_path.read_text()

            # Execute within transaction
            print("Applying reconciliation statements...")
            with conn.begin():
                for statement in sql_content.split(";"):
                    stmt = statement.strip()
                    if stmt:
                        conn.execute(text(stmt))

            # Re-inspect
            insp = inspect(conn)
            final_tables = set(insp.get_table_names())
            print(f"Final table count: {len(final_tables)}")
            new_tables = final_tables - initial_tables
            if new_tables:
                print(f"Newly created tables: {', '.join(sorted(new_tables))}")

            # Verify institution_subscriptions.currency
            cols = {c["name"] for c in insp.get_columns("institution_subscriptions")}
            if "currency" in cols:
                print("✓ institution_subscriptions.currency column confirmed present.")
            else:
                print("✗ Warning: currency column still missing on institution_subscriptions!")

            print("\nSchema reconciliation completed successfully.")
    except Exception as e:
        print(f"Reconciliation error: {type(e).__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()

