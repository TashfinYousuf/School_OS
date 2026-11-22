# EducationOS — Student & Guardian Authentication Specification
**Document ID:** `docs/STUDENT_GUARDIAN_AUTHENTICATION_SPEC.md`  
**Date:** 2026-11-11  
**Status:** ARCHITECTURAL SPECIFICATION & GOVERNANCE  
**Auditors:** Application Security Architect, Backend Engineer, SecOps Lead  

---

## 1. Authentication Endpoints Overview

| Route / Endpoint | HTTP Method | Target Persona | Authentication Factors | Key Invariants |
| :--- | :---: | :---: | :--- | :--- |
| `/api/v1/auth/student` | POST | Student | `username` / `admission_number` + `password` + `school_code` | Checks active student status; authenticates against `User.password_hash`. |
| `/api/v1/auth/guardian/login` | POST | Guardian | `phone` / `email` + `password` + `school_code` | **Replaces legacy admission+phone login.** Validates password against `User.password_hash`. |
| `/api/v1/auth/activate` | POST | Student / Guardian | `token` + `new_password` | Validates high-entropy token in `account_invitations`; sets initial permanent password. |
| `/api/v1/auth/forgot-password` | POST | Student / Guardian | `identifier` (username/email/phone) + `school_code` | Dispatches single-use reset token via verified contact channel. |
| `/api/v1/auth/reset-password-confirm` | POST | Student / Guardian | `token` + `new_password` | Consumes reset token; invalidates all active sessions for that user account. |

---

## 2. JWT Token Payload & Subject Invariant

Every issued JWT token must strictly adhere to the canonical subject convention:

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",       // Canonical User.id (UUID string)
  "tenant_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6", // School Tenant UUID
  "role": "student",                                     // "student" or "guardian"
  "jti": "d41d8cd98f00b204e9800998ecf8427e",            // Cryptographic session JTI
  "exp": 1794500000,
  "iat": 1794496400
}
```

### Critical Identity Invariants:
1. **`sub` is ALWAYS `User.id`**: `sub` is never set to `student.id` or `guardian.id`. Role-specific record resolution is performed server-side via `Student.user_id == sub` or `Guardian.user_id == sub`.
2. **`tenant_id` is IMMUTABLE in Token**: Enforced by cryptographic signature (HMAC-SHA256).

---

## 3. Rate Limiting, Brute-Force & Lockout Policy

To prevent brute-force attacks across student and guardian login endpoints:

1. **IP-Level Limiter:** Maximum 10 failed login attempts per 15-minute window per IP address. Exceeding triggers HTTP 429 Too Many Requests with `Retry-After`.
2. **Account-Level Progressive Delay:**
   - 3 consecutive failed attempts: 5-second mandatory delay before next attempt.
   - 5 consecutive failed attempts: 60-second lockout.
   - 10 consecutive failed attempts: Account locked; requires administrative unlock or password reset via verified channel.
3. **No Account Enumeration Oracle:** Failed attempts for non-existent usernames or mismatched passwords return identical generic error messages: `"Invalid credentials, or account not authorized."`
4. **Timing Attack Protection:** Constant-time dummy password hashing (`_DUMMY_HASH`) executed when a user lookup yields zero results.

---

## 4. Session Revocation & Blast Radius Control

1. **Password Change / Reset:** When a user changes their password or completes a password reset, all existing `RefreshTokenSession` records for that user are marked `revoked = TRUE`.
2. **Session Rotation:** Refresh tokens are single-use (`parent_jti` rotation). Replay attempts automatically revoke the entire refresh token family.
3. **Tenant Disablement:** If a tenant is suspended for non-payment or administrative lock, all active JWT tokens for that tenant are rejected at the `get_current_tenant_id` gateway dependency.

