# EducationOS — Platform Service Health, Observability & Runtime Telemetry Architecture

**Classification:** System Observability, High Availability & SRE Standards  
**Target:** Production Multi-Tenant Staging & Production Deployment  
**Status:** FULLY IMPLEMENTED & VERIFIED  

---

## 1. Observability Architecture Overview

EducationOS implements structured, multi-tier runtime observability designed for containerized cloud deployment (Docker Swarm, Kubernetes, Google Cloud Run) and institutional FinOps compliance:

```mermaid
flowchart TD
    Client[Web & Mobile Clients] --> Traefik[Reverse Proxy / Ingress]
    Traefik --> RequestCtx[RequestContextMiddleware]
    RequestCtx --> FastAPICore[EducationOS FastAPI Engine]
    
    subgraph Observability_Endpoints
        FastAPICore --> HealthAPI["GET /api/v1/health (Rich Telemetry)"]
        FastAPICore --> ReadyAPI["GET /api/v1/ready (Readiness Probe)"]
    end
    
    subgraph System_Subsystems
        HealthAPI --> DBPool[SQLAlchemy Connection Pool]
        HealthAPI --> StorageSubsystem[StorageService (S3 / R2 / Local)]
        HealthAPI --> CommsSubsystem[Communications Providers & Outbox]
    end
```

---

## 2. Telemetry Endpoints & Probes

### 2.1 Rich System Health Probe (`GET /api/v1/health`)
Provides an authenticated/public diagnostic payload detailing the operational state of core subsystems without exposing private credentials:

```json
{
  "status": "healthy",
  "service": "EducationOS API",
  "database": "healthy",
  "pool": {
    "size": 10,
    "checkedin": 10,
    "checkedout": 0,
    "overflow": 0
  },
  "storage": {
    "backend": "LOCAL",
    "bucket": "educationos-assets"
  },
  "communications": {
    "email": {
      "channel": "email",
      "provider": "smtp",
      "configured": true,
      "status": "READY"
    },
    "sms": {
      "channel": "sms",
      "provider": "greenweb",
      "configured": true,
      "status": "READY"
    },
    "whatsapp": {
      "channel": "whatsapp",
      "configured": false,
      "status": "NOT_CONFIGURED"
    }
  },
  "timestamp": "2026-11-17T03:00:00.000000+00:00"
}
```

### 2.2 Orchestration Readiness Probe (`GET /api/v1/ready`)
Conforms to Kubernetes and load balancer specifications:
- **Status 200 OK:** Database connection test succeeds (`SELECT 1`). Traffic is routed to this instance.
- **Status 503 SERVICE UNAVAILABLE:** Database pool exhausted, network unreachable, or pooler timeout. Ingress removes the node from the active upstream pool before user requests fail.

---

## 3. Distributed Request Tracing & Correlation

Every HTTP transaction passing through EducationOS is assigned a deterministic correlation tracking lifecycle via `RequestContextMiddleware` in `backend/app/main.py`:

1. **`X-Correlation-ID` & `X-Request-ID` Extraction / Generation:**
   - Reads existing correlation header if provided by API gateways or microservices.
   - Generates a UUIDv4 token if omitted.
   - Binds the correlation identifier to the active Python `contextvars` context.
2. **Process Time Instrumentation:**
   - Calculates monotonic clock duration (`time.perf_counter()`).
   - Appends `X-Process-Time: 0.0042s` to the HTTP response headers.
3. **Structured Log Contextualization:**
   - All backend errors, database rollbacks, and audit entries capture the active correlation ID.

---

## 4. Platform Super Admin Operations Console

The Super Admin Console (`frontend/app/dashboard/platform/page.tsx`) aggregates live telemetry for platform operators:

1. **Tenant Directory & Quota Management:**
   - Student caps, active enrollment counters, plan tiers, and validity horizons.
2. **Dual-Custody FinOps Payment Reconciliation:**
   - Real-time stream of pending subscription payments.
   - Operator segregation: an admin who submitted a claim cannot approve it.
   - Atomic license provision upon verified bank statement reference.
3. **Subsystem Health Monitoring:**
   - Live SQLAlchemy pool usage (size, checked-in, checked-out).
   - Kernel-enforced PostgreSQL Row-Level Security verification.
   - S3 / Cloudflare R2 object storage migration status.
   - Transactional outbox retry cadence and worker status.

