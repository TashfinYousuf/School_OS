# PRODUCTION OPERATIONAL READINESS
## Deployment Architecture, Container Orchestration, Health Monitoring & Backup SLA

**Document ID:** EOS-UAT-017  
**Infrastructure Target:** Cloud SaaS (PostgreSQL on Supabase, FastAPI on Render/Container, Next.js on Vercel/Node)  
**Region:** Asia-Southeast (Singapore / Dhaka)  
**Verdict:** **OPERATIONAL ARCHITECTURE VALIDATED FOR PILOT**

---

## 1. Production Topology & Component Roles

```
[ Institutional Clients (Browser / Mobile) ]
                  │
                  ▼
         [ Cloudflare CDN & WAF ]
         ├── Edge SSL / DDoS Shield
         ├── DNS & HTTP/2 Routing
         │
         ├───► [ Frontend Cluster: Next.js 16.4.5 (Vercel / Node) ]
         │      ├── Server-Side Rendering & ISR
         │      └── Static Route Delivery (57 routes)
         │
         └───► [ Backend API Cluster: FastAPI (Uvicorn Workers) ]
                ├── Token & Tenant Resolution Middleware
                ├── Business Logic & Validation Engines
                ├── Asynchronous Job Queues (RAG Ingestion)
                │
                ├───► [ Supabase Managed PostgreSQL (v15+) ]
                │      ├── Transaction Connection Pooler (:6543)
                │      ├── Row-Level Security Policies
                │      └── Daily Automated Snapshot Backups
                │
                └───► [ External SaaS Services ]
                       ├── Google Gemini API (Curriculum AI)
                       ├── Resend SMTP (Transactional Email)
                       └── SMS Provider Gateway (Greenweb / Mock)
```

---

## 2. Health Check & Observability Endpoints

| Endpoint | Method | Expected HTTP | Payload / Health Criteria |
|---|---|---|---|
| `/health` | GET | 200 OK | `{ "status": "ok", "app": "SchoolOS", "version": "2.4.0" }` |
| `/api/v1/health/db` | GET | 200 OK | `{ "database": "connected", "latency_ms": 14 }` |
| `/api/v1/health/ai` | GET | 200 OK | `{ "ai_service": "ready", "model": "gemini-2.5-flash" }` |

---

## 3. High Availability & Backup Strategy

- **Database Snapshots:** Supabase Point-in-Time Recovery (PITR) with daily continuous physical WAL archiving.
- **Data Export Facility:** Automated nightly JSON logical dumps of all tenant records archived into encrypted object storage.
- **RTO (Recovery Time Objective):** < 30 minutes in event of complete regional failover.
- **RPO (Recovery Point Objective):** < 5 minutes of data loss under catastrophic failure.
- **Log Aggregation:** Structured JSON logging outputs to stdout; ingested by centralized log monitoring. No passwords, tokens, or personal identifiers are written to log streams.

