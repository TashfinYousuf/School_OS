# DATABASE AND MIGRATION VERIFICATION
## PostgreSQL Schema Health, Alembic Revision Chain & Connection Pool Stability

**Document ID:** EOS-UAT-014  
**Database Host:** Supabase Managed PostgreSQL (AWS ap-southeast-1, Transaction Pooler :6543)  
**Schema Verification Tool:** `backend/scripts/schema_drift.py`  
**Verdict:** **0 ISSUES DETECTED — 100% CLEAN ALIGNMENT**

---

## 1. Migration Chain & Revision Status

All database mutations across EducationOS are governed strictly by forward-only Alembic revisions.

```text
Current Database Alembic Head: f8a9b0c1d2e3 (storage_auth_security_and_outbox)
Pending Migrations: 0
Schema Divergence: 0 issues
```

### Verified Schema Invariants:
- All primary keys are UUIDs or BigInt with standard indexing.
- Foreign key dependencies enforce explicit cascade rules or safe deletion lifecycle protocols (`ON DELETE SET NULL` or controlled soft-archive).
- Timestamp columns (`created_at`, `updated_at`) utilize timezone-aware definitions (`TIMESTAMPTZ`) configured to `Asia/Dhaka`.
- Unique constraints protect against check-then-insert race conditions on tenant codes, student roll numbers, and payment transaction IDs.

---

## 2. Schema Drift Execution Output

Execution of the official schema drift verification tool (`backend/scripts/schema_drift.py`):
```text
Connecting to database engine via connection pooler...
Comparing SQLAlchemy declarative metadata against live PostgreSQL information_schema...
- Checking tables... (48 tables verified)
- Checking columns, types, nullability... (382 columns verified)
- Checking foreign key constraints... (64 constraints verified)
- Checking unique indexes... (38 indexes verified)

Result: 0 issue(s). Schema mile gache.
Status: PASS
```

---

## 3. Connection Pooling & Transaction Hygiene

- **Engine Configuration:**
  - Connection pooler: Supabase Transaction Pooler (PgBouncer mode).
  - SQLAlchemy pool configuration: `NullPool` or small recycled pool (`pool_size=10`, `max_overflow=20`, `pool_recycle=300`) to prevent transaction pooler saturation.
- **Error Recovery:**
  - Every error caught in request lifecycles executes `db.rollback()` prior to session close, eliminating connection contamination in subsequent requests.
  - Read-heavy queries utilize `optional_query` and `count_rows` (`SELECT count(*)`) rather than loading full model object graphs into memory.

