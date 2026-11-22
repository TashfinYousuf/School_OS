# EducationOS — Final Gap & Regression Matrix
**Document ID:** `docs/FINAL_GAP_AND_REGRESSION_MATRIX.md`  
**Generated:** 2026-11-11  
**Author:** Principal Software Architect, Security Engineer, and Release Auditor  
**Scope:** Pre-Stage 1 Forensic Defect & Architectural Gap Inventory  

---

## 1. Overview & Forensic Method

This matrix provides a granular, evidence-based breakdown of architectural gaps, discrepancies, and required modifications across the EducationOS platform. Each entry details the verified current behavior, root cause, security or business impact, proposed remediation, and required automated regression tests.

---

## 2. Granular Gap & Defect Register

### GAP-01: Logout Flow Redirects to `/login` Instead of Public Homepage `/`
- **Current Behavior:** Clicking Logout in `frontend/app/dashboard/layout.tsx` or `frontend/app/dashboard/profile/page.tsx` clears `localStorage` tokens and executes `router.push("/login")`.
- **Expected Behavior:** Per Stage 1 directive, Logout must call the backend token revocation endpoint, purge client session/auth caches, and redirect the user directly to `/` (the public EducationOS marketing homepage). The public homepage must render normally without requiring authentication.
- **Root Cause:** Legacy UX pattern assumed all users logging out immediately want to log back in.
- **Affected Modules / Files:**
  - `frontend/app/dashboard/layout.tsx`
  - `frontend/app/dashboard/profile/page.tsx`
  - `frontend/lib/api-client.ts` (`clearSession`)
  - `backend/app/api/endpoints/auth.py` (`POST /api/v1/auth/logout`)
- **Security / Business Impact:** Inconveniences school principals/staff; creates a closed intranet feel rather than presenting the public SaaS front door.
- **Proposed Change:** Update `handleLogout` across all frontend components to call `POST /api/v1/auth/logout` with the active refresh token, clear session keys, and invoke `window.location.href = "/"`.
- **Regression Tests:** Automated frontend route test in `frontend/tests/` asserting logout redirection destination is `/`.
- **Evidence Required:** Browser test verifying unauthenticated arrival at `/` after clicking logout.

---

### GAP-02: Hardcoded Fixed Package Dependency in Pricing & Onboarding
- **Current Behavior:** Pricing and onboarding rely on fixed plans (`free_starter`, `school_standard`, `school_growth`, `academy_pro`) defined in `frontend/lib/plans.ts` and `APPROVED_PLANS`. Onboarding dropdown forces users to choose a fixed package.
- **Expected Behavior:** Per Stage 2 directive, fixed tier dependencies must be replaced by a dynamic, module-based pricing engine where institutions select their exact student volume and required modules (Core vs Paid Add-ons) with transparent, real-time BDT calculation.
- **Root Cause:** Early SaaS architecture mirrored traditional B2C tiered packages rather than dynamic institutional capacity pricing.
- **Affected Modules / Files:**
  - `frontend/lib/plans.ts`
  - `frontend/app/pricing/page.tsx`
  - `frontend/app/onboard/page.tsx`
  - `backend/app/api/endpoints/billing.py`
  - `backend/app/models/subscription.py`
- **Security / Business Impact:** Commercial mismatch; schools with 120 or 450 students are forced into ill-fitting fixed tiers; discourages institutional adoption.
- **Proposed Change:** Author dynamic pricing engine in backend (`backend/app/services/pricing_engine.py`) and replace fixed cards in frontend with an interactive multi-step capacity calculator.
- **Regression Tests:** Unit tests in backend calculating quote for 50, 150, 350, 750, 1500 students with varying module combinations.
- **Evidence Required:** Exact match between frontend calculator output and backend-generated invoice quotes.

---

### GAP-03: Client Token Storage via `localStorage` vs Secure Cookie Migration
- **Current Behavior:** Authentication tokens (`access_token`, `refresh_token`) are stored in browser `localStorage`.
- **Expected Behavior:** Sensitive tokens should ideally reside in HttpOnly, Secure, SameSite cookies to mitigate XSS exfiltration risks, while maintaining backward compatibility with the existing mobile/PWA offline queue.
- **Root Cause:** Initial client architecture favored fast header injection in `fetchWithTenant` via `localStorage.getItem("token")`.
- **Affected Modules / Files:**
  - `frontend/lib/api-client.ts`
  - `backend/app/api/endpoints/auth.py`
  - `frontend/app/login/page.tsx`
- **Security / Business Impact:** Potential token theft in the event of an arbitrary script execution vulnerability (mitigated by strict CSP and input sanitization).
- **Proposed Change:** Implement dual-support session handling: backend issues HttpOnly refresh cookie while continuing to provide bearer access token for API requests and offline queue authentication.
- **Regression Tests:** Integration test verifying refresh token rotation and cookie security flags.
- **Evidence Required:** Network inspection verifying `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Lax`.

---

### GAP-04: Automated Payment Provider Mock vs Low-Cost Manual Mode A
- **Current Behavior:** `backend/app/services/payment_providers.py` simulates automated bKash/Nagad checkout callbacks without actual verified merchant credentials.
- **Expected Behavior:** Per Stage 4 directive, introduce **Mode A (Low-cost manual reconciliation)**: School admin submits payment reference (TrxID/deposit slip) -> Status becomes `PENDING_REVIEW` -> Authorized admin verifies against merchant statement -> Activates subscription. Mode B (Automated gateway) is preserved as an optional integration path when official credentials are provisioned.
- **Root Cause:** Assumption that third-party merchant APIs would be immediately available during pilot.
- **Affected Modules / Files:**
  - `backend/app/api/endpoints/billing.py`
  - `backend/app/services/payment_providers.py`
  - `frontend/app/dashboard/settings/page.tsx` (Billing tab)
- **Security / Business Impact:** Prevents illegitimate activation of paid services without actual money in the school's or platform's bank account.
- **Proposed Change:** Add `payment_mode` (`manual_review` vs `gateway`) and `verification_status` in `subscription_invoices` with an admin reconciliation API.
- **Regression Tests:** Test case simulating manual TrxID submission, admin approval, and subsequent subscription activation.
- **Evidence Required:** Persisted audit record capturing admin user ID and timestamp upon manual payment approval.

---

### GAP-05: Unauthenticated Marketing Route Protection vs Dashboard Protection
- **Current Behavior:** Some public routes and navigation bars lack unified language/theme synchronization, and visiting `/login` while already authenticated does not consistently redirect to the user's role-specific dashboard.
- **Expected Behavior:** Unauthenticated visitors can browse all marketing routes freely without redirects. Authenticated users visiting `/login` are automatically routed to their active dashboard (`/dashboard` for staff, `/dashboard/student` for students, `/dashboard/guardian` for guardians).
- **Root Cause:** Role-aware route guard was primarily focused on protecting `/dashboard` rather than redirecting away from `/login`.
- **Affected Modules / Files:**
  - `frontend/app/login/page.tsx`
  - `frontend/components/RoleRouteGuard.tsx`
- **Security / Business Impact:** Minor UX friction for logged-in staff returning to the login screen.
- **Proposed Change:** Add active session check in `UnifiedAuthForm` to auto-redirect to the appropriate workspace dashboard.
- **Regression Tests:** Frontend test verifying redirection from `/login` to `/dashboard` when valid tokens exist in storage.
- **Evidence Required:** Browser test evidence of instant redirect for authenticated sessions.

---

### GAP-06: Schema Drift Check Network Dependency in Local Sandbox
- **Current Behavior:** `backend/scripts/check.sh` step 4 runs `python scripts/schema_drift.py`, which connects to `aws-1-ap-south-1.pooler.supabase.com`. In sandboxed environments without internet access, this causes a socket error unless `SKIP_DB=1` is provided.
- **Expected Behavior:** The local schema drift check should be able to run against a local disposable PostgreSQL database or operate in offline mode when remote database connectivity is absent.
- **Root Cause:** `schema_drift.py` directly bound to `engine` using remote Supabase credentials.
- **Affected Modules / Files:**
  - `backend/scripts/check.sh`
  - `backend/scripts/schema_drift.py`
- **Security / Business Impact:** Blocks automated gate scripts when executed inside isolated CI/CD or sandbox runners.
- **Proposed Change:** Support `DATABASE_URL` override in `schema_drift.py` and document `SKIP_DB=1` usage when external network is restricted.
- **Regression Tests:** `SKIP_DB=1 bash backend/scripts/check.sh` exits 0.
- **Evidence Required:** Terminal output confirming `ALL OK`.

