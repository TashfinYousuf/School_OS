# Stage 11: PWA, Offline Synchronization & Resilient Infrastructure Acceptance Report

**Project:** EducationOS (SchoolOS Enterprise)  
**Stage:** 11 — Progressive Web App (PWA) & Offline-First Synchronization Infrastructure  
**Status:** **ACCEPTED & PASSED**  
**Gate Evaluation:** **PASS** (Ready to proceed to Stage 12)  
**Author:** Principal Software Architect & QA Lead  
**Date:** 2026-11-08  

---

## 1. Executive Summary

Stage 11 introduces enterprise-grade Progressive Web App (PWA) and offline-first capabilities to EducationOS without compromising the application's stringent multi-tenancy, security boundaries, or financial data isolation.

Prior to this reconstruction, offline functionality relied on an unpartitioned Service Worker (`frontend/public/sw.js`) that indiscriminately cached 200 HTTP responses (including sensitive JSON payloads) and a fragile single-key `localStorage` queue (`offline_attendance_queue`) vulnerable to cross-user data leakage, quota exhaustion, and unhandled 409 concurrency conflicts.

In Stage 11, the offline subsystem was completely re-architected with:
1. **Partitioned Service Worker Caching & Sensitive API Quarantine:** Explicit denial regex blocking `/api/v1/(auth|finance|guardians|audit|settings|approvals|admissions|billing)/` from Service Worker caches, with a dedicated `/offline` UI fallback.
2. **Durable Multi-Tenant IndexedDB Queue:** Schema partitioned by `[tenant_id, user_id]` compound indexes with automatic user data purge upon logout or session rotation.
3. **Finite State Machine (FSM) Mutation Queue:** Idempotent UUID transaction keys, bounded exponential backoff retries (maximum 5), and dead-letter `REJECTED` quarantine preventing endless retry storms.
4. **Domain-Aware Conflict Resolution:** Deterministic error classification distinguishing between permanent client errors (4xx dropped), transient server errors (5xx/network retried), and domain concurrency conflicts (409 flagged for manual review).
5. **Backend Idempotent Batch Sync Endpoint:** Transaction-level PostgreSQL advisory locks (`pg_advisory_xact_lock`), single-pass student verification, and safe cross-tenant isolation skipping foreign IDs.

---

## 2. Architecture & Implementation Details

### 2.1 Service Worker & Cache Partitioning (`frontend/public/sw.js`)
- **Shell & Static Partitions:**
  - `educationos-shell-v3`: Core app shell (`/`, `/offline`, `/manifest.json`, fallback icons).
  - `educationos-static-v3`: Immutable static Next.js assets (`/_next/static/*`, `/icons/*`).
- **Sensitive API Quarantine:**
  ```javascript
  const SENSITIVE_API_QUARANTINE_PATTERN =
    /\/api\/v1\/(auth|finance|guardians|audit|settings|approvals|admissions|billing)\//i;
  ```
  Any network request matching this pattern bypasses Service Worker caches completely (`fetch(event.request)`).
- **Navigation Strategy:** Network-first with immediate offline fallback to `/offline` if network is unreachable and page is not pre-cached.
- **Push Notification Support:** Implemented `push` and `notificationclick` handlers supporting deep links to `/dashboard/*` with tenant safety.

### 2.2 Offline Fallback Experience (`frontend/app/offline/page.tsx`)
- Provides bilingual (English and Bengali) UX explaining offline status.
- Guides users that attendance and offline actions remain safely queued locally.
- Re-check connectivity button triggering `window.location.reload()`.

### 2.3 IndexedDB Architecture (`frontend/lib/offline/db.ts`)
- Database: `educationos_offline_db` (Version 1).
- Object Stores:
  1. `mutations`: Primary key `id` (UUID). Indexes: `by_tenant_user` (`[tenant_id, user_id]`), `by_status` (`status`), `by_created_at` (`created_at`).
  2. `reference_cache`: Primary key `cache_key`. Indexes: `by_tenant` (`tenant_id`), `by_expires_at` (`expires_at`).
- Automatic In-Memory Fallback: Headless/SSR test execution environments gracefully use an in-memory storage simulator when `window.indexedDB` is undefined.
- Session Cleanup: `purgeUserData(tenantId, userId)` purges all offline records and cached reference data for a given user when `clearSession()` is invoked upon logout.

### 2.4 Mutation Queue FSM & Retry Logic (`frontend/lib/offline/mutation-queue.ts`)
- **State Machine:**
  - `QUEUED`: Newly registered mutation with client-generated idempotency key.
  - `SYNCING`: Currently in-flight through `SyncCoordinator`.
  - `SYNCED`: Successfully processed and acknowledged by server.
  - `RETRY_PENDING`: Transient failure encountered; backoff timer initialized (`retry_count < max_retries`).
  - `REJECTED`: Terminal dead-letter state (permanent 4xx error or retry limit exhausted).
  - `CONFLICT`: 409 conflict requiring manual operator review.

### 2.5 Conflict Resolution Strategy (`frontend/lib/offline/conflict-resolver.ts`)
| Response Condition | Category | Resolution Action | Queue Next State |
|---|---|---|---|
| HTTP 400, 401, 403, 404, 422 | Client Semantic Error | Drop permanently | `REJECTED` |
| HTTP 409 Conflict (Attendance) | Concurrency Overwrite | Flag for manual review | `CONFLICT` |
| HTTP 429 Rate Limited | Throttled | Exponential backoff | `RETRY_PENDING` |
| HTTP 500, 502, 503, 504 | Server Transient Error | Exponential backoff | `RETRY_PENDING` |
| Network / Fetch Failure | Offline / Disconnected | Wait for `online` event | `RETRY_PENDING` |
| Max Retries Reached (5) | Exhaustion | Dead-letter quarantine | `REJECTED` |

### 2.6 Sensitive Data Quarantine (`frontend/lib/offline/offline-cache-manager.ts`)
- Strict blacklist: `finance_ledger`, `student_pii`, `guardian_contacts`.
- Any call to `offlineCacheManager.cacheReferenceData` with blacklisted keys throws a fatal `SecurityError: Security policy violation: caching ... is strictly prohibited`.
- Approved keys (`academic_calendar`, `exam_schedules`, `class_routines`) enforce a maximum 24-hour TTL.

### 2.7 Backend Offline Synchronization Endpoint (`backend/app/api/endpoints/attendance.py`)
- Endpoint: `POST /api/v1/attendance/sync-offline`
- Authentication & RBAC: `require_roles(["admin", "teacher"])`.
- Advisory Locking: Serializes concurrent syncs per school and day using PostgreSQL advisory lock:
  ```python
  if db.bind and db.bind.dialect.name == "postgresql":
      db.execute(
          text("SELECT pg_advisory_xact_lock(hashtext(:k))"),
          {"k": f"attendance:{tid}:{attendance_date.isoformat()}"},
      )
  ```
- Two-Query Batch Processing: Fetches all candidate students and existing attendance records in 2 single-batch queries instead of $2 \times N$ round trips.
- Safe Tenant Boundary: Silently skips student IDs belonging to foreign tenants without raising an error or leaking information (`data["skipped"]["unknown_student"] += 1`).

---

## 3. Test Verification Matrix

### 3.1 Frontend Test Suite (`frontend/tests/test_stage11_offline.test.ts`)
All 13 Stage 11 unit/integration tests passed in Node.js test runner:
1. `should enqueue mutation with unique idempotency key and initial QUEUED status` -> **PASSED**
2. `should increment retry count on transient failure and transition to RETRY_PENDING` -> **PASSED**
3. `should transition to REJECTED dead-letter state when max retries exceeded` -> **PASSED**
4. `should mark permanent client errors as REJECTED immediately without looping` -> **PASSED**
5. `should strictly isolate mutations between different users in same tenant` -> **PASSED**
6. `should strictly isolate mutations between different tenants` -> **PASSED**
7. `should purge only the logged-out user data upon logout/account switch` -> **PASSED**
8. `should drop 4xx client errors to avoid infinite loops` -> **PASSED**
9. `should require manual review on 409 attendance conflict` -> **PASSED**
10. `should retry on 5xx transient server errors` -> **PASSED**
11. `should allow caching approved public academic reference data` -> **PASSED**
12. `should throw security violation error when attempting to cache financial records` -> **PASSED**
13. `should throw security violation error when attempting to cache student PII or guardian contacts` -> **PASSED**

Combined Frontend Suite: **24/24 passing** (11 Stage 07 + 13 Stage 11). TypeScript check: **0 errors**.

### 3.2 Backend Test Suite (`backend/tests/test_stage11_offline_sync.py`)
All 5 Stage 11 backend sync tests passed in Pytest:
1. `test_offline_attendance_batch_sync_success` -> **PASSED**
2. `test_offline_attendance_sync_idempotency_and_conflict_update` -> **PASSED**
3. `test_offline_attendance_sync_role_enforcement` -> **PASSED**
4. `test_offline_attendance_sync_future_date_rejected` -> **PASSED**
5. `test_offline_attendance_sync_foreign_students_skipped_safely` -> **PASSED**

Backend Regression Suite: **101/101 passing** across Stages 01–11.

---

## 4. Stage 11 Acceptance Gate Sign-Off

| Gate Criterion | Requirement | Result |
|---|---|---|
| Service Worker Partitioning | Distinct shell/static caches & sensitive API quarantine | **VERIFIED** |
| Multi-Tenant Offline Storage | Storage isolated by tenant/user; purged on logout | **VERIFIED** |
| Finite State Machine Queue | Bounded retries (<= 5) & dead-letter queue | **VERIFIED** |
| Conflict Resolution | 4xx dropped, 409 flagged, 5xx retried | **VERIFIED** |
| Sensitive Data Quarantine | Financial ledger & PII blocked from client cache | **VERIFIED** |
| Backend Sync Idempotency | Advisory locks, upsert idempotency, zero cross-tenant leak | **VERIFIED** |
| Full Test Suite | Zero regressions in Stage 01–10; Stage 11 tests pass | **VERIFIED** (101 backend + 24 frontend) |

**Stage 11 Verdict:** **PASS**  
**Action:** Stage 11 is complete and accepted. Proceed immediately to Stage 12: Subscription Billing & Entitlement Infrastructure.

