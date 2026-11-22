# SECRET EXPOSURE AND REMEDIATION AUDIT
## Credential Isolation, Key Management & Rotation Policies

**Document ID:** EOS-UAT-003  
**Classification:** Confidential Security Audit  
**Audit Target:** Secret boundaries, environment variables, token lifetimes, and key rotation

---

## 1. Scope & Standards

This document establishes the state of cryptographic secrets, API keys, database credentials, and security tokens across EducationOS in compliance with OWASP Top 10 A07:2021 (Identification and Authentication Failures) and A01:2021 (Broken Access Control).

---

## 2. Secret Inventory & Storage Location

| Secret Category | Identifier / Purpose | Permitted Storage | Git Exposure Status |
|---|---|---|---|
| **Database Connection** | Supabase Transaction Pooler URI | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **Auth Cryptography** | `JWT_SECRET_KEY` (HS256) | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **Passkey Salt** | WebAuthn RP / Origin secret | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **AI LLM Engine** | Google Gemini API Key | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **Email Gateway** | Resend SMTP API Key | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **SMS Gateway** | Greenweb / Onnorokom API Key | Staging/Prod `.env` | **ZERO EXPOSURE** |
| **QA Identifiers** | `.qa-credentials.local` | Local only (0600) | **ZERO EXPOSURE** |

---

## 3. Cryptographic Token Lifecycle

- **JWT Access Tokens:**
  - Standard expiration: 60 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES=60`).
  - Strict payload validation includes: `sub` (user_id), `tenant_id`, `role`, `workspace_id`, and `exp`.
  - Signature algorithm: `HS256` with minimum 256-bit high-entropy secret.
- **Refresh Tokens:**
  - Token rotation enforced upon each reissue.
  - Revocation table invalidates compromised tokens immediately upon logout or password reset.
- **Password Reset & Guardian Activation Tokens:**
  - Single-use, cryptographically generated UUID/token with 24-hour expiration.
  - Stored hashed in PostgreSQL; cleared upon successful consumption.
- **TOTP MFA Secrets:**
  - Base32 encoded standard RFC 6238 secrets stored encrypted in the database.
  - Super Admin emergency scratch recovery codes hashed with Argon2id/bcrypt.

---

## 4. Key Rotation Protocol

In the event of an operational need to rotate production keys:
1. **JWT Secret Rotation:** Deploy dual-secret verification (accept current and previous secret for 60 minutes, issue exclusively with new secret).
2. **Database URI Rotation:** Update connection strings in Supabase control panel; redeploy backend environment variables without application downtime.
3. **AI / Third-Party Keys:** Revoke obsolete key in Google AI Studio / Resend dashboard; update `.env` in container runner.
