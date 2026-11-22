# EducationOS — Authentication, Session & Logout Acceptance
**Document ID:** `docs/AUTHENTICATION_AND_LOGOUT_ACCEPTANCE.md`  
**Generated:** 2026-11-11  
**Author:** Principal Security Engineer & Full-Stack Architect  
**Scope:** Stage 1 Authentication Lifecycle, Session Security, and Public Website Routing  

---

## 1. Executive Summary & Acceptance Statement

Stage 1 resolves the authentication lifecycle, ensures that the main website (`/`) is the default public destination for unauthenticated visitors, and establishes strict, verified logout behavior that invalidates server-side refresh sessions and redirects directly to `/` (never directly to `/login`).

All authentication security controls have been validated against active automated test suites and real browser workflows.

---

## 2. Verified Authentication & Logout Behavior

### 2.1 Public Website Default Routing
- **Unauthenticated Visitors:** Visiting `https://educationos.com/` (or `localhost:3000/`) renders the public marketing homepage without triggering an unexpected redirect to `/login`.
- **Public Marketing Surface:** Visitors can freely browse `/about`, `/mission`, `/features`, `/solutions`, `/solutions/schools`, `/solutions/colleges`, `/solutions/academies`, `/pricing`, `/security`, `/technology`, `/docs`, `/help`, `/contact`, `/support`, `/legal/terms`, `/legal/privacy`, `/legal/refund`, `/legal/cancellation`, and `/onboard`.
- **Canonical Route Aliases:** `frontend/next.config.ts` automatically routes `/platform` to `/features`, `/privacy` to `/legal/privacy`, `/terms` to `/legal/terms`, and `/documentation` to `/docs`.

### 2.2 Exact 7-Step Logout Workflow
When an authenticated user clicks Logout anywhere in the platform (e.g. sidebar navigation or user profile screen):

1. **User Action:** User clicks **Sign Out / Logout**.
2. **Server-Side Revocation:** Frontend invokes `performLogout()` in `frontend/lib/api-client.ts`, which sends an authenticated `POST /api/v1/auth/logout` with `Bearer <access_token>` and `{ refresh_token: <refresh_token> }`.
3. **Session Invalidation:** The backend extracts the JTI from both tokens, flags the `RefreshTokenSession` record as `revoked = True` in the PostgreSQL database, and records persistent revocation entries in `revoked_tokens`.
4. **Cookie & Header Cleanup:** The backend emits `Set-Cookie` deletion headers for `access_token` and `refresh_token`, along with `Cache-Control: no-store`.
5. **Client Cache Purge:** `clearSession()` removes all sensitive tokens, roles, tenant IDs, student IDs, and cached records (`institution:*`, `EducationOS_cache_*`) from `localStorage`, and triggers `offlineDB.purgeUserData(...)` to scrub tenant data from client IndexedDB.
6. **State Reset:** React authentication event `auth-changed` fires to immediately unmount protected dashboard contexts.
7. **Public Redirection:** The user is redirected to `/`, the public EducationOS homepage:
   ```typescript
   if (typeof window !== "undefined") {
     window.location.href = "/";
   }
   ```
   **In accordance with non-negotiable rules, Logout never redirects directly to `/login`.**

### 2.3 Safe Return Path & Open-Redirect Protection
- **Unauthenticated Protected Route Access:** If an unauthenticated user attempts to access `/dashboard/attendance` or any protected URL, `frontend/components/RoleRouteGuard.tsx` safely attaches the return path:
  ```typescript
  const returnPath = pathname && pathname !== "/" && pathname !== "/login"
    ? `?return_to=${encodeURIComponent(pathname)}`
    : "";
  router.replace(`/login${returnPath}`);
  ```
- **Open-Redirect Validation:** `frontend/app/login/page.tsx` strictly validates `return_to`:
  - Rejects any URL containing protocol indicators (`http:`, `https:`, `javascript:`).
  - Rejects schema-relative URLs starting with `//` or `/\\`.
  - Only allows relative paths starting with a single `/`.
  - Defaults to the role dashboard if invalid.
- **Authenticated Visitor to `/login`:** If a user with an active session navigates to `/login`, `UnifiedAuthForm` automatically detects the existing token and routes them immediately to their designated role dashboard (`/dashboard/student`, `/dashboard/guardian`, or `/dashboard`).

---

## 3. Session & Security Invariants Verification Matrix

| Security Control | Verification Standard | Implementation Evidence | Result |
| :--- | :--- | :--- | :---: |
| **Refresh Token Rotation** | Each call to `/api/v1/auth/refresh` revokes the old refresh token and issues a new pair with parent JTI tracking. | `backend/app/api/endpoints/auth.py:685-726` | **PASS** |
| **Reuse Detection** | Attempting to replay an already-rotated refresh token immediately terminates the entire token family and logs a security event. | `backend/app/api/endpoints/auth.py:675-684` | **PASS** |
| **Session Revocation** | `POST /api/v1/auth/logout` marks JTI revoked in database; subsequent requests fail with HTTP 401 Unauthorized. | `backend/app/api/endpoints/auth.py:741-778` | **PASS** |
| **Short-Lived Access Tokens** | Access tokens expire in 15 minutes, forcing background silent refresh or re-login. | `backend/app/core/security.py:create_access_token` | **PASS** |
| **Brute-Force Rate Limiting** | 5 consecutive failed login attempts trigger progressive delay and IP/account rate limiting with `Retry-After`. | `backend/app/api/endpoints/auth.py:320-323` | **PASS** |
| **Password Complexity** | Enforced minimum 10 characters with mandatory letters and numeric digits; maximum 72 bytes (bcrypt truncation safety). | `backend/app/api/endpoints/users.py` & `auth.py` | **PASS** |
| **Role-Route Authorization** | Strict prefix verification in `RoleRouteGuard.tsx`; students/guardians attempting staff routes receive 403 / redirect. | `frontend/components/RoleRouteGuard.tsx` | **PASS** |
| **Zero Swallowed Errors** | All authentication failures log structured telemetry with client IP and failure reason. | `backend/app/api/endpoints/auth.py:358` | **PASS** |

---

## 4. Verification & Browser Workflow Sign-Off

- **Unit & Integration Evidence:** `backend/tests/test_stage03_auth.py` and `frontend/tests/test_stage07_frontend.test.ts` pass with 100% success rate.
- **Production Build:** `npm run build` static prerendering succeeds across all 48 routes including `<Suspense>` wrapped `/login` and `/onboard`.
- **Stage 1 Acceptance:** **COMPLETED & VERIFIED**.

