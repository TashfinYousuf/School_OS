# EducationOS — Final Master Regression Inventory
**Document ID:** `docs/FINAL_REGRESSION_INVENTORY.md`  
**Generated:** 2026-11-09  
**Execution Mode:** Sequential, evidence-driven, security-first engineering  
**Governing Standard:** Section B of Final Master Engineering Directive  

---

## 1. Forensic Defect Baseline Matrix

| Feature / Subsystem | Previously Reported Status | Actual Verified Status | Reproduction Evidence & Impact | Root Cause Identification | Priority |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Institutional Onboarding** | Reported complete (`/onboard`) | **DEFECTIVE / INCOMPLETE** | In `frontend/app/onboard/page.tsx`, `handleSubmit` merely executes `setSubmitted(true)`. No API is called, no tenant is provisioned, no password is requested. The user is redirected to `/login`. | Form has no backend mutation; acts as an unpersisted brochureware mockup that forces users into a secondary onboarding loop. | **P0** |
| **Login / Signup Consistency** | Reported complete (`/login`) | **DEFECTIVE / DUPLICATE** | On `/login`, a competing 4th tab (`register: "New School"`) prompts for duplicate institution details and calls `/api/v1/auth/register-school`. Users completing `/onboard` arrive at `/login` only to be asked to register again. | Two conflicting onboarding paths with different schemas and disjoint customer lifecycles. | **P0** |
| **Student 360 Profile** | Reported complete | **DEFECTIVE / REGRESSED** | Clicking student row in `frontend/app/dashboard/students/page.tsx` calls `handleOpen360()`. Frontend renders without user feedback while loading (`loading360` declared but unused). In JSX line 581, accesses `profile360.academics.grades.length` while backend returns `profile360.academics.grades` with mismatched field names (`receipt_no` vs `receipt_number`). | Schema property divergence between backend JSON projection and frontend modal accessor; missing loading states and error toast. | **P0** |
| **Attendance Export** | Reported complete | **DEFECTIVE / 401 UNAUTH** | In `frontend/app/dashboard/attendance/page.tsx`, line 355 executes `window.open('/api/v1/attendance/export?...', '_blank')`. Browser opens an unauthenticated GET request omitting `Authorization: Bearer <token>` and `X-Tenant-ID`. Backend returns HTTP 401 Unauthorized. | Browser `window.open` navigation bypasses the authenticated `fetchWithTenant` client; failure to download stream via authenticated Blob. | **P0** |
| **Attendance Print** | Reported complete | **DEFECTIVE / 401 UNAUTH** | In `frontend/app/dashboard/attendance/page.tsx`, line 365 executes `window.open('/api/v1/attendance/export?format=html...', '_blank')`. Request fails with HTTP 401 Unauthorized because credentials are not attached by the raw browser tab. | Raw unauthenticated window navigation without bearer credentials; no dedicated inline print stylesheet triggers. | **P0** |
| **Profile Management** | Partially refined | **MISSING DEDICATED ROUTE** | No `/dashboard/profile` route exists. Top-right profile badge in `frontend/app/dashboard/layout.tsx` is static plain text with no link or dropdown to edit personal details, change passwords, or view active sessions. | User profile management was never given a first-class route; only institutional admin settings existed. | **P1** |
| **Settings Experience** | Partially refined | **INCOMPLETE / FRAGMENTED** | `SettingsModal.tsx` in sidebar competes with `/dashboard/settings`. Full settings page only handles basic school metadata and student CSV upload. Lacks personal security, MFA, notification preferences, billing overview, and session revocation. | Settings fragmented between a modal and an orphaned page without structured personal/security/institution sections. | **P1** |
| **Commercial Payment & Billing** | Architecture staged | **BLOCKED ON LIVE GATEWAYS** | `backend/app/services/payment_providers.py` has signature models, but live merchant gateway credentials and verified webhooks are inactive. Billing rules locked behind `docs/PRICING_APPROVAL_REQUIRED.md`. | Gateways cannot be activated without verified merchant agreements; live online payment intentionally deferred. | **P1** |
| **AI Billing & Quotas** | Architecture staged | **IMPLEMENTED (SQLITE TESTED)** | `backend/app/api/endpoints/ai.py` tracks token budgets per tenant, but lacks fine-grained FinOps export and automated usage tier degradation. | Quota enforcement verified in tests, but needs administrative cost transparency and alerting dashboard. | **P1** |
| **Database Production Gate** | Blocked | **BLOCKED (PRESERVED)** | Automated test suites execute against in-memory SQLite (`StaticPool`). Remote Supabase PostgreSQL instance (`aws-1-ap-south-1.pooler.supabase.com`) is unreachable in sandboxed environments. | Disposable PostgreSQL 17 test container unavailable locally; live schema changes remain frozen to prevent production corruption. | **P0** |

---

## 2. Root Cause Analysis Summary

1. **Broken Onboarding-to-Login Bridge:**
   The marketing site directed prospective principals to `/onboard`. The page captured institution details, but its `handleSubmit` was an inert React state setter (`setSubmitted(true)`) with no `fetch` call. It presented a mock "Trial Provisioned" card and redirected the principal to `/login`. On `/login`, the principal discovered their account did not exist, and saw a separate "New School" tab with a different registration form asking for password and invite code. This created an immediate, unacceptable onboarding drop-off.

2. **Unauthenticated Browser Navigation on Protected Endpoints:**
   Attendance export and print features were implemented on the backend (`GET /api/v1/attendance/export`) requiring `require_roles(["admin", "teacher", "superadmin"])` and `get_current_tenant_id`. The frontend erroneously used `window.open(url, "_blank")`. The browser treats this as a standard top-level navigation, sending zero HTTP `Authorization` headers. Consequently, all exports failed with HTTP 401 Unauthorized in production.

3. **Student 360 Frontend-Backend Schema Disconnect:**
   The backend endpoint `GET /api/v1/students/{student_id}/profile-360` returned a nested dictionary with `academics.grades` and `fees`. The frontend attempted to read properties with mismatched names (`receipt_no` instead of `receipt_number`) and rendered without loading spinners or error handling, making the UI appear completely frozen or broken when network latency occurred or exceptions were thrown.

4. **Absence of Personal Account Profile:**
   The dashboard layout assumed users only need institution-level settings. A teacher, student, or guardian had no dedicated screen to inspect their personal profile details, update their password, or manage login sessions.

