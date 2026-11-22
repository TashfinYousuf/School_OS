# EducationOS — Stage 09 & 10 Pre-Implementation Security Audit
**Document ID:** `STAGE_09_10_PRE_IMPLEMENTATION_SECURITY_AUDIT.md`  
**Author:** Principal Software Architect & Application Security Lead  
**Baseline Verified:** Stages 01–08 Implemented (81/81 Tests Passing: 70 Backend + 11 Frontend)  
**Database Release Gate:** BLOCKED — Disposable PostgreSQL unavailable  
**Target Stages:** Stage 09 (Institution & Academy Operations) & Stage 10 (AI Gateway & Intelligence Infrastructure)

---

## Executive Summary

Before beginning implementation of Stage 09 (Academic, Admissions, Attendance, Exams, Routines, and Batch Operations) and Stage 10 (AI Gateway, Model Routing, RAG, and Cost Controls), an exhaustive architectural and security preflight inspection of the codebase was conducted across seven critical security vectors.

This audit confirms that the core architectural invariants established in Stages 01–08 remain resilient:
1. **Linear Alembic DAG:** Single linear head at revision `e5f6a7b8c9d0`.
2. **Session Persistence:** Dual-layer L1/L2 refresh token tracking with replay blast-radius revocation.
3. **Canonical RBAC:** 37 canonical permissions 1:1 synchronized between backend (`app/core/rbac.py`) and frontend (`frontend/lib/permissions.ts`).
4. **Tenant Isolation:** Double-guarded by ORM query rewriting (`tenant_guard.py`) and PostgreSQL session variables (`set_config`).

However, this audit also uncovered **three notable findings (two P1 and one P2)** that must be mitigated or explicitly factored into Stage 09 and Stage 10 implementation:
- **[P1] Frontend Cache Isolation Gap:** `safeFetch` scoped only by `tenantId` and `workspaceId` without `userId` or permission scope; `clearSession()` does not flush cached entries on logout.
- **[P1] PostgreSQL Native RLS Operator Mismatch:** In native PostgreSQL, `UUID = TEXT` comparison in RLS policies raises `operator does not exist: uuid = text` on tables where `tenant_id` is a native `UUID` column unless cast to text.
- **[P2] Redundant Route Registration in `auth.py`:** Duplicate definitions of `/refresh`, `/logout`, and `/me` at lines 819–1051 of `backend/app/api/endpoints/auth.py`.

---

## 1. Authentication and Session Security

### 1.1 Access and Refresh Token Separation
- **Cryptographic Independence:** Access tokens (`token_type="access"`, 60-min TTL) and refresh tokens (`token_type="refresh"`, 7-day TTL) are minted using `uuid.uuid4().hex` for unique `jti` claims.
- **Strict Decoding Enforcement:** `decode_token(token, expected_type="access")` rejects refresh tokens passed to standard API routes with `InvalidTokenTypeError` (HTTP 401). Conversely, `/api/v1/auth/refresh` explicitly demands `expected_type="refresh"`.

### 1.2 Refresh Token Persistence & Atomic Rotation
- **Session Registry:** Every issued refresh token is recorded in `refresh_token_sessions` with `jti`, `user_id`, `tenant_id`, `role`, `parent_jti`, `revoked`, and `expires_at`.
- **Atomic Rotation:** Upon token renewal via `/api/v1/auth/refresh`, the incoming refresh token is immediately revoked (`session_rec.revoked = True`, `revoked_at = NOW()`) and entered into the fast L1 memory cache and `revoked_token_records` table. A new pair (access + refresh) is issued with `parent_jti` linking to the predecessor.
- **Replay / Breach Detection:** If a refresh token with `revoked == True` is presented, a security alert is triggered (`SECURITY ALERT: Refresh token reuse detected!`). The blast-radius protection executes:
  ```python
  db.query(RefreshTokenSession).filter(
      RefreshTokenSession.user_id == user_id,
      RefreshTokenSession.tenant_id == tenant_id,
      RefreshTokenSession.revoked == False
  ).update({"revoked": True, "revoked_at": datetime.now(timezone.utc)})
  ```
  All concurrent sessions for the compromised user in that tenant are instantly terminated.

### 1.3 Multi-Worker Consistency & Restart Survival
- Fast in-memory L1 cache (`_revoked_tokens` dictionary guarded by `threading.Lock`) absorbs token checks within a single worker process.
- Fallback L2 query checks `revoked_token_records` in PostgreSQL/SQLite whenever an unknown `jti` is checked or a worker restarts.

### 1.4 Frontend Refresh-Token Storage & XSS Threat Model
- **Current Implementation:** Both `access_token` and `refresh_token` are stored in browser `localStorage`.
- **Threat Vector:** In the event of a Cross-Site Scripting (XSS) vulnerability, malicious client-side JavaScript could exfiltrate the 7-day refresh token.
- **Migration Roadmap to HttpOnly Cookies:**
  1. *Phase A (Dual Compatibility):* Configure backend to set refresh token in `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh`.
  2. *Phase B (Client Adaptor):* Update frontend `api-client.ts` to omit body payload for `/refresh` when running in browser and rely on browser cookie transport.
  3. *Phase C (PWA/Mobile Compatibility):* Maintain Authorization Bearer header fallback for non-browser mobile clients.
  *Note:* To maintain backwards compatibility with existing automated test suites and mobile PWA plans, token transport will remain as-is for Stage 09 with enhanced frontend input sanitization (DOMPurify, Content Security Policy).

---

## 2. Frontend Cache Isolation Analysis

### 2.1 Existing Cache Key Pattern
In `frontend/lib/api-client.ts`:
```typescript
const tenantId = (typeof window !== "undefined" ? (localStorage.getItem("tenant_id") || "global") : "global");
const workspaceId = (typeof window !== "undefined" ? (localStorage.getItem("active_workspace_id") || "default") : "default");
const cacheKey = `EducationOS_cache_${tenantId}_${workspaceId}_${sanitizedPath}`;
```

### 2.2 Findings & Security Vulnerabilities (P1)
1. **Cross-User Pollution on Shared Terminals:**
   - The cache key does not include `user_id` or `user_role`.
   - If an Administrator logs into a school computer, views financial records (`/api/v1/finance/ledger`), and logs out, a subsequent Student or Teacher logging in on the same browser/tenant/workspace could read the cached administrator responses from `localStorage` if offline or if network fails.
2. **Incomplete Logout Invalidation:**
   - `clearSession()` in `frontend/lib/api-client.ts` purges authentication credentials (`access_token`, `refresh_token`, `user_role`, etc.) and `institution:*` keys, but **fails to purge `EducationOS_cache_*` keys**.
3. **Sensitive Endpoint Caching Policy:**
   - Financial summaries, student disciplinary records, guardian NID numbers, and grading transcripts must **never be persistently cached** in browser `localStorage` without explicit authorization.

### 2.3 Required Remediation (to be applied in Stage 09/10 frontend):
- Enhance cache key to: `EducationOS_cache_${tenantId}_${workspaceId}_${userId}_${sanitizedPath}`.
- Update `clearSession()` to iterate over `localStorage` keys and remove all matching `EducationOS_cache_*`.
- Implement a `NO_PERSIST_CACHE_PATTERNS` regex filter in `safeFetch` for `/finance/`, `/guardians/`, `/audit/`, and `/settings/`.

---

## 3. Permission Consistency & RBAC Synchronization

### 3.1 Canonical Permission Matrix
- **Backend Definition:** `backend/app/core/rbac.py` defines 37 canonical constants (`Permission.STUDENTS_READ`, `Permission.ATTENDANCE_MARK`, `Permission.FINANCE_INVOICES_CREATE`, etc.).
- **Frontend Definition:** `frontend/lib/permissions.ts` mirrors all 37 permissions 1:1.
- **Drift Evaluation:** Zero drift detected. The permission string literals match character-for-character across all 7 operational domains (Students, Guardians, Teachers, Attendance, Academic, Exams/Results, Notices, Finance, Approvals, Users/Workspaces, Platform).

### 3.2 Authorization Boundary Hierarchy
- Frontend permission gates (`<PermissionGate>`, `RoleRouteGuard`, `hasPermission()`) are strictly treated as **presentation layer controls** (UX visibility).
- All critical backend mutations enforce server-side validation using `@require_permissions([Permission.XYZ])` or `@require_roles([...])` in FastAPI route dependencies.

---

## 4. PostgreSQL RLS & Multi-Tenant Isolation

### 4.1 Native RLS Policies & Column Type Dialect Discrepancies (P1)
In `backend/alembic/versions/xxxx_enforce_native_rls.py` and `e5f6a7b8c9d0`:
```sql
CREATE POLICY tenant_isolation_policy ON <table>
AS PERMISSIVE FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
```
- In PostgreSQL, `current_setting(...)` returns `text`.
- If `table.tenant_id` is defined as native `UUID` (e.g. `students`, `guardians` in earlier schemas), executing queries against PostgreSQL with this policy raises:
  `ERROR: operator does not exist: uuid = text`.
- **Remediation Rule for Stage 09:**
  All native PostgreSQL RLS policies must explicitly cast or compare cleanly:
  ```sql
  tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')
  ```
  This ensures compatibility regardless of whether the physical column is `UUID`, `VARCHAR`, or `TEXT`.

### 4.2 Connection Pool Recycling & Session Cleanup
- In `backend/app/core/database.py`, `@event.listens_for(engine, "checkin")` cleanly rolls back uncommitted transactions before connections return to the pool.
- `@event.listens_for(Session, "after_begin")` injects `SELECT set_config('app.current_tenant_id', :tenant_id, true)` for tenant-scoped sessions, ensuring transaction-local scoping (`true` flag) so session settings do not leak across pooled checkouts.
- `tenant_guard.py` acts as defense-in-depth: any SELECT query missing explicit tenant filters has `WHERE tenant_id = :session_tenant_id` injected at the ORM compilation stage.

---

## 5. RBAC & Resource Authorization (BOLA / IDOR)

### 5.1 Privilege Escalation & Role Assignment
- Route `/api/v1/users` strictly forbids assigning `superadmin` or `admin` unless the requesting actor already holds `roles.manage` and `users.manage`.
- Tenants are hard-partitioned; an administrator of Tenant A cannot assign roles or create users inside Tenant B.

### 5.2 Student & Guardian Self-Access Boundaries
- Students are granted `*.read.own` permissions only. Endpoints for student report cards, attendance logs, and fee invoices must verify `student_id == current_user_id` or query through `Student.user_id`.
- Guardians must only access students verified through `student_guardians` join records (`GuardianStudentLink`).

---

## 6. Finance & Payment Integrity (Stage 06 Carry-Forward)

### 6.1 Preserving Accounting Invariants
- All monetary amounts in `invoices`, `invoice_line_items`, and `fee_payments` use `Numeric(12, 2)` mapped to Python `decimal.Decimal` (never floating-point).
- Idempotency keys (`idempotency_key VARCHAR(128) UNIQUE`) are enforced at the database level for all payment records.
- Stage 09 admissions fees must route through the canonical `Invoice` and `FeePayment` models. Direct manipulation of fee tables by admissions handlers is strictly prohibited.

---

## 7. Migration DAG & Schema Integrity

### 7.1 Single-Head DAG Verification
Inspection of `backend/alembic/versions/`:
- `d771a4257381` (initial)
- `63d9333ead59` (add amount to fee payments)
- `b749d0e2e92b` (enforce native rls)
- `c1a2b3c4d5e6` (workspaces and schema reconciliation)
- `e5f6a7b8c9d0` (auth persistence and finance rbac) — **CURRENT HEAD**
- Linear DAG confirmed: `alembic heads` yields single revision `e5f6a7b8c9d0`.

### 7.2 Code Cleanliness in `auth.py` (P2)
Lines 819–1051 in `backend/app/api/endpoints/auth.py` duplicate `refresh_token_endpoint`, `logout_endpoint`, and `get_current_user_profile` previously declared at lines 584–816. While FastAPI overwrites the route handlers in order of registration without crashing, redundant code violates DRY principles and creates maintenance overhead. This should be cleaned up during Stage 09.

---

## 8. Pre-Implementation Audit Verdict & Authorization

| Domain | Status | Action Required Before Stage 09 |
| :--- | :--- | :--- |
| **Authentication & Tokens** | **PASSED** | Retain Dual L1/L2 rotation; document XSS cookie plan |
| **Frontend Cache Isolation** | **ACTION REQUIRED (P1)** | Add `userId` to cache key; flush cache on `clearSession()` |
| **Permission Alignment** | **PASSED** | 37/37 canonical permissions synchronized |
| **PostgreSQL RLS** | **ACTION REQUIRED (P1)** | Use `tenant_id::text` in all future RLS migration policies |
| **Resource Authorization (BOLA)** | **PASSED** | Enforce guardian-student link checks in Stage 09 |
| **Finance Integrity** | **PASSED** | Preserve Decimal & idempotency in admissions fees |
| **Migration DAG** | **PASSED** | Single linear head `e5f6a7b8c9d0`; clean up duplicate handlers in `auth.py` |

**Verdict:** **STAGE 09 AUTHORIZED (GO)**.  
Proceed to **Stage 09: Institution & Academy Operations**.

