# EducationOS — Production Infrastructure & Domain Architecture
**Document ID:** `docs/PRODUCTION_INFRASTRUCTURE_ARCHITECTURE.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section I (Phase 7) Master Engineering Directive  
**Status:** **AUTHORITATIVE TOPOLOGY SPECIFICATION**  

---

## 1. Domain Topology & Request Routing

EducationOS employs a multi-tiered domain architecture cleanly separating public marketing content, application state, and institutional subdomains:

```
[Internet User]
       │
       ├──► https://educationos.com           ──► Next.js Edge CDN (Marketing, Pricing, Docs)
       ├──► https://app.educationos.com       ──► Next.js Application Container (Dashboard PWA)
       ├──► https://api.educationos.com       ──► FastAPI Gateway Container (TLS 1.3 Terminated)
       ├──► https://kidsshine.educationos.com ──► Tenant Subdomain (Auto-resolved to Tenant UUID)
       └──► https://portal.kidsshine.edu.bd   ──► Custom Apex/CNAME Domain (Verified Mapping)
```

### 1.1 Tenant Domain Resolution Strategy
1. **Host Header Validation:**
   - Fast-path lookup against verified `tenants(domain)` or `tenant_domains(custom_domain, verified=True)`.
   - Wildcard matching on `*.educationos.com` resolves subdomain prefix directly to tenant record.
2. **Anti-Host Header Injection:**
   - Untrusted or unmapped Host headers fall back to the platform default hostname or return HTTP 400 Bad Request.
3. **Custom Domain Verification:**
   - Requires institution to configure a DNS `CNAME` record pointing to `cname.educationos.com`.
   - Backend verifies DNS propagation and domain ownership before binding to tenant context.

---

## 2. Infrastructure Hosting Topology

| Component | Technology | Hosting Tier | Security & Isolation Controls |
| :--- | :--- | :--- | :--- |
| **Frontend Web / PWA** | Next.js 16/14 (React 19) | Managed Edge / Container | HTTPS only, CSP headers, PWA Service Worker caching |
| **API Gateway & Services** | FastAPI / Uvicorn | Containerized Linux (Alpine/Debian) | Non-root user, memory limits, rate limiting |
| **Relational Database** | PostgreSQL 17 (Supabase Managed) | Multi-AZ Cloud Database | Row-Level Security (RLS), connection pooling, encrypted at rest |
| **Document / Blob Storage** | Private S3 / Object Storage | Private Cloud Bucket | Short-lived pre-signed URLs (15-min expiry), MIME validation |
| **AI Inference Gateway** | Gemini 1.5 Pro / Groq Fallback | Server-Side Private Egress | Provider secrets encrypted in env, tenant budget quotas |

---

## 3. Strict Environment Separation

All environments maintain non-overlapping credentials, databases, and secrets:

| Environment | Purpose | Database Host | JWT Secret | AI Gateway |
| :--- | :--- | :--- | :--- | :--- |
| **Local Dev** | Rapid iteration | In-memory SQLite / Local Docker | Development Secret | Mock / Free Tier |
| **Automated Test** | CI/CD Unit & Integration | In-memory SQLite (`StaticPool`) | Test Secret Key | Deterministic Mocks |
| **Staging** | Pre-release rehearsal & red-team | Disposable Staging PostgreSQL 17 | Staging Secret Key | Sandboxed Providers |
| **Production** | Live pilot & commercial service | Multi-AZ Supabase Managed PG | High-Entropy 256-bit Vault Secret | Production Paid Quotas |

---

## 4. Continuous Deployment Pipeline

```
[Git Commit (main)] ──► [Lint & Type Check (npx tsc)] ──► [Frontend Tests (npm test)]
                             │
                             ▼
                    [Backend Tests (pytest)]
                             │
                             ▼
               [Next.js Production Build Test]
                             │
                             ▼
               [Staging Deployment & Migration Run]
                             │
                             ▼
             [Manual Approval Gate for Production]
                             │
                             ▼
              [Zero-Downtime Blue/Green Deploy]
```

