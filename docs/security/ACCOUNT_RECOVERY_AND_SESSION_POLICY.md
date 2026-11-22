# EducationOS — Account Recovery, Session Management & Token Revocation Policy
# অ্যাকাউন্ট রিকভারি, সেশন পলিসি ও টোকেন বাতিলকরণ নির্দেশিকা

---

## 1. Session Architecture & Token Lifetime
EducationOS implements a hardened dual-token JWT architecture:
- **Access Token:** Short-lived (typically 15 to 30 minutes). Encodes tenant ID, user role, and MFA verification claims. Stateless validation via HMAC-SHA256 / Ed25519 signatures.
- **Refresh Token:** Long-lived (7 to 30 days depending on role). Persistent in `refresh_token_sessions` table.
- **Single-Use Rotation:** Every refresh token exchange generates a brand new access and refresh token pair while revoking the parent refresh token (`parent_jti`).
- **Concurrent Replay Detection:** If a revoked refresh token is presented again, the security guard flags an intrusion attempt and revokes all active sessions for that user across all devices.

---

## 2. Immediate Session Invalidation Triggers
All active sessions for a user are revoked immediately upon:
1. **Password Change or Reset:** The user or admin updates account password credentials.
2. **Role or Permission Mutation:** When an administrator changes a staff member's role or access rights.
3. **Account Deactivation:** Admin switches account `is_active = False`.
4. **Explicit Logout:** The user invokes `POST /api/v1/auth/logout`.
5. **Detected Token Replay:** A previously consumed refresh token is presented to the refresh endpoint.

---

## 3. Account Recovery Workflows

### A. Self-Service Portal Recovery (Students & Guardians)
1. Guardian/Student navigates to login and clicks **"Forgot Password?"**.
2. Requests an OTP to their registered mobile number or email.
3. Upon validating the 6-digit OTP, the portal prompts for a new password.
4. Old sessions are instantly revoked, and an audit entry `account.password_reset` is recorded.

### B. Administrative Account Reset (School Staff)
1. School Administrator locates the staff member in the School Admin Console.
2. Clicks **"Issue Activation Link"** or invokes `POST /api/v1/auth/password-reset/initiate`.
3. The system generates a single-use cryptographically signed activation token:
   `/activate?token=<TOKEN_HASH>`
4. The user navigates to the URL, supplies a strong password, and completes onboarding.

### C. Emergency Platform Owner Recovery (Super Admin)
1. Access the terminal host environment.
2. Present one of the 10 emergency recovery codes to `POST /api/v1/auth/mfa/verify`.
3. Or re-run the bootstrap CLI with `--force`:
   ```bash
   python -m app.cli.bootstrap_platform_owner --email <EMAIL> --password <NEW_PASSWORD> --force
   ```
4. New recovery codes and a new TOTP secret will be generated, and all existing superadmin sessions will be invalidated.

