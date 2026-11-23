# Phase 3: Database & Supabase Architecture Audit Report

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Execution Timestamp:** 2026-11-23T16:35:00+06:00 (Asia/Dhaka)  
**Database Provider:** Supabase Cloud Managed PostgreSQL  
**Release Engineer:** Principal Database Reliability Engineer & Security Auditor  

---

## 1. Database Discovery & Infrastructure Profile

| Parameter | Observed Configuration | Production Evaluation |
|---|---|---|
| **Database Engine** | PostgreSQL 15.x (Supabase Cloud) | Enterprise Managed RDBMS |
| **Project Identifier** | `ecvllwtiipmvnmuztpog` | Dedicated Supabase Organization Project |
| **Cloud Region** | AWS Asia Pacific South 1 (Mumbai - `ap-south-1`) | Minimizes round-trip network latency from Bangladesh (35–50ms) |
| **Host Endpoint** | `aws-1-ap-south-1.pooler.supabase.com` | High-availability pooler endpoint |
| **Port & Protocol** | `6543` (PgBouncer Transaction Pooler) | Eliminates PostgreSQL backend process exhaustion during ASGI concurrency |
| **Encryption in Transit** | TLS 1.3 / SSL Required (`sslmode=require`) | Mandatory encrypted transport |
| **SQLAlchemy Pool Settings** | `poolclass=QueuePool`, `pool_size=10`, `max_overflow=5`, `pool_timeout=10s`, `pool_recycle=1800s` | Optimized for Render web dyno and transaction pooling |

---

## 2. Pilot Institution Data Verification

The database was inspected directly via live SQL inspection. It hosts active pilot institutional data for Kids Shine International School (KSIS):

- **Tenant Record:**
  - `id`: `1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31`
  - `school_name`: `Kids Shine International School`
  - `domain`: `kidsshinebd.com`
  - `is_active`: `true`
- **Tenant Entity Counts:**
  - Users: `6` (Admin, Principal, Teacher, Accountant, Student, Guardian principals)
  - Enrolled Students: `11`
  - Verified Guardians: `11`
  - Account Invitations: `171`
  - Audit Logs: `257`
- **Table Count:** `69` active relational tables managed by SQLAlchemy.

> [!IMPORTANT]
> The database contains live, persistent KSIS data. Under non-negotiable operating rules, no database drops, table resets, or synthetic fixture overrides were performed. All verification was read-only or scoped to isolated ephemeral test IDs.

---

## 3. Migration Lineage & Schema Parity

- **Applied Database Version:** `f8a9b0c1d2e3` (queried from `alembic_version` table).
- **Repository Alembic Head:** `f8a9b0c1d2e3` (`f8a9b0c1d2e3_storage_auth_security_and_outbox.py`).
- **Schema Drift Result:**
  ```text
  0 issue(s). Schema mile gache.
  ```
  Zero schema drift. Every ORM model in `backend/app/models/` matches the PostgreSQL schema definition.

---

## 4. Architectural Boundaries: Supabase vs Application

1. **Authentication:**
   - Application identity and token signing remain firmly anchored in FastAPI using PyJWT and Bcrypt with two-tier revocation (L1 in-memory + L2 database table `RevokedTokenRecord`).
   - The application does NOT use Supabase Auth. This prevents vendor lock-in and eliminates browser exposure of database service keys.
2. **Database Access Security:**
   - Frontend bundles contain zero database credentials or Supabase service-role keys.
   - All client queries must transit the FastAPI API layer via verified Bearer tokens and tenant headers.
3. **Keep-Alive Automation:**
   - GitHub Actions workflow `.github/workflows/keep-alive.yaml` pings the Supabase REST health endpoint every 3 days (`0 0 */3 * *`) to prevent inactivity auto-pausing on free/starter tiers.

---

## 5. Phase 3 Conclusion

The existing Supabase PostgreSQL project is fully qualified, regionally optimized for Bangladesh, schema-synchronized at head revision `f8a9b0c1d2e3`, and safely isolated behind FastAPI. Approved for Phase 4 infrastructure configuration.
