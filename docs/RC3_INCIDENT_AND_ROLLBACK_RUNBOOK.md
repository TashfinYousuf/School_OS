# RC3 Incident Response, Break-Glass & Rollback Runbook

## 1. Rollback Decision Criteria
Trigger an immediate release rollback if ANY of the following occur post-deployment:
- Cross-tenant data exposure or BOLA 200 on unauthorized IDs.
- Health check `/healthz` non-200 or DB pool exhaustion (`pool_pre_ping` failures).
- Authentication refresh failures affecting active Staff/Student/Guardian sessions.
- Unexpected HTTP 500 spikes on core attendance, grading, or fee collection endpoints.

## 2. Application & Migration Rollback Procedure
1. **Application Binary Rollback:** Revert the container/service image or commit (`docker compose -f docker-compose.prod.yml up -d --build` on previous tag / `git checkout <prev-sha>`).
2. **Feature Flag Mitigation (Zero-Schema Downtime):**
   - If temporary RLS compatibility debugging is required while diagnosing a legacy query, review `postgres` logs first. Only as an audited break-glass emergency: inspect `DB_ENFORCE_RLS_ROLE` configuration on staging before changing production.
3. **Database Migration Downgrade (Only if Safe):**
   - `cedb24c053f7` is strictly additive (`ADD COLUMN NULL`, `CREATE INDEX IF NOT EXISTS`, `CREATE POLICY`, backfill into `student_guardians`). Previous code remains forward-compatible with nullable columns and permissive RLS policies — **do NOT downgrade DB schema in an active traffic window unless directed by DBA**.

## 3. Compromised Account / Secret Rotation
- **Suspected compromised Student/Guardian account:**
  - Call `POST /api/v1/auth/accounts/{user_id}/suspend` -> sets `is_active=False`, revokes all `RefreshTokenSession` rows, writes `AuditLog`.
  - Optionally revoke specific link (`POST /api/v1/guardians/admin/links/{link_id}/revoke`).
  - Re-issue activation via `POST /api/v1/auth/password-reset/initiate` after identity re-verification.
- **Suspected webhook secret compromise:** Rotate `PAYMENT_WEBHOOK_SECRET` / `BKASH_WEBHOOK_SECRET` / `NAGAD_WEBHOOK_SECRET` / `SSLCOMMERZ_STORE_PASSWD` / `WHATSAPP_VERIFY_TOKEN` and restart backend workers immediately.

