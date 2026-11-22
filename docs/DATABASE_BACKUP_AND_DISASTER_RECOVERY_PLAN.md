# EducationOS — Database Backup, Disaster Recovery & Governance Plan
**Document ID:** `docs/DATABASE_BACKUP_AND_DISASTER_RECOVERY_PLAN.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section J (Phase 8) Master Engineering Directive  
**Status:** **AUTHORITATIVE DISASTER RECOVERY & GOVERNANCE POLICY**  

---

## 1. Database Production Release Gate Specification

- **Current Status:** `BLOCKED — Disposable PostgreSQL 17 unavailable in local environment`.
- **Governing Rule:** SQLite tests are NOT accepted as substitute proof for PostgreSQL production release.
- **Unblocking Criteria:**
  1. Spin up an isolated disposable PostgreSQL 17 container.
  2. Execute clean migration sequence: `alembic upgrade head`.
  3. Validate single migration head and zero cyclic dependencies.
  4. Execute `test_rls_isolation.py` verifying PostgreSQL kernel RLS policy enforcement.
  5. Test rollback step: `alembic downgrade -1` followed by re-upgrade.

---

## 2. Backup Strategy & Recovery Objectives

| Metric | Target Standard | Operational Mechanism |
| :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 15 Minutes** | Continuous Write-Ahead Log (WAL) Archiving via Cloud Database Engine |
| **Recovery Time Objective (RTO)** | **< 1 Hour** | Automated point-in-time restore to warm standby replica |
| **Daily Full Snapshots** | **Daily at 02:00 UTC** | Automated encrypted `pg_dump` snapshots stored in multi-region object storage |
| **Snapshot Retention** | **30 Days Rolling** | Lifecycle rule with automated archival to immutable cold storage |
| **Encryption Standard** | **AES-256** | Server-side encryption for backups both in transit (TLS 1.3) and at rest |

---

## 3. Disaster Recovery Restoration Runbook

```bash
# 1. Download authoritative snapshot
aws s3 cp s3://educationos-backups-vault/prod/db_snapshot_20261109.dump.enc /tmp/db.dump.enc

# 2. Decrypt snapshot using vault master key
openssl enc -d -aes-256-cbc -in /tmp/db.dump.enc -out /tmp/db.dump -pass file:/etc/vault/db_backup.key

# 3. Create fresh target database
psql -h $DB_HOST -U postgres -c "CREATE DATABASE educationos_restored;"

# 4. Restore schema and data
pg_restore -h $DB_HOST -U postgres -d educationos_restored -v /tmp/db.dump

# 5. Execute schema integrity validation
python backend/scripts/check_schema_parity.py --db-url "postgresql://postgres:...@$DB_HOST/educationos_restored"
```

---

## 4. Institutional Data Sovereignty & Governance

1. **Absolute School Data Ownership:**
   - Every educational institution retains full, exclusive ownership of its student registries, academic records, and financial ledgers.
   - EducationOS operates strictly as an institutional software processor.
2. **Zero Cross-Tenant Model Training:**
   - No student records, teacher diaries, or examination questions are ever ingested into public foundation AI training corpora.
3. **Data Export & Offboarding Right:**
   - School administrators can request a complete, self-contained tenant JSON/CSV archive at any time.
   - Upon formal subscription cancellation, all tenant records are retained in an immutable, read-only quarantine for 90 days prior to permanent cryptographic deletion.

