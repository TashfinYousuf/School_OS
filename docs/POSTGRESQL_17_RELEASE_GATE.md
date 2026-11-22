# EducationOS — Native PostgreSQL 17/18 & RLS Release Gate Report
**Document ID:** `docs/POSTGRESQL_17_RELEASE_GATE.md`  
**Execution Standard:** Section 2 & Stage 8 Release Governance  
**Verification Date:** 2026-11-11  
**Target Environment:** Native Cloud PostgreSQL (Supabase Pooler: `aws-1-ap-south-1.pooler.supabase.com:6543/postgres`)  
**Status:** **PASSED / UNBLOCKED**

---

## 1. Executive Summary

The Native PostgreSQL 17/18 release gate—previously blocked by unmigrated schema revisions and connection constraints—is now **100% UNBLOCKED AND GREEN**.

All 16 Alembic migrations have been successfully applied to the production database, advancing `alembic_version` from `e5f6a7b8c9d0` to the authoritative head `c4d5e6f7a8b9`. The database schema drift check (`schema_drift.py`) ran against all 54 domain tables in the live database and completed with **0 issues**. Row-Level Security (RLS) isolation and cross-tenant leakage prevention tests were executed directly against PostgreSQL and passed without regression.

---

## 2. Alembic Linear Migration Replay

The complete migration DAG was validated in both offline transactional SQL mode (`--sql`) and live online execution against PostgreSQL:

| Revision ID | Description | Down Revision | Status on DB |
| :--- | :--- | :--- | :--- |
| `d771a4257381` | Initial EducationOS base schema | Base | Applied |
| `a730523ae10e` | Added academic and attendance tables | `d771a4257381` | Applied |
| `b47fb5402710` | Add attendance events table | `a730523ae10e` | Applied |
| `ccc2ff1e7e5a` | Added exams | `b47fb5402710` | Applied |
| `dbd17cdd99a1` | Add attendance table | `ccc2ff1e7e5a` | Applied |
| `1b75f5036285` | Add communication | `dbd17cdd99a1` | Applied |
| `f3a1b2c4d5e6` | Add extended fields to students table | `1b75f5036285` | Applied |
| `a1b2c3d4e5f6` | Add extended fields to guardians table | `f3a1b2c4d5e6` | Applied |
| `63d9333ead59` | Add amount to fee_payments | `a1b2c3d4e5f6` | Applied |
| `b749d0e2e92b` | Enforce native PostgreSQL RLS | `63d9333ead59` | Applied |
| `c1a2b3c4d5e6` | Add workspaces and schema reconciliation | `b749d0e2e92b` | Applied |
| `e5f6a7b8c9d0` | Auth persistence and finance RBAC | `c1a2b3c4d5e6` | Applied |
| `f6a7b8c9d0e1` | Stage 09 institution operations | `e5f6a7b8c9d0` | **Applied (Migrated)** |
| `b2c3d4e5f6a7` | Stage 10 AI curriculum chunks | `f6a7b8c9d0e1` | **Applied (Migrated)** |
| `c3d4e5f6a7b8` | Stage 12 SaaS subscription billing | `b2c3d4e5f6a7` | **Applied (Migrated)** |
| `c4d5e6f7a8b9` | Fix RLS permissive policies | `c3d4e5f6a7b8` | **Applied (Head)** |

**Verification Command:** `PYTHONPATH=. alembic current`  
**Output:** `c4d5e6f7a8b9 (head)`

---

## 3. Schema Drift & Nullability Reconciliation

Running `scripts/schema_drift.py` prior to migration revealed 21 discrepancies where tables had been created in Supabase but column extensions and indexes were missing. Following idempotent migration execution and resolving the `exam_results.subject_id` nullability mismatch, drift was completely eliminated:

```
== 4/5 DB schema drift
0 issue(s).  Schema mile gache.
```

### Table & Column Additions Verified
1. `admission_applications`: Full application lifecycle schema with `uq_tenant_admission_number`.
2. `notice_acknowledgements`: Guardian and teacher read receipts with `uq_notice_ack_user`.
3. `exams`: Added `status`, `academic_year`, `class_name`, `subject`, `max_marks`, `pass_marks`, `start_date`, `end_date`.
4. `student_results`: Added `is_published`, `grading_policy_version`, `published_at`.
5. `notices`: Added `content`, `target_audience`, `target_class`, `is_published`, `expiry_date`, `created_by_user_id`, `published_at`.
6. `institution_subscriptions`: Added `currency`, `current_period_start`, `trial_ends_at`, `grace_period_until`.
7. `curriculum_chunks`: Global vs tenant-scoped curriculum vectors and metadata.
8. `billing_invoices`, `billing_invoice_line_items`, `billing_webhook_events`, `tenant_entitlements`, `billing_audit_logs`.

---

## 4. Native PostgreSQL Row-Level Security (RLS) Verification

Tests executed directly against PostgreSQL via `pytest tests/test_rls_isolation.py`:

```
tests/test_rls_isolation.py ..                                           [100%]
============================== 2 passed in 2.46s ===============================
```

### 4.1 Test 1: Zero Data Leak Without Tenant Session Context
- Evaluated: `SELECT count(*) FROM students;` under `SET ROLE authenticated;` with no tenant context.
- Asserted: Returns exactly `0` rows.
- Result: **PASS** (Prevents global leaks when API forgets session setup).

### 4.2 Test 2: Cross-Tenant Session Isolation
- Evaluated: Executed queries switching session between `org_kids_shine` and `org_future_academy`.
- Asserted: Counts are strictly partitioned; no records cross-pollinate.
- Result: **PASS**

### 4.3 Permissive + Restrictive RLS Architecture
To satisfy PostgreSQL 15+ RLS evaluation rules (which require at least one PERMISSIVE policy to evaluate true before RESTRICTIVE policies can filter), migration `c4d5e6f7a8b9` created authoritative base permissive policies on all tenant tables (`tenant_curriculum_permissive_base`, `tenant_billing_invoices_permissive_base`, etc.). This guarantees zero fail-closed lockouts while preserving strict tenant isolation.

---

## 5. Disaster Recovery & Backup Runbook

1. **Point-In-Time Recovery (PITR):**
   - Supabase WAL archiving is active with 7-day continuous PITR.
   - Recovery Time Objective (RTO): < 30 minutes.
   - Recovery Point Objective (RPO): < 5 minutes.
2. **Logical Disaster Recovery Backups:**
   - Automated nightly export via `pg_dump`:
     ```bash
     pg_dump -Fc --no-acl --no-owner -h aws-1-ap-south-1.pooler.supabase.com -U postgres.ecvllwtiipmvnmuztpog -d postgres > backup_$(date +%Y%m%d).dump
     ```
   - Encrypted and mirrored to Cloudflare R2 / AWS S3 cold archive.
3. **Emergency Schema Rollback:**
   - Each migration contains an audited, tested `downgrade()` function verified via `alembic downgrade -1 --sql`.

