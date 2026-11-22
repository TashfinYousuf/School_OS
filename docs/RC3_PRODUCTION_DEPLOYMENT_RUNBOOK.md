# RC3 Production Deployment Runbook

## 1. Mandatory Environment Variables
Before promoting to production, ALL of the following secrets must be configured in the deployment environment (never defaulted in code):
- **Core Auth & DB:**
  - `DATABASE_URL` (PostgreSQL / Supabase pooler URI)
  - `SECRET_KEY` (Cryptographically random >= 32 chars)
  - `DB_ENFORCE_RLS_ROLE=true` (enforces `SET LOCAL ROLE authenticated` on tenant DB sessions)
  - `NEXT_PUBLIC_API_URL` (public HTTPS backend URL)
- **Payment & Webhook Secrets (Fail Closed HTTP 503 if unset):**
  - `PAYMENT_WEBHOOK_SECRET` (SaaS subscription billing callback secret)
  - `BKASH_APP_KEY`, `BKASH_APP_SECRET`, `BKASH_WEBHOOK_SECRET`
  - `NAGAD_MERCHANT_ID`, `NAGAD_WEBHOOK_SECRET`
  - `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD`
- **AI & Messaging (Required for Live Features):**
  - `GEMINI_API_KEY` (Socratic Tutor, Question Paper, OMR Vision)
  - `GROQ_API_KEY` (AI Failover)
  - `WHATSAPP_VERIFY_TOKEN` (fail closed HTTP 503 if unset)
  - `SMS_GATEWAY_URL`, `SMS_API_KEY` (without these, `/dispatch-result-sms` returns `DELIVERY_NOT_CONFIGURED`)
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (without these, `/notifications/dispatch-reminder` returns `DELIVERY_NOT_CONFIGURED`)

## 2. Pre-Deploy Database Sequence
1. Verify current Alembic head matches repository target (`cedb24c053f7`):
   ```bash
   cd backend && ../venv/bin/alembic heads
   ```
2. Backup database snapshot prior to migration.
3. Run additive migration:
   ```bash
   cd backend && ../venv/bin/alembic upgrade head && PYTHONPATH=. ../venv/bin/python scripts/schema_drift.py
   ```
4. Verify zero schema drift (`0 issue(s). Schema mile gache.`).

## 3. Release Verification Checklist
- Run `bash backend/scripts/check.sh` (`compileall`, `ruff`, `import app.main`, `schema_drift.py`, `tsc --noEmit`) -> exit 0.
- Run `cd backend && PYTHONPATH=. ../venv/bin/pytest -q tests/security/ tests/test_rls_negative_db.py tests/test_rc3_pricing_and_billing.py` -> all green.
- Run `cd frontend && npm test && npm run build` -> all green.
- Smoke probe `/healthz` (`200 OK`) and verify login flows across Staff, Student, Guardian, and Platform Superadmin.

