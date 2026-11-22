# POSTGRESQL SCHEMA DRIFT ROOT CAUSE, FORENSIC ANALYSIS & IDEMPOTENT RESOLUTION

**Document ID:** DOCS-QA-SCHEMA-DRIFT-001  
**Target Institution:** Kids Shine International School (KSIS)  
**Database:** Supabase PostgreSQL Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`)  
**Resolution Date:** 2026-11-17  
**Status:** RESOLVED & VERIFIED IN LIVE DATABASE

---

## 1. Executive Summary & Defect Statement

During the execution of authentication routes (`POST /api/v1/auth/passkey/login-challenge` and `POST /api/v1/auth/staff`), the backend failed with an uncaught `psycopg2.errors.UndefinedColumn` HTTP 500 error:
```
psycopg2.errors.UndefinedColumn: column users.is_email_verified does not exist
LINE 1: ...sers.phone_number, users.must_change_password, users.is_email_v...
```
This failure blocked passkey authentication challenge generation and staff login workflows.

---

## 2. Forensic Root Cause Analysis

A forensic audit of the database metadata, migration history, and ORM declarations revealed a multi-step migration dependency stall:

1. **Alembic Revision Desynchronization:**
   - Running `alembic current` on the live database reported revision `04834912199b`.
   - The head of the migration chain was `f8a9b0c1d2e3`.
   - Two migrations were pending execution:
     - `e7f8a9b0c1d2_admission_models_receipts_and_lifecycle.py`
     - `f8a9b0c1d2e3_storage_auth_security_and_outbox.py`

2. **Non-Idempotent DDL Crash:**
   - The intermediate migration `e7f8a9b0c1d2` included unconditional `op.add_column('tenants', sa.Column('deleted_at', ...))` and `op.add_column('users', sa.Column('deleted_at', ...))`.
   - In the live PostgreSQL database, `deleted_at` had already been created in both `public.tenants` and `public.users` during a hotfix.
   - When Alembic attempted to run `upgrade head`, PostgreSQL raised:
     ```
     psycopg2.errors.DuplicateColumn: column "deleted_at" of relation "tenants" already exists
     ```
   - This transaction rolled back immediately. Alembic aborted before reaching `f8a9b0c1d2e3`.

3. **Schema Drift Between SQLAlchemy Model and Database:**
   - The SQLAlchemy `User` ORM model in `backend/app/models/users.py` declared:
     - `is_email_verified = Column(Boolean, default=False, nullable=False)`
     - `mfa_enabled = Column(Boolean, default=False, nullable=False)`
     - `mfa_totp_secret = Column(String(255), nullable=True)`
     - `mfa_recovery_codes = Column(JSONB, nullable=True)`
   - Because `f8a9b0c1d2e3` was blocked behind the failed `e7f8a9b0c1d2`, the physical `public.users` table was never altered to add these columns.
   - Whenever any query selected `User` from the database, SQLAlchemy generated `SELECT users.is_email_verified, ...`, causing the database to reject the query.

---

## 3. Engineering Remediation

To permanently eliminate migration fragility and resolve the drift, the following steps were taken:

### 3.1 Idempotent Migration DDL (`sa.inspect`)

Both pending migrations were updated with schema introspection guards:
- **In `e7f8a9b0c1d2`:**
  ```python
  bind = op.get_bind()
  insp = sa.inspect(bind)
  tenant_cols = [c['name'] for c in insp.get_columns('tenants')] if 'tenants' in insp.get_table_names() else []
  user_cols = [c['name'] for c in insp.get_columns('users')] if 'users' in insp.get_table_names() else []
  existing_tables = set(insp.get_table_names())

  with op.batch_alter_table('tenants') as batch_op:
      if 'is_active' not in tenant_cols:
          batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')))
      if 'deleted_at' not in tenant_cols:
          batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))

  with op.batch_alter_table('users') as batch_op:
      if 'deleted_at' not in user_cols:
          batch_op.add_column(sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))
  ```

- **In `f8a9b0c1d2e3`:**
  ```python
  bind = op.get_bind()
  insp = sa.inspect(bind)
  is_pg = bind.dialect.name == "postgresql"
  existing_tables = set(insp.get_table_names())
  user_cols = [c['name'] for c in insp.get_columns('users')] if 'users' in existing_tables else []

  with op.batch_alter_table('users') as batch_op:
      if 'is_email_verified' not in user_cols:
          batch_op.add_column(sa.Column('is_email_verified', sa.Boolean(), nullable=False, server_default=sa.text('false')))
      if 'mfa_enabled' not in user_cols:
          batch_op.add_column(sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')))
      if 'mfa_totp_secret' not in user_cols:
          batch_op.add_column(sa.Column('mfa_totp_secret', sa.String(length=255), nullable=True))
      if 'mfa_recovery_codes' not in user_cols:
          batch_op.add_column(sa.Column('mfa_recovery_codes', postgresql.JSONB(astext_type=sa.Text()) if is_pg else sa.JSON(), nullable=True))
  ```
  Additionally, all new table creations (`uploaded_assets`, `password_reset_tokens`, `email_verification_tokens`, `user_webauthn_credentials`, `notification_outbox`) and RLS policy attachments were wrapped with `existing_tables` guards and `DROP POLICY IF EXISTS` statements.

### 3.2 Migration Execution & Verification

Alembic was executed against the remote Supabase database:
```bash
cd backend && ../venv/bin/alembic upgrade head
```
Output:
```
INFO  [alembic.runtime.migration] Running upgrade 04834912199b -> e7f8a9b0c1d2, admission_models_receipts_and_lifecycle
INFO  [alembic.runtime.migration] Running upgrade e7f8a9b0c1d2 -> f8a9b0c1d2e3, storage_auth_security_and_outbox
```

---

## 4. Live Verification Evidence

### 4.1 Alembic Current Check
```bash
cd backend && ../venv/bin/alembic current
# Output: f8a9b0c1d2e3 (head)
```

### 4.2 Column Existence Verification in PostgreSQL
Execution of live database introspection script:
```python
insp = sa.inspect(engine)
cols = [c['name'] for c in insp.get_columns('users')]
# is_email_verified: True
# mfa_enabled: True
# mfa_totp_secret: True
# mfa_recovery_codes: True
# deleted_at: True
```

### 4.3 Test Suite Execution
Execution of `backend/tests/test_stage03_auth.py`:
```
======================== 19 passed, 2 warnings in 7.61s ========================
```
All authentication endpoints query and persist data without `UndefinedColumn` errors.

