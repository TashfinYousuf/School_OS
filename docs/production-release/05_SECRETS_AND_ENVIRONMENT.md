# Phase 5: Production Secrets & Environment Configuration Inventory

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Execution Timestamp:** 2026-11-23T16:38:00+06:00 (Asia/Dhaka)  
**Classification:** Cryptographic Key Management & Environment Inventory  
**Auditor:** Principal DevSecOps Architect  

---

## 1. Secrets Management Policy & Zero-Leak Invariants

1. **Zero Secret Persistence in Git:** No `.env` files or active credentials may ever be committed to Git. Enforced by root `.gitignore` and CI scan gates.
2. **Cryptographic Entropy Standard:** All signing keys (`SECRET_KEY`) must possess minimum 256 bits of entropy generated via OS CSPRNG (`secrets.token_urlsafe(48)`).
3. **Frontend Isolation:** The frontend bundle may ONLY contain public `NEXT_PUBLIC_*` configuration. No database passwords, JWT signing keys, payment secrets, or service-role keys may be bundled in client JavaScript.
4. **Environment Segregation:** Preview and production environments must maintain distinct signing keys and isolate database contexts.

---

## 2. Master Environment Variable Inventory

### 2.1 Backend Production Service (Render / Docker)

| Variable | Classification | Requirement | Purpose / Validation Rule |
|---|---|---|---|
| `DATABASE_URL` | Critical Secret | Mandatory | Supabase PgBouncer URL (`postgresql://postgres.[id]:[pwd]@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require`) |
| `SECRET_KEY` | Critical Secret | Mandatory | Minimum 32-character high-entropy JWT HMAC key. Validated at startup by Pydantic. |
| `ENVIRONMENT` | Configuration | Mandatory | Must be set to `production` (disables Swagger/OpenAPI docs and enables secure cookie flags). |
| `CORS_ORIGINS` | Configuration | Mandatory | JSON string array of whitelisted domains (e.g. `["https://schoolos.app","https://educationos.vercel.app"]`). |
| `TIMEZONE` | Configuration | Mandatory | `Asia/Dhaka` (enforces Bangladesh standard time across academic reporting). |
| `DEFAULT_TENANT_ID` | Configuration | Mandatory | `1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31` (KSIS Pilot Tenant ID). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Configuration | Optional | Default: `60` (1 hour access token lifetime). |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Configuration | Optional | Default: `7` (7 days sliding session refresh). |
| `STORAGE_BACKEND` | Configuration | Optional | `local` for container storage, or `s3` for S3-compatible cloud object storage. |
| `GEMINI_API_KEY` | Secret | Optional | Google Gemini API key for automated curriculum parsing and AI tutor workflows. |
| `EMAIL_PROVIDER` | Configuration | Optional | `mock` (pilot mode) or `smtp` / `resend` / `brevo`. |
| `SMS_GATEWAY_PROVIDER` | Configuration | Optional | `mock` (pilot mode) or `greenweb` / `osel` for Bangladesh SMS dispatch. |

### 2.2 Frontend Application (Vercel)

| Variable | Classification | Requirement | Purpose / Validation Rule |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public Config | Mandatory | Absolute HTTPS URL of the backend API (e.g. `https://educationos-backend.onrender.com` or `https://api.schoolos.app`). No trailing slash. |

---

## 3. Cryptographic Secret Generation Recipe

To generate new production secrets for deployment dashboards:

```bash
# Generate 256-bit JWT signing SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(48))"

# Generate Payment Webhook Secret
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## 4. Provider Dashboard Configuration Guide

### 4.1 Render Dashboard (Backend Service)
1. Navigate to **Render Dashboard** -> **New** -> **Blueprint**.
2. Connect repository `TashfinYousuf/School_OS`. Render will parse `render.yaml`.
3. In the **Environment** settings of `educationos-backend`:
   - Enter `DATABASE_URL` with the Supabase connection string.
   - Verify `SECRET_KEY` is generated automatically by Render.
   - Set `CORS_ORIGINS` to include the assigned Vercel domain.

### 4.2 Vercel Dashboard (Frontend Project)
1. Navigate to **Vercel Dashboard** -> **New Project**.
2. Select repository `TashfinYousuf/School_OS`.
3. Set **Root Directory** to `frontend`. Framework preset will auto-detect **Next.js**.
4. In **Environment Variables**:
   - Add `NEXT_PUBLIC_API_URL` pointing to the Render backend service URL.
5. Click **Deploy**.

---

## 5. Phase 5 Conclusion

Environment variables and secret inventories are fully classified, verified against source validators, and documented with explicit generation recipes. Approved for Phase 6 release promotion.
