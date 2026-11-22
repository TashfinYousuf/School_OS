# EducationOS — Stage 11 & Stage 12 Pre-Implementation Audit Report
## Architectural, Security, Data Integrity, and Concurrency Assessment

**Audit Execution Date:** 2026-11-08  
**Scope:** Stage 09 Academic Data Integrity, Stage 10 AI Governance, Cross-Stage Security, Offline (Stage 11) & Billing (Stage 12) Readiness  
**Test Baseline:** 107/107 Tests Passing (96 Backend + 11 Frontend)  
**Alembic Head:** `b2c3d4e5f6a7` (Single linear head)  
**Database Release Gate Status:** BLOCKED (Disposable PostgreSQL instance unavailable; static DAG verified)  

---

## 1. Executive Summary

This pre-implementation audit has been conducted prior to modifying application code for Stage 11 (PWA & Offline Infrastructure) and Stage 12 (Subscription Billing & Entitlement Infrastructure).

The inspection verified the actual repository, ORM models, migration history, API endpoints, frontend state, and security boundaries. The application has achieved a verified baseline of 107 passing tests with single-head migration linearity. However, this audit has uncovered several critical architectural findings, concurrency race conditions, and offline caching vulnerabilities that must be documented and addressed during Stage 11 and Stage 12 reconstruction.

---

## 2. Stage 09 Academic Data Integrity Audit

### 2.1 Admissions Idempotency & Concurrency
- **Application Locking:** In [`backend/app/api/endpoints/admissions.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/admissions.py#L305-L315), the `/enroll` endpoint employs `.with_for_update()` on the `AdmissionApplication` row. Once `app.status == "ENROLLED"`, subsequent calls immediately return the existing application and `enrolled_student_id` without creating duplicate students or guardians.
- **Admission Number Race Condition (P1):** While single-application enrollment is serialized, cross-application concurrent admissions rely on counting active students (`_generate_student_admission_number`). If two administrators enroll different students simultaneously, both may calculate the same sequence number. While `Student` has `UniqueConstraint('tenant_id', 'admission_number')` which catches the duplicate, it will trigger an `IntegrityError` (500) rather than a deterministic sequence allocation unless handled with an atomic PostgreSQL sequence or retry loop.

### 2.2 Attendance Session Model & Daily Uniqueness
- **Constraint Inspection:** In [`backend/app/models/attendance.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/models/attendance.py#L43), the database defines:
  ```python
  UniqueConstraint("tenant_id", "student_id", "date", name="uq_attendance_student_day")
  ```
- **Shift & Session Compatibility Analysis:**
  - This constraint strictly assumes **one attendance record per student per calendar day**.
  - It is **incompatible** with institutions operating multiple shifts (e.g., Morning Shift vs. Day Shift) or period-wise classroom attendance (Period 1 to Period 7) where a student must be marked per period or shift.
  - The model contains `class_id`, but lacks `shift_id`, `session_id`, or `period_number`.
  - **Audit Verdict:** The constraint is sound for primary/secondary single-session schools tracking daily whole-day attendance (and `Half_Day` weighting), but does not support period-wise attendance. We must NOT alter this constraint prematurely in Stage 11 without introducing explicit session dimensions.

### 2.3 Attendance Corrections & Auditing
- **Separation of Duties:** Historic records cannot be updated directly by classroom teachers.
- **Workflow:** Teachers submit `POST /attendance/correction-request` creating an `ApprovalTask` entity with status `PENDING`. Only authorized administrative personnel (`require_roles(["admin"])`) can approve or reject the change via `POST /attendance/correction-approval/{task_id}`, updating the `AttendanceEvent.status` and appending audit remarks.

### 2.4 Examination Lifecycle & Immutability
- **Lifecycle:** State machine progresses from `DRAFT` → `SCHEDULED` → `IN_PROGRESS` → `MARKS_SUBMITTED` → `UNDER_REVIEW` → `APPROVED` → `PUBLISHED`.
- **Publication Lock:** Once `exam.status == "PUBLISHED"`, any attempt to edit or enter marks via `/exams/results/` fails closed with `403 Forbidden` (`Modifications locked: Exam is PUBLISHED`). Corrections require formal administrative status rollback.

### 2.5 Deterministic NCTB Grading
- **Scale:** Evaluated using `Decimal(4, 2)` precision based on the Bangladesh NCTB standard (GPA 0.00–5.00).
- **Fail Invariant:** If a student scores $<33$ (Grade `F`) in any single subject, the entire term GPA collapses to `0.00` and the evaluation status is set to `FAILED`.
- **BOLA Protection:** Student users are strictly barred from fetching peer progress cards (`403 Forbidden`).

### 2.6 Notice Audience Authorization & Receipts
- **Role Isolation:** `GET /notices/` filters notices based on JWT claims: `PARENTS` see `ALL` + `PARENTS`; `TEACHERS` see `ALL` + `TEACHERS`; `STUDENTS` see `ALL` + `STUDENTS`. Confidential teacher notices are excluded from parents and students.
- **Acknowledgement Receipts:** `notice_acknowledgements` enforces `UniqueConstraint("tenant_id", "notice_id", "user_id")` and idempotent insertion.

### 2.7 Timetable Concurrency & Collision Detection (P1)
- **Check-Then-Act Race Condition:** In [`backend/app/api/endpoints/academic.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/academic.py#L112-L149), 3-way routine collision detection (Teacher, Room, and Class-Period) executes queries sequentially and then inserts the slot.
- **Defect:** There is no database-level unique constraint on `(tenant_id, day_of_week, period_number, room_number)` or `(tenant_id, day_of_week, period_number, teacher_name)`. Simultaneous concurrent requests could pass the checks before either transaction commits, resulting in a scheduling collision.

### 2.8 Academy Batch Capacity Concurrency (P1)
- **Vulnerability:** In [`backend/app/api/endpoints/academy.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/academy.py#L160-L178), `/academy/enroll` queries `AcademyBatch` without row locking (`with_for_update()`). It checks `if batch.enrolled_count >= batch.max_seat_capacity:` and then increments `batch.enrolled_count += 1`.
- **Audit Verdict:** Concurrent enrollment requests for the final remaining seat can both read `enrolled_count < max_seat_capacity`, both increment, and exceed the configured maximum seat capacity.

---

## 3. Stage 10 AI Governance Audit

### 3.1 Multi-Provider Abstraction & Fallback
- **Interface:** Clean `BaseAIProvider` class with `GeminiProvider` (Primary) and `GroqProvider` (Secondary fallback).
- **Honest Failures:** If all providers fail or are unconfigured, `MultiModelAIGateway.execute_with_failover()` raises `AIGenerationError` detailing provider errors. Zero fake/preset Banglish data is returned.
- **Gap (P2):** Currently, all tenants share the global provider chain; tenant-specific provider overrides (e.g., enterprise bringing their own Azure/OpenAI API key) are not yet configurable per workspace.

### 3.2 AI Budget Enforcement & Concurrency (P1)
- **Budget Gating:** `TenantAIBudget` tracks monthly token quotas and administrative lock flags (`is_hard_locked`). Rejection occurs via `AIBudgetExceededError` (HTTP 429).
- **Concurrency Gap:** `check_budget_and_reserve()` reads `TenantAIBudget` without row-level locking. If two high-token requests arrive simultaneously near the quota limit, both could pass the reservation check before either records usage, temporarily exceeding the quota.

### 3.3 Prompt Injection Defense & Input Sanitization
- **Current Defenses:** Regex filtering against DAN mode, system prompt overrides, and constraint bypasses; strips `<script>`, `</user_input>`, and XML injection delimiters.
- **Crucial Security Principle:** Input sanitization is an essential defense-in-depth layer but **NOT** a mathematically complete defense against sophisticated semantic prompt injection or jailbreaks.
- **Hallucination Acknowledgment:** Zero-hallucination claims cannot be guaranteed for generative LLMs; all official institutional outputs (exams, lesson plans, notices) MUST remain in `status="Draft"` requiring human educator validation.

### 3.4 Curriculum Grounding & RAG Isolation
- **Storage:** `CurriculumChunk` entity with `tenant_id` and `is_global_curriculum` flag.
- **Row-Level Security:** PostgreSQL policy enforces that global NCTB curriculum chunks are accessible to all tenants, while institutional chunks are strictly locked to the creating tenant. Zero cross-tenant document leakage.
- **Gap (P2):** Ingestion is supported; batch document deletion, chunk re-indexing, and embedding cleanup endpoints are not yet exposed.

---

## 4. Cross-Stage Security & Offline/Billing Prerequisites

### 4.1 Client-Side Offline Caching Vulnerability (P1 — Critical for Stage 11)
- **Current `sw.js` Implementation:** [`frontend/public/sw.js`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/public/sw.js#L35-L52) caches **every** HTTP 200 `GET` response indiscriminately in `educationos-cache-v2`:
  ```javascript
  caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
  ```
- **Security Vulnerability:** This caches sensitive authenticated API responses (e.g., student PII, guardian phone numbers, financial receipts, audit logs) into unencrypted, unpartitioned browser Cache Storage.
- **Required Remediation in Stage 11:**
  1. Restrict Service Worker caching strictly to:
     - Public static assets (CSS, JS, fonts, icons, manifest).
     - Application shell routes (`/dashboard`, `/offline`).
     - Explicitly whitelisted, non-sensitive public reference data.
  2. Block Service Worker from caching `/api/v1/finance`, `/api/v1/auth`, `/api/v1/guardians`, `/api/v1/audit`, and private academic records.

### 4.2 Insecure Offline Mutation Queue (P1 — Critical for Stage 11)
- **Current `offlineQueue.ts` Implementation:** Uses `localStorage` with key `eduos_attendance_offline_queue_${tenantId}`.
- **Vulnerabilities:**
  - **No User Isolation:** Not scoped by `user_id`. If Teacher A queues offline records, logs out, and Teacher B logs in, Teacher B's session would attempt to flush Teacher A's queue!
  - **Infinite Retry Loop:** Retries on every flush without retry bounds, exponential backoff, or dead-letter state. 400 Bad Request or 403 Forbidden errors retry indefinitely.
  - **Storage Limitations:** `localStorage` is synchronous, limited to ~5MB, and vulnerable to quota exhaustion.
- **Required Remediation in Stage 11:**
  - Migrate to a structured `IndexedDB` architecture (`OfflineDatabase`, `MutationQueue`, `SyncCoordinator`).
  - Scope every queued mutation strictly by `(tenant_id, workspace_id, user_id)`.
  - Add mutation state machine: `QUEUED` → `SYNCING` → `SYNCED` | `RETRY_PENDING` | `REJECTED` (Dead-letter).
  - Enforce bounded retries with exponential backoff and jitter.

### 4.3 SaaS Billing vs. Academic Finance Separation (P1 — Critical for Stage 12)
- **Architecture Requirement:** Absolute bounded-context separation between:
  1. **Academic Finance:** Student fee invoices, receipts, school fee ledger (`FeePayment`, `Invoice`, `InvoiceLineItem`).
  2. **SaaS Billing:** Tenant subscription plans, EducationOS software licenses, subscription invoices, payment attempts (`TenantSubscription`, `SubscriptionPayment`, `BillingInvoice`).
- **Current State:**
  - `backend/app/main.py` imports `subscription_router` from `app.api.endpoints.subscriptions`, but mounts `billing.router` at `/api/v1/billing`.
  - Both `billing.py` and `subscriptions.py` have partially overlapping pricing dictionaries and models.
- **Required Remediation in Stage 12:**
  - Unify SaaS billing under a clean, authoritative domain model.
  - Disallow client-asserted transaction IDs without genuine payment provider verification or authorized administrator audit.
  - Implement centralized server-side entitlement enforcement (`has_entitlement(tenant_id, feature)`).

---

## 5. Risk Classification Matrix (P0 / P1 / P2 / P3)

| Priority | Area | Defect / Vulnerability | Remediation Mandate |
|---|---|---|---|
| **P1** | Stage 11 (Offline) | Service Worker caches all 200 GET responses indiscriminately, leaking authenticated PII/finance data to Cache Storage | Restrict SW cache to static assets, app shell, and public reference data; explicitly exclude sensitive APIs |
| **P1** | Stage 11 (Offline) | `offlineQueue.ts` lacks `user_id` scoping in localStorage, causing cross-user queue replay upon account switch | Migrate to IndexedDB with strict `(tenant_id, workspace_id, user_id)` isolation and bounded retry states |
| **P1** | Stage 12 (Billing) | Duplicate routers (`billing.py` vs `subscriptions.py`) and absence of explicit server-side entitlement enforcement engine | Unify SaaS billing models and build centralized `EntitlementService` distinct from academic fee collection |
| **P1** | Stage 09 (Academic) | Batch enrollment capacity (`AcademyBatch`) can be exceeded via concurrent requests (missing row lock) | Add row-level locking (`with_for_update()`) or atomic SQL conditional increment during batch enrollment |
| **P1** | Stage 09 (Academic) | Routine collision checks suffer from check-then-act race conditions under concurrent writes | Document risk and add database uniqueness/locking constraints where appropriate |
| **P1** | Stage 10 (AI) | `check_budget_and_reserve` does not lock `TenantAIBudget` row during token estimation | Implement `.with_for_update()` during budget check and deduction |
| **P2** | Stage 09 (Academic) | `UNIQUE(tenant_id, student_id, date)` prohibits period-wise or multi-shift attendance | Preserve current daily attendance invariant; document session dimension roadmap for future iterations |
| **P2** | Stage 10 (AI) | Lack of document deletion and embedding cleanup API in Curriculum RAG | Add curriculum chunk management endpoints in governance updates |
| **P3** | Frontend (PWA) | PWA icons are present in `public/icons/` but fallback offline UI route is basic | Provide dedicated, localized `/offline` fallback page |

**Gate Status:** Zero P0 blockers currently prevent execution. All identified P1 items directly define the implementation requirements for Stage 11 and Stage 12.

---

## 6. Preflight Conclusion & Authorization Check

The preflight audit is complete and verified.  
- Stage 09 academic data integrity and Stage 10 AI governance have been audited and documented.
- Concurrency and offline security risks have been classified.
- Stage 11 (PWA & Offline Infrastructure) is authorized to proceed with the specific mitigations identified above.

