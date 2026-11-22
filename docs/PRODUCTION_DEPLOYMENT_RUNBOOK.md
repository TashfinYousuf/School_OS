# EducationOS — Production Deployment & Rollback Runbook
**Document ID:** `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md`  
**Generated:** 2026-11-11  
**Author:** DevOps Lead & Release Operations Engineer  
**Scope:** Stage 7 Blue-Green Deployment, CI/CD Pipeline, Health Probing, and Deterministic Rollback  

---

## 1. Production Architecture Overview

EducationOS runs as an enterprise containerized architecture with zero premature microservices complexity:

```
                            Public Internet
                                   │
                           Cloudflare CDN / WAF
                                   │
                            Nginx Edge Proxy
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
     Next.js Frontend (port 3000)              FastAPI Core API (port 8000)
     • Static pre-rendering                   • Uvicorn ASGI / Gunicorn workers
     • Client-side PWA runtime                 • Async connection pooling
              │                                         │
              └────────────────────┬────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
PostgreSQL (Supabase)        Object Storage (S3)       AI Gateway (Gemini)
• PgBouncer connection pool  • Signed download URLs    • Token quota circuit breaker
• Row Level Security (RLS)   • Tenant-scoped buckets   • Rate-limited proxy
```

---

## 2. 14-Step Deployment Pipeline

1. **Pull Request Validation:** Automated GitHub Actions run `ruff check`, `mypy`, and `npx tsc --noEmit`.
2. **Backend Unit Testing:** `pytest tests/` runs 164 automated backend tests in isolated SQLite.
3. **Frontend Testing:** `npm test` runs 79 Node.js test runner suites in `frontend/tests/`.
4. **Security Vulnerability Scan:** `pip-audit` and `npm audit --audit-level=high`.
5. **Static Compilation:** Next.js production build (`npm run build`) verifies that all 48 routes compile cleanly.
6. **Container Image Build:** Docker builds `educationos-backend:v{SHA}` and `educationos-frontend:v{SHA}`.
7. **Staging Environment Deploy:** New containers deployed to staging cluster.
8. **Staging Database Migration Rehearsal:** `alembic upgrade head` executed on disposable PostgreSQL staging instance; schema drift verified via `schema_drift.py`.
9. **Automated Smoke Tests:** Synthetic test suite executes attendance roll call, Student 360 lookup, and fee invoice generation against staging.
10. **Manual Release Gate Authorization:** Owner / Release Auditor reviews staging metrics and approves cutover.
11. **Production Blue-Green Switch:** Traffic transitioned to new containers behind Nginx reverse proxy.
12. **Database Migration Cutover:** Live migrations applied only if backward-compatible (expand-and-contract pattern).
13. **Post-Deployment Health Probe:** Probe `/healthz` on live API; verify database connection latency < 50ms.
14. **Telemetry & Log Monitoring:** 15-minute intensive observation window on Sentry and Prometheus for 5xx error spikes.

---

## 3. Rollback & Disaster Recovery Triggers

A rollback must be initiated immediately if:
- HTTP 5xx error rate exceeds 1.0% across 5 consecutive minutes.
- Database connection pool utilization exceeds 90% unexpectedly.
- Critical login or attendance submission workflow fails automated smoke test.

### 3-Minute Rollback Execution:
```bash
# 1. Immediately switch Nginx traffic back to previous stable container tag
docker-compose -f docker-compose.prod.yml down app
docker-compose -f docker-compose.prod.yml up -d app:stable-previous

# 2. Downgrade database schema if migration was applied
cd backend && alembic downgrade -1

# 3. Purge edge CDN cache via Cloudflare API
curl -X POST https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache \
  -H "Authorization: Bearer $CF_API_TOKEN" -d '{"purge_everything":true}'

# 4. Notify on-call team and initiate incident post-mortem
```

