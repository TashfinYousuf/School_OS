# EducationOS — IT Administrator & Operations Runbook
# এডুকেশনওএস — আইটি অ্যাডমিনিস্ট্রেটর ও অপারেশন ম্যানুয়াল

**Version:** 2.0 Enterprise Verified  
**Target Audience:** School System Administrators, DevOps Engineers, IT Operations Staff  
**Architecture:** Multi-Tenant PostgreSQL, FastAPI Microservices, Next.js 16/14 Frontend  
**Language:** Technical English & বাংলা  

---

# 1. ARCHITECTURE & MULTI-TENANT ISOLATION
## ১. মাল্টি-টেন্যান্ট ডেটাবেস আর্কিটেকচার ও আইসোলেশন

### 1.1 PostgreSQL Kernel Isolation & Row-Level Security (RLS)
EducationOS employs an institutional tenant model enforced at the PostgreSQL database kernel:
- Root table partitioning and filtering by `tenant_id: UUID`.
- Database sessions apply tenant scoping via `SET LOCAL app.current_tenant_id = :tenant_id` on connection checkout.
- Queries without verified tenant claims return zero rows, protecting against cross-tenant data leakage.

### 1.2 Tenant vs Workspace Context Resolution
- **Tenant (`tenant_id`):** The primary legal educational entity (e.g., School Trust, Foundation, or District School).
- **Workspace (`active_workspace_id`):** Sub-campus, branch, or operational unit (e.g., *Main Campus*, *Boys Wing*, *Cadet Coaching Academy*).
- **Runtime Handling:**
  - `X-Tenant-ID`: Cryptographically derived from verified JWT claims; cannot be overridden by client localStorage.
  - `X-Workspace-ID`: Validated on every request via FastAPI dependency (`backend/app/api/deps.py`).
  - **Single-Branch Schools:** If a tenant has only one active workspace, the UI suppresses the dropdown selector, maintaining a clean header with the school badge.
  - **Multi-Branch Staff:** Multi-campus administrators and floating teachers receive a compact dropdown to switch campuses intentionally. Students and guardians never see workspace switchers.

---

# 2. DATABASE MIGRATION & RELEASE GATE GOVERNANCE
## ২. ডেটাবেস মাইগ্রেশন ও রিলিজ গেট নীতিমালা

### 2.1 Alembic Migration Versioning
- All schema changes must be declared in idempotent Alembic revisions located in `backend/alembic/versions/`.
- Offline SQL verification is mandatory:
  ```bash
  alembic upgrade head --sql
  ```
- Down migrations must be tested to ensure rollback safety.

### 2.2 Database Release Gate Status
- **Current Gate Status:** `BLOCKED — Disposable PostgreSQL unavailable in local environment`.
- **Policy:** Application logic, offline sync idempotency, and BOLA/IDOR access controls are fully verified via in-memory SQLite cross-dialect test suites. Direct schema changes against live production Supabase are strictly prohibited without an isolated staging PostgreSQL rehearsal and verified database backup.

---

# 3. SECURITY CONTROLS, AUTHENTICATION & ACCESS AUDITING
## ৩. নিরাপত্তা ব্যবস্থা, অথেনটিকেশন ও অডিট ট্রেইল

### 3.1 Cryptographic Token Management
- **Access Tokens:** Standard JWT HMAC-SHA256 tokens with tenant and role claims (`tenant_id`, `sub`, `role`). Expiration: 1 hour.
- **Refresh Tokens:** Stored in the server session registry (`refresh_token_sessions`) with rotation and multi-device revocation capability.
- **Password Hashing:** Passwords hashed with bcrypt (cost factor 12) featuring dummy hash verification to mitigate timing oracle attacks.

### 3.2 BOLA / IDOR Protection
- Guardian endpoints (`/api/v1/guardians/me/children` and `/api/v1/attendance/student/{id}`) strictly verify that the student is mapped to the requesting guardian in `student_guardians`.
- Student endpoints (`/api/v1/students/me/dashboard`) reject attempts to access peer records with HTTP 403 Forbidden.

### 3.3 Rate Limiting & Brute-Force Defense
- Sliding-window attempt rate limiting on authentication routes (5 failed attempts per 15 minutes per IP/User).
- Rapid failed login attempts trigger HTTP 429 Too Many Requests with exponential backoff.

---

# 4. ENVIRONMENT CONFIGURATION RUNBOOK
## ৪. পরিবেশ ভ্যারিয়েবল ও কনফিগারেশন চেকলিস্ট

```env
ENVIRONMENT=production
DATABASE_URL=postgresql://user:password@pooler.supabase.com:6543/postgres?sslmode=require
SECRET_KEY=[High-Entropy 256-Bit Secret Key]
BACKEND_CORS_ORIGINS=["https://educationos.com","https://*.educationos.com"]
ALLOWED_HOSTS=["educationos.com","*.educationos.com","localhost"]
OFFLINE_SYNC_MAX_BATCH_SIZE=100
OFFLINE_SYNC_RETRY_LIMIT=5
```

### 4.1 System Health Checks
- **FastAPI Root & Health:** `GET /health` returns `{ "status": "healthy", "service": "educationos-api" }`.
- **Tenant Context Verification:** `GET /api/v1/workspaces/` validates active workspace membership and tenant binding.
