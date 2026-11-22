# EducationOS — Production Incident Response Runbook
**Document ID:** `docs/INCIDENT_RESPONSE_RUNBOOK.md`  
**Generated:** 2026-11-09  
**Version:** 1.0.0 (Production / Kids Shine Pilot)  
**Security Classification:** Restricted / Operations & Incident Management  

---

## 1. Incident Management Overview & Principles

The EducationOS platform powers mission-critical institutional operations (student attendance, grade registries, financial receipts, AI operations, and portal access). An operational outage or data breach directly impacts school staff, students, and guardians.

### Core Principles
1. **Tenant Safety Above All:** If cross-tenant contamination or an RLS bypass is detected, immediately isolate the affected tenant or gracefully degrade to read-only mode rather than risk data leakage.
2. **Deterministic Escalation:** Every alert maps directly to a designated on-call role with strict SLA timelines.
3. **Evidence-Driven Post-Mortems:** Every P0/P1 event triggers a blameless root cause analysis (RCA) with reproducible telemetry and automated regression testing.

---

## 2. Severity Classification & Response SLAs

| Severity | Definition | Impact Examples | Response SLA | Target Resolution SLA | Escalation Target |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Catastrophic platform failure, active data breach, cross-tenant leak, or total database unavailability. | • PostgreSQL connection pool deadlocked.<br>• Tenant A can view Tenant B student records.<br>• Data corruption in financial ledger.<br>• Authentication service completely failing. | **< 15 minutes** | **< 2 hours** | Incident Commander, CTO, Lead Architect, SecOps |
| **P1 (High)** | Major core functionality impaired for multiple tenants; no immediate workaround available. | • Attendance submission failing globally.<br>• Report cards generation returning 500 errors.<br>• Payment callback processing failing.<br>• AI Gateway token quotas exhausted across cluster. | **< 30 minutes** | **< 4 hours** | Tech Lead, Backend Lead, DevOps On-Call |
| **P2 (Medium)** | Non-critical workflow degraded or single-tenant issue with a known temporary workaround. | • PDF print layout distorted on specific browsers.<br>• CSV bulk student import timing out on >500 rows.<br>• Guardian portal notifications delayed by >30 mins. | **< 2 hours** | **< 24 hours** | Primary Service Engineer, Product Support Lead |
| **P3 (Low)** | Minor cosmetic defect, non-blocking UI discrepancy, or minor feature request. | • Typo in Bengali localization string.<br>• Minor CSS alignment glitch in dark mode table footer. | **< 24 hours** | **Next Sprint Cycle** | Frontend Engineer, QA Team |

---

## 3. Incident Command Structure

During a P0 or P1 incident, standard engineering hierarchies are suspended in favor of the Incident Command System (ICS):

1. **Incident Commander (IC):**
   - Owns the incident bridge, coordinates communication, assigns tasks, and makes critical go/no-go rollback decisions.
   - Initial IC: Principal Systems Architect / DevOps On-Call.
2. **Technical Lead (TL):**
   - Directs the investigation, analyzes logs/metrics, reproduces root cause, and authors the remediation patch.
   - Initial TL: Senior Backend / Database Reliability Engineer.
3. **Communications Lead (CL):**
   - Updates customer support, crafts institutional status notices, and communicates with institutional administrators (e.g. Kids Shine School administration).
   - Initial CL: Product Operations Lead.
4. **Security Officer (SO) (Mandatory for P0 security incidents):**
   - Directs forensic evidence preservation, revokes compromised credentials, and assesses regulatory/legal breach notifications.

---

## 4. Specific Incident Action Runbooks

### Runbook 01: Tenant Boundary Violation or Cross-Tenant Leak Alarm
- **Trigger:** Sentry/Prometheus detects `tenant_boundary_violation` event or user reports foreign school data.
- **Immediate Containment Actions:**
  1. Revoke the active JWT/session token of the querying user immediately via Redis blocklist (`SET user_block:<uuid> 1 EX 86400`).
  2. Check `backend/app/core/tenant_guard.py` logs to identify if the bypass was an unauthenticated endpoint, a missing `current_tenant_id` filter in SQLAlchemy, or a route with an improper path parameter.
  3. If persistent or systemic, toggle Maintenance Mode for the affected school:
     ```bash
     # In emergency CLI or Cloudflare WAF:
     curl -X POST https://api.educationos.com/admin/tenants/{tenant_id}/suspend \
       -H "Authorization: Bearer $EMERGENCY_MASTER_KEY"
     ```
  4. Perform forensic database query to verify what records were accessed during the leak window.
  5. Issue emergency patch, deploy via blue-green pipeline, and re-verify cross-tenant isolation test suite (`pytest tests/test_security_redteam.py`).

### Runbook 02: PostgreSQL Connection Exhaustion / Database Outage
- **Trigger:** Healthcheck `/health/db` returns `status: unhealthy` (503) or Prometheus reports `db_pool_utilization > 95%`.
- **Immediate Containment Actions:**
  1. Inspect active connection count on PgBouncer / PostgreSQL:
     ```sql
     SELECT state, count(*) FROM pg_stat_activity GROUP BY state;
     ```
  2. Kill long-running, stalled queries (> 60s):
     ```sql
     SELECT pg_terminate_backend(pid) 
     FROM pg_stat_activity 
     WHERE state != 'idle' AND query_start < NOW() - INTERVAL '60 seconds';
     ```
  3. Scale PgBouncer pool ceiling if resource memory permits, or throttle non-essential background jobs (AI batch tasks, analytics aggregation).
  4. Restart application workers gracefully if connection leak is detected in SQLAlchemy session management.

### Runbook 03: AI Gateway Provider Outage or Cost Surge
- **Trigger:** Circuit breaker opens on Gemini API (> 5 consecutive 5xx errors) or tenant AI spend reaches 100% of hard quota.
- **Immediate Containment Actions:**
  1. The AI Gateway automatically fails open with structured fallbacks:
     - Attendance summary generation degrades to pre-computed tabular template.
     - Student performance feedback falls back to standard letter grade rubrics without AI narrative commentary.
  2. Verify tenant budget status in `ai_tenant_spend_tracker`:
     - If cost surge is caused by prompt runaway or API loop, immediately block the offending endpoint via rate-limiter:
     ```bash
     curl -X POST https://api.educationos.com/admin/ai/kill-switch -H "Authorization: Bearer $ADMIN_SECRET"
     ```
  3. Switch upstream provider in configuration (`AI_UPSTREAM_MODEL="gemini-1.5-flash"` fallback mode).

### Runbook 04: Payment Webhook Failure / Double-Billing Anomaly
- **Trigger:** Webhook verification failure spike (> 5%) or duplicate transaction ID reported by gateway.
- **Immediate Containment Actions:**
  1. Verify HMAC-SHA256 signature keys in secret manager.
  2. Halt automated subscription state advancement for unverified IPNs:
     ```sql
     UPDATE subscription_invoices SET status = 'under_review' WHERE verification_status = 'failed';
     ```
  3. Query idempotency table (`billing_idempotency_keys`) to verify if double-charge occurred.
  4. Initiate automated reversal through gateway API for duplicate intents.

---

## 5. Rollback & Disaster Recovery Triggers

Rollback is mandatory if any of the following occur within 15 minutes of a production release:
1. HTTP 5xx error rate exceeds 1.0% of total traffic.
2. Latency p95 exceeds 1,200ms across dashboard endpoints.
3. Any data migration failure leaves the database in an inconsistent state.
4. Core login or attendance submission workflow fails automated smoke test.

### Rollback Execution:
```bash
# 1. Revert container deployment to previous Git SHA tag
docker-compose -f docker-compose.prod.yml down app
docker-compose -f docker-compose.prod.yml up -d app:stable-previous

# 2. If migration occurred and is backward-incompatible:
cd backend && alembic downgrade -1

# 3. Purge edge cache
curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache \
  -H "Authorization: Bearer $CF_API_TOKEN" -d '{"purge_everything":true}'
```

---

## 6. Post-Mortem & Blameless RCA Protocol

Within 48 hours of any P0/P1 resolution:
1. **Timeline Reconstruction:** Chronological log of alerts, actions, hypothesis testing, and fixes.
2. **Root Cause Analysis (5 Whys):** Deep identification of structural, architectural, or procedural failure.
3. **Action Items:** Ticketed engineering tasks with assignees and 14-day SLA to permanently eliminate the class of defect.
4. **Archival:** Saved under `docs/incidents/INCIDENT-YYYY-MM-DD-NAME.md`.

