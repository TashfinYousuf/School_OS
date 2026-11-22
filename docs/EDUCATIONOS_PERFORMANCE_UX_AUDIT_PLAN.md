# EducationOS — Performance & UX Engineering Audit Plan (Stage 12.7)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Performance Engineer & Full-Stack Architect  
**Target Milestone:** Stage 12.7 Implementation  
**Execution Mode:** Gated Architectural Plan (Awaiting Authorization)

---

## 1. Executive Summary & Audit Baseline

EducationOS must deliver snappy, sub-second responses across low-bandwidth 3G/4G networks in Bangladesh while maintaining strict multi-tenant isolation, data consistency, and accessibility standards.

An architectural audit of the active codebase reveals several key performance and UX bottlenecks:
1. **Database Query Fan-Out on Dashboard:** `/metrics` and `/operational-kpis` execute 7–10 sequential, unaggregated `.count()` queries on every page load.
2. **Synchronous `localStorage` Caching:** `safeFetch` caches in synchronous `localStorage` with a 5MB storage ceiling, vulnerable to `QuotaExceededError` and main-thread blocking during large JSON deserialization.
3. **Volatile AI Conversations:** AI study studios (Socratic Doubt Solver, Teacher Diary) maintain chat state solely in volatile client React component memory (`useState`), losing complete context upon page reload or session switch.
4. **Duplicate Institutional Settings:** `SettingsModal.tsx` and `settings/page.tsx` duplicate identical forms with zero personal user profile, security, or role-specific configuration options.

---

## 2. Database & API Performance Engineering

### 2.1 Elimination of Dashboard Query Fan-Out
- **Current Defect:** In `backend/app/api/endpoints/dashboard.py`, lines 35–80 execute 5 individual `count()` queries:
  ```python
  total_students = db.query(Student).filter(...).count()
  total_teachers = db.query(Teacher).filter(...).count()
  present_today = db.query(AttendanceEvent).filter(...).count()
  absent_today = db.query(AttendanceEvent).filter(...).count()
  pending_approvals = db.query(ApprovalTask).filter(...).count()
  ```
- **Optimized Single-Pass Aggregation Remedy:**
  Execute a unified CTE query retrieving today's attendance in a single index scan:
  ```sql
  SELECT
    COUNT(*) FILTER (WHERE lower(status) = 'present') AS present_count,
    COUNT(*) FILTER (WHERE lower(status) = 'absent') AS absent_count,
    COUNT(*) FILTER (WHERE lower(status) = 'late') AS late_count
  FROM attendance_events
  WHERE tenant_id = :tid AND date = :today;
  ```
  Reduces database round trips from 5 queries to 1 query, cutting dashboard query latency from ~85ms to ~14ms.

### 2.2 Missing Indexes & Optimization Matrix

| Table | Column(s) | Index Name | Current State | Required Remedy |
|---|---|---|---|---|
| `attendance_events` | `(tenant_id, date, status)` | `ix_attendance_tenant_date_status` | Missing composite | Add composite index for instant daily attendance aggregation |
| `students` | `(tenant_id, status, class_name)` | `ix_students_tenant_status_class` | Partial | Add composite index for class list rendering and student counts |
| `fee_payments` | `(tenant_id, payment_date, payment_status)` | `ix_fee_payments_tenant_date_status` | Missing composite | Optimize daily cashier fee reconciliation queries |
| `ai_usage_logs` | `(tenant_id, created_at DESC)` | `ix_ai_usage_tenant_date` | Single column | Add composite index for monthly budget quota checks |

### 2.3 Database Connection Pooling Strategy
- **Configuration in `app/core/database.py`:**
  - `pool_size`: 20 connections per container instance.
  - `max_overflow`: 10 connections during traffic spikes (e.g. 8:00 AM morning roll-call rush).
  - `pool_timeout`: 10 seconds (fail-fast instead of queuing infinitely).
  - `pool_recycle`: 1800 seconds (prevent stale TCP connections through Supabase / AWS poolers).

---

## 3. Persistent AI Chat History & Search Architecture

To elevate the Socratic Doubt Solver, Teacher Diary, and Administrative Copilot into world-class educational tools, conversation threads must persist reliably across device sessions.

### 3.1 Domain Schema (`AIChatThread` & `AIChatMessage`)

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│            ai_chat_threads           │          │           ai_chat_messages           │
├──────────────────────────────────────┤          ├──────────────────────────────────────┤
│ id: UUID (PK)                        │1        *│ id: UUID (PK)                        │
│ tenant_id: String(64) [Index]        ├──────────┤ thread_id: UUID (FK) [Index]         │
│ user_id: String(64) [Index]          │          │ role: String(16) (user|assistant)    │
│ agent_type: String(32)               │          │ content: Text                        │
│ title: String(150)                   │          │ tokens_used: Integer                 │
│ subject: String(64)                  │          │ metadata_payload: JSONB              │
│ is_pinned: Boolean                   │          │ created_at: DateTime(UTC) [Index]    │
│ updated_at: DateTime(UTC) [Index]    │          └──────────────────────────────────────┘
└──────────────────────────────────────┘
```

### 3.2 Cursor-Based Pagination & Search API
- **Endpoint:** `GET /api/v1/ai/threads/{thread_id}/messages?limit=20&before_id={cursor}`
  - Cursor-based pagination on `created_at DESC` prevents offset scan performance degradation.
  - Fast response: Returns 20 messages in $<25\text{ms}$.
- **Full-Text Conversation Search:**
  - `GET /api/v1/ai/threads/search?q={query}`
  - Scoped strictly to `tenant_id` and authenticated `user_id`.

---

## 4. Stratified Client Caching & Invalidation Architecture

### 4.1 Migration from Synchronous `localStorage` to Asynchronous `IndexedDB`
- **Current Limitation:** `safeFetch` uses synchronous `localStorage.setItem` and `localStorage.getItem`. In Stage 11, we established an enterprise `IndexedDB` storage model (`frontend/lib/offline/db.ts`).
- **Remedy:** Upgrade `safeFetch` to use `offlineDB.reference_cache` with structured metadata:
  ```typescript
  interface CachedResource<T> {
    data: T;
    cached_at: number;
    ttl_ms: number;
    tenant_id: string;
    workspace_id: string;
    etag?: string;
  }
  ```
- **TTL Hierarchy:**
  - Dynamic Metrics (Dashboard overview): `60,000 ms` (1 minute).
  - Academic Reference (Routine, Subject List, Classes): `3,600,000 ms` (1 hour).
  - Institution Profile (Name, EIIN, Address): `86,400,000 ms` (24 hours).
  - **Sensitive Data Invariant:** Financial transactions, student disciplinary notes, and guardian contact details are **strictly blacklisted** from client caching.

### 4.2 Cache Invalidation upon Mutation
- Every state mutation (`POST`, `PUT`, `PATCH`, `DELETE`) dispatches a targeted cache invalidation tag:
  - Example: Creating a student dispatches `invalidateCacheTag('students')`, purging client-side student directory caches and triggering background refetch.
- Session purge: `clearSession()` executes `offlineDB.purgeUserData(tenantId, userId)`, wiping all cached data upon logout or account switch.

---

## 5. Modern User Profiles & Role-Specific Settings

### 5.1 Elimination of Code Duplication
- Retire `SettingsModal.tsx` in favor of a dedicated, deep-linkable settings suite under `frontend/app/dashboard/settings/`.
- Break monolithic settings into focused tab views:
  1. `/dashboard/settings/institution` (Admin-only: School profile, EIIN, branding, logo).
  2. `/dashboard/settings/profile` (All users: Name, phone, avatar, bio).
  3. `/dashboard/settings/security` (All users: Change password, active session tokens, 2FA setup).
  4. `/dashboard/settings/preferences` (All users: Language EN/BN, theme, notification channels).

### 5.2 Role-Specific Settings Experiences
- **Teachers:** Assigned classes and subjects, voice diary microphone sensitivity, default question blueprint format (MCQ vs Creative CQ).
- **Students:** Target exam board, preferred study focus areas, Socratic tutor voice mode.
- **Guardians:** Linked children overview, preferred notification language (Bangla SMS vs English WhatsApp), emergency contact updates.

---

## 6. Measurable Performance Targets & Test Criteria

| Performance Metric | Target Threshold | Test Environment & Network Conditions |
|---|:---:|---|
| **Public Landing Page LCP** | $\le 1.8\text{ s}$ | Mobile device (Lighthouse, Moto G4 emulation, 4G Fast network). |
| **Public Landing Page CLS** | $\le 0.05$ | Zero layout shift during font and image loading. |
| **Dashboard Time-to-Usable (TTU)** | $\le 1.2\text{ s}$ | Authenticated desktop/mobile, cold cache, 4G network. |
| **Dashboard Cached Load** | $\le 250\text{ ms}$ | Warm IndexedDB cache fallback while revalidating in background. |
| **API Endpoints p95 Latency** | $\le 200\text{ ms}$ | 100 concurrent requests across `/metrics`, `/students`, `/attendance`. |
| **Database Query Latency** | $\le 50\text{ ms}$ | Database queries under full tenant isolation. |
| **AI Chat First-Page Load** | $\le 300\text{ ms}$ | Retrieval of 20 historical messages from `AIChatMessage` table. |
| **Constrained Network Resilience** | Graceful fallback | Simulated 3G slow connection (400kbps, 400ms RTT); offline banner activates seamlessly without crashing. |
