# Phase 4: Production Infrastructure Configuration Report

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Execution Timestamp:** 2026-11-23T16:37:00+06:00 (Asia/Dhaka)  
**Classification:** Infrastructure as Code & Deployment Orchestration  
**Release Engineer:** Principal DevSecOps Architect  

---

## 1. Production Topology & Cloud Architecture

```
                                  [ User Browser / Mobile Client ]
                                                 │
                                 ┌───────────────┴───────────────┐
                                 │                               │
                          (HTTPS Next.js UI)             (HTTPS Core API)
                                 │                               │
                                 ▼                               ▼
                      ┌──────────────────────┐        ┌──────────────────────┐
                      │    Vercel Edge CDN   │        │     Render Web       │
                      │ (Frontend Workspace) │        │ (FastAPI ASGI Dyno)  │
                      │  Next.js 16.4.5 App  │        │   Python 3.12.10     │
                      └──────────────────────┘        └──────────┬───────────┘
                                                                 │
                                                                 │ (TLS 1.3 / Port 6543)
                                                                 ▼
                                                      ┌──────────────────────┐
                                                      │  Supabase PostgreSQL │
                                                      │    PgBouncer Pooler  │
                                                      │ (AWS ap-south-1 BOM) │
                                                      └──────────────────────┘
```

---

## 2. Infrastructure as Code (IaC) Deliverables

### 2.1 Backend — Render Blueprint (`render.yaml`)
Defined declarative service manifest at repository root:
- **Service Name:** `educationos-backend`
- **Runtime:** `python` (Python 3.12.10)
- **Region:** `singapore` (Minimizes network latency to Bangladesh users)
- **Branch:** `main`
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2 --proxy-headers --forwarded-allow-ips '*'`
- **Health Check Path:** `/healthz`
- **Environment Enforcements:**
  - `ENVIRONMENT=production`
  - `TIMEZONE=Asia/Dhaka`
  - `DEFAULT_TENANT_ID=1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31` (KSIS)
  - Auto-generated 256-bit `SECRET_KEY`

### 2.2 Frontend — Vercel Configuration (`frontend/vercel.json`)
Configured enterprise security headers and framework defaults:
- **Framework:** `nextjs`
- **Root Directory:** `frontend`
- **Build Command:** `next build --webpack`
- **Security Headers Enforced:**
  - `X-Frame-Options: SAMEORIGIN`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### 2.3 Container Isolation & Build Artifact Exclusions
Created three `.dockerignore` files preventing sensitive or build-heavy files from leaking into image layers:
1. `/.dockerignore`: Excludes `.git`, `.env*`, `venv`, `node_modules`, `backups`, `uploads`, `docs`.
2. `/backend/.dockerignore`: Excludes tests, docs, virtual environments, and SQLite files.
3. `/frontend/.dockerignore`: Excludes `.next`, `node_modules`, test files, and markdown documentation.

### 2.4 Continuous Integration Pipeline (`.github/workflows/ci.yml`)
Hardened GitHub Actions CI workflow:
- **Backend Job:** Python 3.12 compilation, Ruff lint gate (`E9,F63,F7,F82`), test import gate with synthetic `SECRET_KEY` and SQLite, tenant branding guard.
- **Frontend Job:** Node 20 runtime, `npm ci`, TypeScript typecheck (`npx tsc --noEmit`), ESLint, native unit test runner (`npm test`), and production static build (`npm run build`).

---

## 3. Operational Reliability & Concurrency

- **Connection Pool Bounding:** SQLAlchemy configured with QueuePool (size 10, max overflow 5, timeout 10s, recycle 1800s). Prevents PgBouncer connection leaks.
- **ASGI Process Model:** 2 worker processes handle asynchronous request pipelining.
- **Graceful Shutdown:** FastAPI lifespan handler shuts down database engines and stops orphan RAG ingestion sweeps cleanly on SIGTERM.
- **Health Probing:**
  - `/healthz`: Unauthenticated, lightweight 200 OK ping for Render/Vercel liveness probes.
  - `/api/v1/health`: Detailed subsystem diagnostics for authenticated monitoring.

---

## 4. Phase 4 Conclusion

Infrastructure configuration is fully reproducible, version-controlled, and aligned with the zero-unnecessary-spend principle. Approved for Phase 5 secrets inventory and Phase 6 release promotion.

