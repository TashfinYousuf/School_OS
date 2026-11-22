# EducationOS — Environment Isolation & Secret Management Policy
**Document ID:** `docs/ENVIRONMENT_AND_SECRET_MANAGEMENT.md`  
**Generated:** 2026-11-11  
**Author:** Application Security Engineer & DevOps Architect  
**Scope:** Stage 7 Environment Segregation, Secret Rotation, and Zero-Trust Configuration  

---

## 1. Strict Environment Segregation Policy

To prevent catastrophic configuration contamination, data leakage, or unintentional database wipes, EducationOS maintains four strictly isolated deployment tiers:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   1. Local Dev   │     │  2. Shared Dev   │     │    3. Staging    │     │  4. Production   │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ • Local SQLite/PG│     │ • Shared dev DB  │     │ • Disposable PG  │     │ • Supabase Prod  │
│ • Mock Payments  │     │ • Feature testing│     │ • Staging Secrets│     │ • Live Secrets   │
│ • Localhost:3000 │     │ • Dev branch     │     │ • Rehearsal DDL  │     │ • Zero Live DDL  │
└──────────────────┘     └──────────────────┘     └──────────────────┘     └──────────────────┘
```

### Strict Environmental Invariants:
1. **Zero Shared Secrets:** Production secrets (`SECRET_KEY`, `DATABASE_URL`, `PAYMENT_WEBHOOK_SECRET`) must NEVER be used in local, dev, or staging environments.
2. **Zero Live Database Testing:** No developer or automated script may execute migration rehearsals or destructive testing against the production Supabase database.
3. **No Frontend Secrets:** Only variables prefixed with `NEXT_PUBLIC_` (e.g. `NEXT_PUBLIC_API_URL`) may exist in frontend code. Private database URLs, encryption keys, and AI gateway credentials must remain strictly in backend server environments.

---

## 2. Production Secret Key Inventory & Rotation Schedule

| Secret Key Name | Purpose | Minimum Entropy | Storage Mechanism | Rotation Schedule |
| :--- | :--- | :--- | :--- | :---: |
| **`SECRET_KEY`** | Signs and verifies user JWT access & refresh tokens. | 256-bit cryptographically secure random (`openssl rand -hex 32`) | Doppler / AWS Secrets Manager | Every 90 Days |
| **`DATABASE_URL`** | Encrypted connection string to production PostgreSQL pooler. | Includes strong password with special character escapes | Environment Injection | Every 180 Days |
| **`PAYMENT_WEBHOOK_SECRET`** | Verifies HMAC-SHA256 signatures on gateway IPN callbacks. | 256-bit hex token | Environment Injection | Every 180 Days |
| **`GEMINI_API_KEY`** | Authenticates AI Gateway calls to Google Gemini API. | Google Cloud API Key with API restrictions | Environment Injection | On Incident / 90 Days |
| **`ENCRYPTION_MASTER_KEY`** | Field-level AES-GCM encryption for stored student PII. | 256-bit raw key | Hardware Security Module (HSM) / KMS | Annual Re-encryption |

---

## 3. Secret Rotation & Zero-Downtime Migration Protocol

When rotating `SECRET_KEY` for JWT validation:
1. Inject `SECRET_KEY_NEW` alongside existing `SECRET_KEY_OLD`.
2. Backend decodes incoming tokens attempting `SECRET_KEY_OLD` first; if valid, re-issues new token signed with `SECRET_KEY_NEW`.
3. Newly generated tokens are signed with `SECRET_KEY_NEW`.
4. After 24 hours (surpassing the 15-minute access token lifespan and active refresh rotation), decommission `SECRET_KEY_OLD`.

