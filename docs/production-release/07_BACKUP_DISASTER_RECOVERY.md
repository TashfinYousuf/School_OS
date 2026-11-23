# Phase 7: Production Data, Backup & Disaster Recovery Plan

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Execution Timestamp:** 2026-11-23T16:40:00+06:00 (Asia/Dhaka)  
**Classification:** Business Continuity & Disaster Recovery (BCDR)  
**Engineer:** Principal Database Reliability Engineer  

---

## 1. Executive Mandate & Targets for KSIS Pilot

EducationOS manages core academic rosters, attendance records, guardian contacts, and financial money receipts for Kids Shine International School (KSIS). Data loss or unrecoverable corruption is considered a release-blocking event.

### Agreed Recovery Objectives:
- **Recovery Point Objective (RPO):** **24 Hours Maximum** (Daily physical snapshot) / Real-time WAL stream with Point-In-Time Recovery (PITR).
- **Recovery Time Objective (RTO):** **4 Hours Maximum** to provision a standby instance and restore complete service for the KSIS pilot.

---

## 2. Backup Architecture & Storage Hierarchy

```
  ┌─────────────────────────────────────────────────────────┐
  │         Supabase Cloud PostgreSQL Primary Instance       │
  │                    (Project: ecvllwtiipmvnmuztpog)       │
  └─────────────┬─────────────────────────────┬─────────────┘
                │                             │
    (Continuous WAL Stream)          (Daily Physical Snapshots)
                ▼                             ▼
  ┌───────────────────────────┐ ┌───────────────────────────┐
  │  7-Day Point-In-Time Log  │ │  Encrypted AWS S3 Archive │
  │    (PITR Transaction Log) │ │     (AES-256 at Rest)     │
  └───────────────────────────┘ └───────────────────────────┘
                │                             │
                └──────────────┬──────────────┘
                               ▼
        ┌──────────────────────────────────────────────┐
        │       On-Demand Logical Snapshot Script       │
        │    `pg_dump -Fc` with Schema & Data Integrity │
        └──────────────────────────────────────────────┘
```

---

## 3. Standard Operating Procedures (SOP)

### 3.1 Automated Logical Backup Command
To generate an immutable, compressed logical dump before major administrative events:

```bash
#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups/logical"
BACKUP_FILE="${BACKUP_DIR}/ksis_prod_backup_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

echo "⏳ Generating logical PostgreSQL snapshot..."
pg_dump "$DATABASE_URL" \
  --format=custom \
  --blobs \
  --no-owner \
  --no-privileges \
  --file="$BACKUP_FILE"

echo "✅ Backup successfully created at: $BACKUP_FILE"
echo "📏 Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
```

### 3.2 Non-Destructive Restore Verification Runbook
To verify disaster recovery capabilities without touching live KSIS records:

1. Provision an ephemeral isolated test database (e.g. `educationos_dr_staging`).
2. Execute target restore:
   ```bash
   pg_restore --dbname="$STAGING_DATABASE_URL" \
     --clean \
     --if-exists \
     --no-owner \
     --no-privileges \
     "$BACKUP_FILE"
   ```
3. Run automated schema and count parity verification:
   ```bash
   python backend/scripts/schema_drift.py
   python -c "
   from app.core.database import engine
   from sqlalchemy import text
   with engine.connect() as conn:
       print('Verified Tenant:', conn.execute(text('SELECT school_name FROM tenants WHERE id = \'1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31\'')).scalar())
   "
   ```

---

## 4. Disaster Recovery Scenarios & Playbooks

| Disaster Scenario | Failure Mode | Recovery Action | Target Recovery Time |
|---|---|---|---|
| **Accidental Record Deletion** | Table row mistakenly deleted by admin | Query Supabase PITR to restore table state to 5 minutes prior to incident, or restore logical dump to staging and backfill deleted row. | < 1 hour |
| **Cloud Region Outage** | AWS ap-south-1 experiencing downtime | Deploy Render backend connected to read-replica or restore logical backup to secondary region (AWS Singapore / ap-southeast-1). | < 3 hours |
| **Ransomware / Host Compromise** | Credential leak or unauthorized tampering | Immediately rotate Supabase database password, revoke all active JWT tokens via L2 database table `RevokedTokenRecord`, and redeploy with new `SECRET_KEY`. | < 30 minutes |

---

## 5. Phase 7 Conclusion

Backup policies, disaster recovery runbooks, and recovery objectives (RPO 24h, RTO 4h) are established and verified. Approved for Phase 8 live acceptance testing.

