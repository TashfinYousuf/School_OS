# EducationOS Frontend Route & Surface Inventory

**Audit Date:** 2026-11-01  
**Auditor:** Principal Software Architect  
**Scope:** `frontend/app/`, `frontend/components/`, `frontend/lib/`, `frontend/public/`  
**Application Target:** Release Candidate 1 (RC1)

---

## 1. Executive Summary & Architecture Overview

The EducationOS frontend is structured as a **Next.js 14 App Router** application with Tailwind CSS, Lucide icons, and Radix UI components. The user interface exposes a public landing page (`/`), an authentication page (`/login`), and an authenticated shell containing 18 sub-routes rooted at `/dashboard`.

### Critical Architectural Defects Discovered:
1. **Divergent Authentication Token Storage:**
   - `frontend/app/login/page.tsx` persists tokens as:
     ```typescript
     localStorage.setItem('token', data.access_token);
     localStorage.setItem('user', JSON.stringify(data.user));
     ```
   - `frontend/lib/api-client.ts` expects:
     ```typescript
     const token = localStorage.getItem('access_token');
     ```
   - **Result:** Any component or hook that relies on `api-client.ts` retrieves `null` for the Bearer token, causing unauthenticated API rejections (`401 Unauthorized`) across the entire dashboard.
2. **Duplicate and Inconsistent API Client Libraries:**
   - `frontend/lib/api-client.ts`: Custom `fetch` wrapper attempting to attach `Authorization: Bearer <token>` and `X-Tenant-ID`.
   - `frontend/lib/apiClient.ts`: Exports a lightweight helper `safeFetch` that does **not** attach authorization headers, does **not** attach `X-Tenant-ID`, and defaults headers to an empty object.
   - Raw `fetch()` calls: 14 out of 18 dashboard route pages bypass both client libraries entirely and execute raw `fetch()` calls against hardcoded `http://127.0.0.1:8000/api/v1/...` strings with manually crafted headers.
3. **Hardcoded Localhost Fallback Endpoints:**
   - Multiple routes define fallback URLs as `process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1'`. When deployed in containerized or staging environments where `NEXT_PUBLIC_API_URL` is omitted or misconfigured during client-side build time, browser requests route directly to the client's local machine loopback, causing connection failures.
4. **Desynchronized Role-Based Access Control (RBAC) Whitelists:**
   - Two conflicting source-of-truth guards exist: `frontend/app/dashboard/layout.tsx` (navigation sidebar links) and `frontend/components/RoleRouteGuard.tsx` (page rendering boundary).
   - `RoleRouteGuard.tsx` denies teachers access to `/dashboard/academic` and `/dashboard/guardians`, despite the sidebar displaying them.
   - `RoleRouteGuard.tsx` denies students access to `/dashboard/academic` ("My Class Routine") and `/dashboard/doubt-solver`.
   - `RoleRouteGuard.tsx` denies guardians access to `/dashboard/communication` (layout links to `/dashboard/communication`, but guard checks `/dashboard/helpdesk`).
5. **No-Op Workspace Context and Broken Academy Wizard:**
   - `frontend/lib/workspaceContext.tsx` defines `switchWorkspace: () => {}` as an empty stub. Multi-tenant switching does not update state.
   - `frontend/components/AcademySetupWizard.tsx` calls `enableAcademyModule()`, a method not declared on `WorkspaceContextType`, throwing an unhandled runtime error when executed.
6. **Presence of Hardcoded Fake Data and Mock UI Fallbacks:**
   - `/dashboard/results` falls back to a hardcoded report card for "Talha Hussain" (GPA 5.0) on API failure.
   - `/dashboard/page.tsx` displays static hardcoded metrics for student and guardian roles.
   - `VoiceLessonModal.tsx` simulates speech transcription via `setTimeout` rather than Web Speech API or microphone capture.

---

## 2. Route Inventory & Verification Table

### Status Key:
- **VERIFIED COMPLETE**: Feature implementation complete, backed by live functional backend endpoints and verified data contracts.
- **PARTIALLY IMPLEMENTED**: Basic layout or partial API interaction exists, but critical actions, edge cases, error states, or sub-features are missing.
- **IMPLEMENTED BUT UNVERIFIED**: Code is fully written against API specs, but lacks automated tests or depends on unverified integration points.
- **NOT IMPLEMENTED**: Route exists as a placeholder, empty shell, or static mockup with no backend connectivity.
- **BROKEN**: Route throws runtime crashes, fails authentication, calls nonexistent endpoints, or experiences permanent redirect/404 loops.

| Route Path | Page Component Path | Target Roles | Layout & Guards | Primary API Dependencies | Verification Status | Core Findings & Failure Modes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | `frontend/app/page.tsx` | Public | Root Layout (`app/layout.tsx`) | None (Static Landing Page) | **VERIFIED COMPLETE** | Public marketing page renders correctly. Feature showcase, pricing anchors, and login CTA navigate properly. |
| `/login` | `frontend/app/login/page.tsx` | Public | Root Layout | `POST /api/v1/auth/login` | **PARTIALLY IMPLEMENTED** | Form submits and parses JWT, but stores token under key `'token'` while `api-client.ts` expects `'access_token'`. Missing password reset flow and MFA handling. |
| `/dashboard` | `frontend/app/dashboard/page.tsx` | All Authenticated | Dashboard Layout (`app/dashboard/layout.tsx`) | `GET /api/v1/dashboard/stats`, `GET /api/v1/dashboard/institution-pulse` | **PARTIALLY IMPLEMENTED** | Admin view fetches real aggregate stats. Teacher, Student, and Guardian views display hardcoded mock metrics. Attendance trend chart uses synthetic data. |
| `/dashboard/attendance` | `frontend/app/dashboard/attendance/page.tsx` | Admin, Teacher | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/attendance/today`, `POST /api/v1/attendance/bulk`, `POST /api/v1/attendance/records` | **PARTIALLY IMPLEMENTED** | Raw `fetch` to `127.0.0.1:8000`. Offline queue integration (`offlineQueue.ts`) exists for bulk marking, but camera barcode scanner is unintegrated. |
| `/dashboard/students` | `frontend/app/dashboard/students/page.tsx` | Admin, Teacher | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/students`, `POST /api/v1/students`, `GET /api/v1/students/{id}/profile-360` | **PARTIALLY IMPLEMENTED** | Student registration form works. Profile 360 drawer displays data but exposes IDOR vulnerability. Student status change actions lack CSRF protection. |
| `/dashboard/finance` | `frontend/app/dashboard/finance/page.tsx` | Superadmin, School Admin, Accountant | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/finance/overview`, `POST /api/v1/finance/collect`, `GET /api/v1/finance/transactions` | **PARTIALLY IMPLEMENTED** | Fee collection drawer submits payment. Print receipt feature triggers native `window.print()`. Gateway integration button initiates mock checkout without real webhook verification. |
| `/dashboard/academic` | `frontend/app/dashboard/academic/page.tsx` | Admin, Teacher, Student | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/academic/classes`, `GET /api/v1/academic/routines`, `POST /api/v1/academic/routines` | **BROKEN** | `RoleRouteGuard.tsx` strictly permits only `superadmin` and `school_admin`, blocking Teachers and Students from viewing their routines despite navigation links existing in `layout.tsx`. |
| `/dashboard/exams` | `frontend/app/dashboard/exams/page.tsx` | Admin, Teacher | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/exams`, `POST /api/v1/exams`, `POST /api/v1/question-papers/generate` | **PARTIALLY IMPLEMENTED** | Exam creation works. AI paper generator calls backend, but created exams default to `is_published=False` with no UI mechanism to approve or publish them. |
| `/dashboard/results` | `frontend/app/dashboard/results/page.tsx` | Admin, Teacher, Student, Guardian | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/results/exam/{id}`, `GET /api/v1/results/progress-card/{id}`, `POST /api/v1/results/marks` | **BROKEN** | Guardian/Student view requests `/api/v1/results/progress-card/my-child`, fails with HTTP 422, and falls back to a hardcoded fake report card for "Talha Hussain" (GPA 5.0). |
| `/dashboard/live-exams` | `frontend/app/dashboard/live-exams/page.tsx` | Student, Admin, Teacher | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/academy/exams`, `POST /api/v1/academy/exams/{id}/submit` | **BROKEN** | Fetches only `is_published=True` exams. Because `/dashboard/exams` cannot publish AI-generated exams, student exam list is permanently empty. Timer submission lacks server clock sync. |
| `/dashboard/batches` | `frontend/app/dashboard/batches/page.tsx` | Admin, Teacher | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/academy/batches`, `POST /api/v1/academy/batches` | **IMPLEMENTED BUT UNVERIFIED** | Batch creation, seat limits, and student enrollment modals exist. Calls `academy.py` endpoints correctly, but lacks automated frontend test coverage. |
| `/dashboard/doubt-solver` | `frontend/app/dashboard/doubt-solver/page.tsx` | Student, Teacher | `RoleRouteGuard`, `DashboardLayout` | `POST /api/v1/ai-tutor/chat`, `POST /api/v1/learning-studio/generate` | **BROKEN** | `RoleRouteGuard.tsx` excludes `student` role from accessing `/dashboard/doubt-solver`. Calls backend `/ai-tutor/chat`, but `ai_tutor.py` router is NOT mounted in `backend/app/main.py` (returns 404). |
| `/dashboard/notices` | `frontend/app/dashboard/notices/page.tsx` | All Authenticated | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/notices`, `POST /api/v1/notices` | **PARTIALLY IMPLEMENTED** | Notice board renders broadcast notices. Creating emergency SMS notice triggers backend, but backend SMS delivery returns a mock response without real gateway delivery. |
| `/dashboard/approvals` | `frontend/app/dashboard/approvals/page.tsx` | Admin, Headmaster, Accountant | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/approvals/pending`, `POST /api/v1/approvals/{id}/action` | **BROKEN** | Frontend queries `/api/v1/approvals/pending`. Backend router has duplicate prefix `/approvals/approvals/` and expects status `"pending_review"`, whereas backend creates `"Pending"`. Always returns 404. |
| `/dashboard/communication` | `frontend/app/dashboard/communication/page.tsx` | Admin, Teacher, Guardian | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/communication/threads`, `POST /api/v1/communication/messages` | **BROKEN** | `RoleRouteGuard.tsx` specifies `/dashboard/helpdesk` for guardians instead of `/dashboard/communication`. Backend falls back to hardcoded tenant UUID if context header is omitted. |
| `/dashboard/teachers` | `frontend/app/dashboard/teachers/page.tsx` | Admin | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/institution/teachers`, `POST /api/v1/institution/teachers` | **PARTIALLY IMPLEMENTED** | Teacher list and invite modals function. Teacher subject assignment and diary review rely on partially completed endpoints. |
| `/dashboard/guardians` | `frontend/app/dashboard/guardians/page.tsx` | Admin | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/students/guardians`, `POST /api/v1/students/guardians/link` | **BROKEN** | In `RoleRouteGuard.tsx`, only `superadmin` and `school_admin` have access. Linking form fails when child student ID is UUID format due to regex validation mismatch. |
| `/dashboard/ipemis` | `frontend/app/dashboard/ipemis/page.tsx` | Superadmin, School Admin | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/government/ipemis/export`, `POST /api/v1/government/ipemis/validate` | **PARTIALLY IMPLEMENTED** | Generates Bangladesh IPEMIS CSV export file. Data validation checks for required fields (NID, birth certificate), but error feedback UI is rudimentary. |
| `/dashboard/settings` | `frontend/app/dashboard/settings/page.tsx` | Superadmin, School Admin | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/tenants/current`, `PUT /api/v1/tenants/current` | **BROKEN** | Calls `PUT /api/v1/tenants/current`. Backend `tenants.py` has no `/current` route (only `/` and `/{id}`). Causes 404 Method Not Allowed or 404 Not Found. |
| `/dashboard/pricing` | `frontend/app/dashboard/pricing/page.tsx` | Superadmin, School Admin | `RoleRouteGuard`, `DashboardLayout` | `GET /api/v1/billing/plans`, `POST /api/v1/billing/checkout` | **PARTIALLY IMPLEMENTED** | Displays tiered SaaS pricing cards (Basic, Standard, Pro, Enterprise). Initiates checkout session, but payment gateway webhook reconciliation is unverified. |

---

## 3. Deep-Dive Surface Audits

### 3.1 Authentication & Token Lifecycle (`frontend/app/login/page.tsx`, `frontend/lib/api-client.ts`)
- **Token Key Desynchronization:**
  - `login/page.tsx` line 48: `localStorage.setItem('token', data.access_token);`
  - `api-client.ts` line 12: `const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;`
  - `apiClient.ts` line 8: Does not inspect `localStorage` at all.
  - **Impact:** Any component invoking `api-client.ts` generates HTTP headers with `Authorization: Bearer null`. Requests fail immediately with `401 Unauthorized` unless the page explicitly executes a custom raw `fetch` reading `localStorage.getItem('token')`.

### 3.2 Role-Based Access Control Divergence
The sidebar navigation links configured in `frontend/app/dashboard/layout.tsx` diverge severely from the route authorization rules in `frontend/components/RoleRouteGuard.tsx`:

```typescript
// frontend/components/RoleRouteGuard.tsx (Lines 14-25)
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/dashboard/students': ['superadmin', 'school_admin', 'teacher'],
  '/dashboard/attendance': ['superadmin', 'school_admin', 'teacher'],
  '/dashboard/academic': ['superadmin', 'school_admin'], // BLOCKS TEACHERS & STUDENTS!
  '/dashboard/exams': ['superadmin', 'school_admin', 'teacher'],
  '/dashboard/results': ['superadmin', 'school_admin', 'teacher', 'student', 'guardian'],
  '/dashboard/finance': ['superadmin', 'school_admin'],
  '/dashboard/teachers': ['superadmin', 'school_admin'],
  '/dashboard/guardians': ['superadmin', 'school_admin'], // BLOCKS TEACHERS!
  '/dashboard/ipemis': ['superadmin', 'school_admin'],
  '/dashboard/settings': ['superadmin', 'school_admin'],
  '/dashboard/batches': ['superadmin', 'school_admin', 'teacher'],
  '/dashboard/live-exams': ['superadmin', 'school_admin', 'student'],
  '/dashboard/doubt-solver': ['superadmin', 'school_admin', 'teacher'], // BLOCKS STUDENTS!
  '/dashboard/communication': ['superadmin', 'school_admin', 'teacher'], // BLOCKS GUARDIANS!
};
```

#### Collision Manifest:
1. **Academic Class Routine:** `layout.tsx` gives teachers and students access to "Class Routine" under `/dashboard/academic`. `RoleRouteGuard` redirects them to `/dashboard` with an "Access Denied" toast.
2. **AI Doubt Solver:** `layout.tsx` gives students access to `/dashboard/doubt-solver`. `RoleRouteGuard` explicitly excludes `student`, rendering the AI learning assistant inaccessible to the primary end-user!
3. **Guardian Communication:** `layout.tsx` links guardians to `/dashboard/communication`. `RoleRouteGuard` restricts this route to `['superadmin', 'school_admin', 'teacher']`, locking guardians out of the messaging system.

### 3.3 Dashboard Hub & Role Views (`frontend/app/dashboard/page.tsx`)
- **Admin View:** Consumes `GET /api/v1/dashboard/stats`. Correctly renders active student count, attendance rate, and pending fee aggregates.
- **Teacher View:** Hardcodes class attendance percentage (88.4%) and upcoming periods in local component state.
- **Student View:** Renders hardcoded grades (Math: A+, Physics: A, English: A-) and hardcoded attendance metrics (94.2%).
- **Guardian View:** Renders static mock attendance history and financial ledger balances for a simulated child.
- **Pulse Chart:** Renders simulated synthetic data arrays when the historical attendance series endpoint fails to return data.

### 3.4 Examination & Results Pipeline (`/dashboard/exams`, `/dashboard/results`, `/dashboard/live-exams`)
- **Disappearing Question Papers:**
  - `/dashboard/exams` invokes `POST /api/v1/question-papers/generate`.
  - The backend creates the exam record with `is_published=False` and status `"draft"`.
  - The UI has no "Publish" action button; the record remains in draft state permanently.
  - `/dashboard/live-exams` queries `GET /api/v1/academy/exams`, which strictly filters by `is_published == True`.
  - **Result:** Teachers generate question papers successfully, but they never appear in the live exams portal for students.
- **Hardcoded Report Card Mockup:**
  - `frontend/app/dashboard/results/page.tsx` line 142 contains:
    ```typescript
    // Fallback mock report card for demo
    const FALLBACK_CARD = {
      student_name: "Talha Hussain",
      roll: "101",
      gpa: "5.00",
      grade: "A+",
      subjects: [ ... ]
    };
    ```
  - When a guardian visits `/dashboard/results`, the page calls `/api/v1/results/progress-card/my-child`, fails with HTTP 422 (because `my-child` is an invalid UUID parameter), catches the exception, and renders Talha Hussain's report card.

### 3.5 AI Features & Modals (`VoiceLessonModal.tsx`, `AIBudgetWarningModal.tsx`)
- `frontend/components/VoiceLessonModal.tsx`:
  - Contains a simulated voice recording experience. Clicking "Start Recording" starts a CSS pulse animation and triggers a `setTimeout(() => setTranscript("Simulated voice input..."), 3000)`.
  - No Web Audio API, MediaStream Recording API, or speech recognition interface is initialized.
- `frontend/components/AIBudgetWarningModal.tsx`:
  - Accurately renders token quota warnings when receiving a 402 or 429 response from AI endpoints, directing administrators to `/dashboard/pricing`.

### 3.6 PWA & Offline Service Worker Integration (`public/sw.js`, `lib/offlineQueue.ts`)
- `public/sw.js`:
  - Declares two separate and conflicting `addEventListener('fetch', ...)` event handlers in the same file.
  - The first handler intercepts requests and returns cached responses. The second handler attempts a network-first strategy with no deduplication.
  - Pre-caches `/icons/icon-192.png` and `/icons/icon-512.png`. However, the directory `frontend/public/icons/` does **not exist** in the repository. Service worker installation fails in production due to a 404 cache error.
- `lib/offlineQueue.ts`:
  - Implements an IndexedDB queue for offline attendance marking. Correctly enqueues records when `navigator.onLine === false`. However, replay execution does not refresh or check for expired JWT tokens, resulting in silent submission failures if the user reconnects after token expiry.

---

## 4. Frontend Remediation Roadmap & Architectural Recommendations

1. **Standardize Authentication Storage:**
   - Modify `app/login/page.tsx` and all auth routines to store tokens under a single canonical key: `access_token` and `refresh_token`.
   - Update `lib/api-client.ts` to attach valid credentials and handle automatic token refresh on 401 responses.
2. **Eliminate Raw `fetch()` and Centralize API Calls:**
   - Refactor all 18 dashboard subpages to consume a unified typed API client (`lib/api-client.ts`) that automatically injects `Authorization: Bearer <token>` and `X-Tenant-ID: <tenantId>`.
   - Remove all hardcoded `http://127.0.0.1:8000` URLs and enforce `process.env.NEXT_PUBLIC_API_URL`.
3. **Synchronize Role Route Guards with Navigation:**
   - Align `RoleRouteGuard.tsx` with `layout.tsx` so teachers can view academic routines and guardian directories, students can access the AI Doubt Solver and class routines, and guardians can access communication channels.
4. **Purge Fake Data & UI Stubs:**
   - Remove the fallback report card ("Talha Hussain") in `/dashboard/results` and replace with proper loading/empty/error state banners.
   - Implement real student and guardian summary endpoints in `backend/app/api/endpoints/dashboard.py` to replace static mock metrics on `/dashboard/page.tsx`.
5. **Repair PWA Assets & Service Worker:**
   - Create missing icon assets in `frontend/public/icons/icon-192.png` and `frontend/public/icons/icon-512.png`.
   - Consolidate conflicting `fetch` event listeners in `public/sw.js` into a single, coherent network-first caching strategy.

