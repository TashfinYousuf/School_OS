# RC3 Backup, Restore & Owner Live-Data Remediation Runbook

## 1. PostgreSQL Backup & Restore Drill Protocol
- **Honest Local Constraint:** The current development workstation has `libpq` (`psql`) only and **no local `postgres` server binary or Docker**. Full offline PITR / `pg_restore` replay was therefore **NOT VERIFIED** locally.
- **Required Pre-Go-Live Cloud Verification (Supabase Dashboard / CI PG Runner):**
  1. Trigger on-demand Supabase PITR snapshot / `pg_dump --format=custom --no-owner`.
  2. Restore into an isolated staging Postgres instance (`pg_restore -d staging_verify backup.dump`).
  3. Run `alembic current` (`cedb24c053f7`), `python backend/scripts/schema_drift.py`, and `pytest -q tests/test_rls_negative_db.py` against the restored clone before signing off disaster recovery readiness.

## 2. Live Supabase Data Hygiene — Pending Explicit Owner Authorization
During Phase 0 forensics, two live database anomalies were discovered in the configured Supabase instance (`Kids Shine` / test environment) that must **NOT** be mutated silently without explicit owner confirmation:
1. Three accounts (`student1@kidsshine.com`, `father@kidsshine.com`, `student2@kidsshine.com`) exist in `public.users` with `role='admin'` (caused by the historical `User.role` column default `"admin"`, now patched in `backend/app/models/tenant.py`).
2. Six orphan test tenants named `'Reconstruction Test Academy'` created by prior pre-RC3 fixture runs remain in `public.tenants`.

**Dry-Run Remediation Script:** `backend/scripts/owner_approved_db_remediation.py`
- Run `cd backend && PYTHONPATH=. ../venv/bin/python scripts/owner_approved_db_remediation.py` (safe read-only audit mode).
- Only after explicit owner confirmation, pass `--execute --i-understand-production-impact` to correct those 3 user roles and archive/clean those orphan test tenants.

