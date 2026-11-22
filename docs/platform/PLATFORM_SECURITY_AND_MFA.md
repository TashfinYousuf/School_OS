# EducationOS — Platform Security & Multi-Factor Authentication (MFA)
# প্ল্যাটফর্ম সিকিউরিটি ও মাল্টি-ফ্যাক্টর অথেনটিকেশন নির্দেশিকা

---

## 1. Threat Model & Root Trust Hierarchy
EducationOS operates on a strictly partitioned tenant architecture:
- **Tenant Control Plane (`global`):** Managed exclusively by the Platform Super Admin (`superadmin`). Governs tenant provisioning, global subscriptions, platform telemetry, and system-wide security policies.
- **Tenant Data Plane (`tenant_id`):** Isolated institutional boundaries. School administrators have full authority within their school boundary, but zero visibility or mutation rights into other schools or the global control plane.
- **Role Isolation:** `superadmin` -> `admin` -> `teacher` -> `accountant` -> `guardian` -> `student`. Cross-role escalation is structurally barred by PostgreSQL Row-Level Security (RLS) policies and FastAPI RBAC guards.

---

## 2. Platform Super Admin Owner Access & Provisioning
Platform owner access is strictly decoupled from public registration forms.

### Bootstrap Command
To bootstrap or rotate the root owner account:
```bash
python -m app.cli.bootstrap_platform_owner \
  --email owner@educationos.internal \
  --password "CorrectHorseBatteryStaple99!"
```

### Security Safeguards
1. **Public Lockout:** Once a Super Admin is initialized, re-running the command fails by default. Credential rotation requires explicit `--force`.
2. **Password Hardening:** Minimum 10 characters, requiring letters and digits, maximum 72 bytes (bcrypt truncation boundary).
3. **MFA Enforced:** Every Super Admin provisioning generates an RFC 6238 160-bit Base32 TOTP secret and 10 high-entropy recovery codes (`XXXX-XXXX-XXXX`).
4. **Immutable Audit Trail:** Actions are logged to `AuditLog` with `risk_level = "High"`.

---

## 3. RFC 6238 TOTP Multi-Factor Authentication

### Verification Endpoint
`POST /api/v1/auth/mfa/verify`

**Request Body:**
```json
{
  "mfa_token": "<TEMPORARY_ACCESS_TOKEN_OR_USER_IDENTIFIER>",
  "code": "123456"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "mfa_verified": true,
  "user": {
    "id": "c1f7a0b3-...",
    "email": "owner@educationos.internal",
    "role": "superadmin",
    "tenant_id": "global"
  }
}
```

---

## 4. Emergency Single-Use Recovery Codes
When the owner or administrator loses access to their authenticator device:
- 10 emergency recovery codes are generated at bootstrap time (e.g. `B83F-9A02-C711`).
- Only SHA-256 hashes of the codes are stored.
- When an emergency recovery code is submitted to `POST /api/v1/auth/mfa/verify`, the matching hash is consumed and immediately deleted from the database/session record.
- Any subsequent attempt with the same recovery code is rejected with `401 Unauthorized`.

---

## 5. WebAuthn Passkey Support
EducationOS supports hardware-backed, phishing-resistant FIDO2 / WebAuthn Passkeys:
- **Challenge Generation:** `POST /api/v1/auth/passkey/register-challenge` & `POST /api/v1/auth/passkey/login-challenge` issue 32-byte cryptographic random challenges with a 300-second TTL.
- **Hardware Attestation:** Supports Platform Authenticators (Apple Touch ID, Face ID, Windows Hello) and Cross-Platform Authenticators (YubiKey).
- **Passwordless Sign-In:** Authenticates users via cryptographic signature verification without passwords over the wire.

