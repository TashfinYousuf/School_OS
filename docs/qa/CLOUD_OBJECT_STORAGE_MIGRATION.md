# EducationOS Cloud Object Storage Migration
## Cloudflare R2 / AWS S3 Integration, Multi-Tenant Key Hierarchy & Checksum Verification

**Document ID:** `EDOS-QA-P0C-001`  
**Classification:** Critical Infrastructure Migration & Security Architecture  
**Scope:** Object Storage (`storage_service.py`), PostgreSQL Asset Ledger (`uploaded_assets`), RLS Policies, Magic-Byte Auditing  
**Pilot Institution:** Kids Shine International School (KSIS), Dhaka, Bangladesh  
**Status:** IMPLEMENTED & AUDITED  

---

## 1. Executive Summary

Previously, uploaded assets (curriculum textbooks, admission documents, fee receipts, student photos) relied on unstructured local filesystem directory storage (`/uploads`). Local storage presents critical production limitations:
1. Inability to scale across multi-instance or auto-scaling container clusters.
2. Risk of data loss upon ephemeral container restarts.
3. Lack of cryptographic checksum verification and tamper-evident audit trails.
4. Absence of time-limited pre-signed URLs, risking direct public exposure of sensitive student records.

This document records the migration to an enterprise S3-compatible Cloud Object Storage architecture (Cloudflare R2 / AWS S3) with PostgreSQL metadata tracking and native Row-Level Security.

---

## 2. Architecture & Design Principles

### 2.1. Strict Multi-Tenant Private Key Hierarchy
Every stored object is assigned a deterministic, non-guessable, tenant-scoped storage key:
$$\text{Storage Key} = \texttt{tenant/}\{\text{tenant\_id}\}\texttt{/}\{\text{category}\}\texttt{/}\{\text{asset\_id}\}\texttt{/}\{\text{safe\_filename}\}$$

**Approved Categories & Maximum Size Quotas:**
| Category | Purpose | Max Size Limit | Allowed MIME Types |
| :--- | :--- | :--- | :--- |
| `curriculum` | NCTB national textbooks, syllabi, lecture notes | 25 MB | `application/pdf`, `application/vnd.openxmlformats-...`, `text/plain` |
| `admissions` | Birth registration certificates, prior transcripts, NID scans | 10 MB | `application/pdf`, `image/jpeg`, `image/png` |
| `avatars` | Student & teacher profile photographs | 5 MB | `image/jpeg`, `image/png` |
| `receipts` | Tamper-evident financial counter receipts | 5 MB | `application/pdf` |
| `question_papers` | Exam blueprints and generated question sets | 15 MB | `application/pdf`, `application/vnd.openxmlformats-...` |
| `exports` | Bulk institution CSV/Excel backups and grade sheets | 30 MB | `text/csv`, `application/octet-stream` |

### 2.2. PostgreSQL Metadata Tracking Ledger (`uploaded_assets`)
A dedicated table was created via Alembic revision `f8a9b0c1d2e3`:
```sql
CREATE TABLE uploaded_assets (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    category VARCHAR(64) NOT NULL,
    storage_provider VARCHAR(32) NOT NULL DEFAULT 'r2',
    storage_key VARCHAR(512) NOT NULL UNIQUE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(32) NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256_checksum VARCHAR(64) NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    uploaded_by_user_id VARCHAR(64),
    metadata_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.3. Row-Level Security (RLS) Enforced at Database Level
```sql
ALTER TABLE uploaded_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_assets FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_uploaded_assets ON uploaded_assets
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

CREATE POLICY public_select_uploaded_assets ON uploaded_assets
FOR SELECT
USING (is_public = TRUE);
```

### 2.4. File Integrity & Upload Security
1. **Magic-Byte Content Validation:** Verifies actual file byte headers before persisting:
   - PDF: `%PDF-`
   - PNG: `\x89PNG\r\n\x1a\n`
   - JPEG: `\xff\xd8\xff`
   - DOCX: `PK\x03\x04`
2. **Cryptographic Checksum:** Calculates SHA-256 hash for end-to-end data integrity.
3. **Pre-Signed Expiring URLs:** Generates time-bounded pre-signed URLs (default: 3600 seconds) so private assets are never exposed via unauthenticated public URLs.
4. **Resilient Local Fallback:** When deployed in offline/local evaluation environments without S3/R2 credentials, `StorageService` automatically uses tenant-isolated local filesystem fallback without requiring code alterations.

---

## 3. Verification & Automated Test Evidence

| Test Case | Scope | Result |
| :--- | :--- | :--- |
| `test_storage_service_upload_download_and_tenant_isolation` | S3/R2 upload, SHA-256 fingerprint, cross-tenant download rejection, pre-signed link generation, deletion lifecycle | PASS |
| `test_storage_service_magic_byte_validation_and_size_limits` | Magic-byte signature enforcement, extension mismatch rejection, category size limit enforcement | PASS |
| `test_alembic_dag_single_head` | Alembic DAG migration validation (head: `f8a9b0c1d2e3`) | PASS |
| `test_alembic_offline_sql_upgrade` | Offline SQL generation across all revisions | PASS |

---

## 4. Production Readiness Sign-Off
Cloud Object Storage is fully operational, protected by native PostgreSQL RLS, validated against malicious payloads via magic-byte inspection, and ready for production deployment at Kids Shine International School.

