# EDUCATIONOS — PLATFORM SUPER ADMIN ACCESS & OPERATIONS RUNBOOK
**Classification:** Restricted — Platform Owner & Control Plane Operations  
**Scope:** EducationOS Multi-Tenant SaaS Platform  
**Target Environment:** Localhost / Staging / Production  
**Document Reference:** `docs/platform/PLATFORM_SUPERADMIN_ACCESS.md`

---

## 1. Executive Overview

The **Platform Super Admin** (`superadmin`) is the supreme administrative identity in EducationOS. Unlike tenant-specific administrators (such as the Kids Shine International School Admin), the Super Admin operates at the global control-plane layer (`tenant_id = c0000000-0000-0000-0000-000000000001`) and possesses cross-tenant oversight:

- Institutional Tenant Lifecycle (activation, suspension, termination).
- Subscription Tier & Plan Governance (Trial, Standard, Premium, Enterprise).
- Dual-Custody Payment Reconciliation (bKash, Nagad, Bank Wire approvals).
- Platform Infrastructure & Health Monitoring (API, Database, Vector, AI Gateway).
- Global AI Budget Allocation & Tenant Usage Quotas.

Public self-registration for the Platform Super Admin role is **permanently disabled**. The initial owner identity is established exclusively via the privileged CLI bootstrap tool.

---

## 2. Platform Owner Credential Provisioning (Bootstrap CLI)

### Command Signature
```bash
# Execute from project root (with project venv active)
PYTHONPATH=backend ./venv/bin/python backend/app/cli/bootstrap_platform_owner.py \
  --email "owner@educationos.internal"
```

> **Security Note:** Omit `--password` to enter your password interactively via secure, non-echoing prompts (`getpass.getpass`). This prevents sensitive credentials from appearing in your shell history (`.zsh_history`, `.bash_history`) or in system process tables (`ps aux`).

### Rotating Existing Credentials
To rotate credentials or recovery codes for an existing Platform Owner:
```bash
PYTHONPATH=backend ./venv/bin/python backend/app/cli/bootstrap_platform_owner.py \
  --email "owner@educationos.internal" \
  --rotate-credentials
```

### Password Requirements
- Minimum 10 characters in length (maximum 72 bytes due to bcrypt password constraints).
- Must contain both alphabetical characters (`[A-Za-z]`) and numeric digits (`[0-9]`).
- High-entropy; never reuse personal or pilot school credentials.

### Bootstrap Output Artifacts
Executing the bootstrap command generates:
1. **Root Platform Tenant & User Record:**
   - Role: `superadmin`
   - Tenant Scope: `c0000000-0000-0000-0000-000000000001` (Global Control Plane)
   - Active Status: `is_active = True`
2. **RFC 6238 TOTP Two-Factor Authentication Secret:**
   - 160-bit Base32 secret compatible with Google Authenticator, 1Password, Authy, Apple Keychain.
   - URI scheme: `otpauth://totp/EducationOS:<email>?secret=<secret>&issuer=EducationOS`
3. **Ten (10) Single-Use Recovery Codes:**
   - Formatted as `XXXX-XXXX-XXXX`.
   - Stored in persistent storage as SHA-256 hashes (`recovery_code_hashes`).
   - Store these codes in a secure offline vault or password manager.

---

## 3. Dedicated Platform Login Portal

The platform control plane features a dedicated, hardened login interface:

- **Portal URL:** `http://localhost:3000/platform/login` (or `/platform/login` in staging/production)

### Authentication Flow & State Machine
1. **Step 1: Credential Verification**
   - User enters Platform Owner email and password.
   - The backend validates credentials and checks MFA status.
   - If MFA is configured, the backend returns an intermediate `mfa_token` and transitions the UI to the 2FA challenge.
2. **Step 2: Two-Factor Authentication (TOTP)**
   - Enter the 6-digit code from your authenticator app.
   - Submits to `/api/v1/auth/mfa/verify`.
   - On success, issues authenticated access and refresh tokens.
3. **Emergency Recovery Option**
   - If the authenticator device is lost or inaccessible, click **"Use an emergency recovery code"**.
   - Enter one of your 10 single-use recovery codes (e.g. `A1B2-C3D4-E5F6`).
   - The system verifies the code, burns it from the remaining pool, and grants access.
4. **Passwordless Hardware Key / Passkey**
   - Click **"Sign in with Passkey / Security Key"**.
   - Authenticate via Touch ID, Face ID, or YubiKey using WebAuthn.
5. **Post-Authentication Landing**
   - The system persists the session securely using canonical session keys and routes directly to `/dashboard/platform`.

---

## 4. Platform Owner Account Security Settings

Within the Platform Console (`/dashboard/settings?tab=security`):
- **TOTP Status:** View active MFA status and remaining emergency recovery codes.
- **Passkey Registration:** Register current device (Touch ID / YubiKey) with one click via `navigator.credentials.create`.
- **Infrastructure Audits:** Review kernel-enforced PostgreSQL Row-Level Security (RLS) status and token rotation telemetry.

---

## 5. Security Policies & Truthful Recovery

- **Zero Public Password Reset:** Platform Owner accounts do not support public email-based password resets to prevent account takeover via email interception.
- **Credential Recovery Policy:** Credential recovery requires administrative shell access via `python -m app.cli.bootstrap_platform_owner --rotate-credentials`.
- **Session Revocation:** Initiating logout or credential rotation immediately revokes all active refresh tokens in `refresh_token_sessions`.
