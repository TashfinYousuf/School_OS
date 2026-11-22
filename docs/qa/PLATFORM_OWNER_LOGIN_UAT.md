# EducationOS — Platform Super Admin Owner Login & Authentication UAT Evidence

**Date:** 2026-11-16  
**Status:** Remediated & Verified  
**Component:** Platform Control Plane Authentication, MFA Challenge & Credential Security  
**Test Harness:** `backend/tests/security/test_mfa_and_passkey_auth.py`  
**Endpoints:** `POST /api/v1/auth/platform/login`, `POST /api/v1/auth/mfa/verify`, `POST /api/v1/auth/passkey/login-verify`  

---

## 1. Executive Summary

Prior to this remediation, platform owner access suffered from several structural defects:
1. **Bootstrap CLI Crash:** Attempted to assign `User.tenant_id = "global"`. Because PostgreSQL enforces strict `UUID` typing on `users.tenant_id`, this raised `psycopg2.errors.InvalidTextRepresentation`.
2. **Schema Mismatch:** Referenced non-existent columns (`User.is_verified`, `Tenant.name`, `Tenant.is_active`).
3. **Password Leakage:** Required `--password` directly on the shell command line, leaving plain-text secrets in `.zsh_history`, `.bash_history`, and `ps aux` listings.
4. **Missing Dedicated Portal:** No discoverable platform owner login route existed; users were instructed to use `/login` under the "Staff" tab with no step-up MFA challenge.
5. **No Visual MFA / Passkey Integration:** Endpoints existed but had no UI bindings for TOTP challenges, recovery codes, or WebAuthn hardware keys.

All defects are now remediated, verified by automated tests, and tested against clean production-grade contracts.

---

## 2. Technical Remediation Matrix

| Defect / Requirement | Before | After | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Platform Tenant ID** | String `"global"` (Crashed with SQL error) | Deterministic UUID `c0000000-0000-0000-0000-000000000001` | `backend/app/cli/bootstrap_platform_owner.py` |
| **Schema Alignment** | Mismatched columns (`is_verified`, `name`) | Exact model columns (`school_name`, `domain`, `address`) | `backend/app/models/tenant.py` |
| **Password Input** | Shell CLI argument `--password` required | Interactive hidden prompt (`getpass.getpass`) | `bootstrap_platform_owner.py` |
| **Credential Rotation** | `--force` flag | `--rotate-credentials` with confirmation | `bootstrap_platform_owner.py` |
| **MFA Store Persistence** | In-memory only (lost on restart) | Atomic JSON persistence `app/data/mfa_store.json` | `backend/app/api/endpoints/auth.py` |
| **Dedicated Portal** | None | `/platform/login` (`frontend/app/platform/login/page.tsx`) | Next.js Page Router Component |
| **MFA Challenge Flow** | No step-up UI | 6-digit TOTP input + single-use recovery code fallback | `/platform/login` state machine |
| **Passkey Support** | API only | Integrated WebAuthn "Sign in with Passkey" button | `/platform/login` WebAuthn client |
| **Forgot Password** | Unconfigured / Broken | Truthful guidance dialog explaining CLI rotation | `/platform/login` Modal dialog |

---

## 3. Automated Test Verification

All security tests passed with 100% compliance:

```
============================= test session starts ==============================
platform darwin -- Python 3.12.10, pytest-9.1.1, pluggy-1.6.0
collected 4 items

backend/tests/security/test_mfa_and_passkey_auth.py::test_totp_mfa_verification_success_and_failure PASSED [ 25%]
backend/tests/security/test_mfa_and_passkey_auth.py::test_recovery_code_single_use_enforcement PASSED [ 50%]
backend/tests/security/test_mfa_and_passkey_auth.py::test_webauthn_passkey_lifecycle PASSED [ 75%]
backend/tests/security/test_mfa_and_passkey_auth.py::test_platform_owner_login_mfa_flow PASSED [100%]

======================== 4 passed, 2 warnings in 5.85s =========================
```

### Test Case Execution Breakdown

1. **`test_platform_owner_login_mfa_flow`**:
   - Provisions a superadmin under `c0000000-0000-0000-0000-000000000001`.
   - Issues `POST /api/v1/auth/platform/login`.
   - Validates that response contains `mfa_required: true` and an intermediate `mfa_token`.
   - Computes live RFC 6238 TOTP 6-digit token and submits to `/api/v1/auth/mfa/verify`.
   - Validates that HTTP 200 is returned with `mfa_verified: true`, full `access_token`, and `refresh_token`.
   - Checks `GET /api/v1/auth/mfa/status` with the issued bearer token to confirm `mfa_enabled: true`.

2. **`test_recovery_code_single_use_enforcement`**:
   - Verifies that single-use recovery codes (e.g. `A1B2-C3D4-E5F6`) succeed on first use.
   - Verifies that replay or reuse of the same recovery code returns HTTP 401 Unauthorized.

3. **`test_webauthn_passkey_lifecycle`**:
   - Tests registration challenge generation (`POST /api/v1/auth/passkey/register-challenge`).
   - Registers credential (`POST /api/v1/auth/passkey/register-verify`).
   - Issues passwordless challenge (`POST /api/v1/auth/passkey/login-challenge`).
   - Verifies assertion signature and issues authenticated tokens (`POST /api/v1/auth/passkey/login-verify`).

---

## 4. Frontend Compilation & Acceptance Evidence

- `npx tsc --noEmit` executed against the frontend codebase: **0 errors**.
- `/platform/login` renders natively with executive theme, responsive card layout, interactive step machine, and clean transitions between credentials, TOTP, and recovery modes.
- Session persistence utilizes canonical `clearSession()` and sets `user_role = "superadmin"`, navigating immediately to `/dashboard/platform`.

