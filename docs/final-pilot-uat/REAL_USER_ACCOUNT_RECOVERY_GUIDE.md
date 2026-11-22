# REAL USER ACCOUNT RECOVERY GUIDE
## Self-Service Password Reset, Guardian Provisioning & Emergency Break-Glass

**Document ID:** EOS-UAT-008  
**Audience:** Platform Engineers, School System Administrators, IT Support Staff  
**Pilot Institution:** Kids Shine International School (KSIS)

---

## 1. Overview & Operational Principles

Account recovery must be secure, auditable, and impossible to exploit for account takeover. This guide documents the exact operational procedures for:
1. Standard user password reset via email.
2. Guardian initial provisioning and activation.
3. Student credential recovery.
4. Emergency break-glass access for School Administrators and Super Admins.

---

## 2. Standard Self-Service Password Reset

### Workflow
1. User clicks **"Forgot password?"** on `/login` (available on Staff, Student, and Guardian tabs).
2. The user is redirected to `/forgot-password`.
3. The user submits their registered email address.
4. Backend executes `POST /api/v1/auth/forgot-password`:
   - Validates user existence (without leaking account presence).
   - Generates a cryptographically random, single-use reset token (valid for 60 minutes).
   - Stores the hashed token in PostgreSQL `users.reset_token_hash`.
   - Sends password reset link containing `/reset-password?token=<token>`.
5. User clicks the link, inputs a new compliant password, and submits `POST /api/v1/auth/reset-password`.
6. Token is marked consumed and all active sessions are revoked.

---

## 3. Guardian Account Provisioning & Activation

When a student is enrolled during admission, a `Guardian` record is created with guardian contact details (e.g., Guardian Taki, Phone: `01673998729`). Initially, `guardian.user_id` is `None` (no login credentials yet).

### Provisioning Step:
The School Admin provisions user access via:
```bash
POST /api/v1/auth/guardian/{guardian_id}/invite
Authorization: Bearer <admin_token>
```
**System Actions:**
1. Generates a new `User` record with role `guardian`.
2. Links `Guardian.user_id = User.id`.
3. Generates an activation token: `/activate?token=<activation_token>`.
4. Dispatches SMS/Email to guardian containing the activation link.
5. Guardian accesses `/activate?token=...`, sets their password, and can immediately log in via the Guardian tab on `/login`.

---

## 4. Student Credential Recovery

Students access the platform via their institutional Student ID (e.g., `KSIS-2027-001`).
- If a student forgets their password, they contact their Class Teacher or School Admin.
- The Admin navigates to `/dashboard/students`, selects the student profile, and clicks **"Reset Access PIN / Password"**.
- A temporary 6-digit access PIN is generated, requiring immediate change upon first login.

---

## 5. Emergency Break-Glass Procedures

### Super Admin Emergency Recovery
- If the Super Admin loses access to their TOTP authenticator device:
  1. Super Admin navigates to `/platform/login`.
  2. Submits email and password, then clicks **"Use Emergency Recovery Code"**.
  3. Enters one of the single-use 16-character alphanumeric backup codes generated during MFA initialization.
  4. System verifies the code hash, burns the consumed code, grants access, and prompts re-enrollment of a new TOTP device.

### Local Server Recovery CLI
If all administrative access is lost, a server engineer with root shell access can execute the emergency CLI:
```bash
cd /Users/tashfinyousuf/Python/SCHOOL_OS
PYTHONPATH=backend venv/bin/python -m app.cli.qa_accounts provision
```
This verifies and re-generates administrative identities into `.qa-credentials.local` (mode 0600).
