# Phase 0: Baseline Forensics & Repository Discovery Report

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Local Root:** `/Users/tashfinyousuf/Python/SCHOOL_OS`  
**Execution Timestamp:** 2026-11-23T12:25:00+06:00 (Asia/Dhaka)  
**Release Engineer:** Principal Release Engineer & DevSecOps Auditor  

---

## 1. Git Repository State & Baseline Alignment

| Parameter | Observed Value | Match Expected? | Notes |
|---|---|---|---|
| **Active Branch** | `main` | YES | Aligned with production deployment branch |
| **Current HEAD SHA** | `d54546011d0316836be8c6676a3106d111738686` | YES | Matches reported RC4 baseline commit `d545460` |
| **Remote Tracking** | `origin/main` | YES | In exact sync with remote HEAD |
| **Remote URL** | `https://github.com/TashfinYousuf/School_OS.git` | YES | Public GitHub repository |
| **Working Tree Status** | Clean (10 docs whitespace modifications) | YES | Unstaged docs contain only newline normalization |
| **Untracked Files** | None | YES | Zero unmanaged/stray files in repository root |

### Recent Git Log (Last 5 Commits)
1. `d545460` - *fix(release): resolve P0 backend 500s, add guardian fee summary, polish tenant branding and bilingual i18n* (HEAD -> main, origin/main)
2. `04e826a` - *feat(iam): complete student and guardian portal onboarding workflows and admin management*
3. `4e24e29` - *feat(rag): add useIngestionJob client hook*
4. `70f276b` - *feat(rag): add ingestion lifecycle guard, orphan job sweeping, and embedding throttle*
5. `c622b69` - *docs(pilot-uat): complete 20-report master institutional UAT and release audit*

---

## 2. Infrastructure & Deployment Discovery

### 2.1 Existing Deployment Assets
- **Docker Compose Production:** `docker-compose.prod.yml` defines 6 services:
  - `backend`: FastAPI Python 3.12-slim ASGI service (port 8000).
  - `rag_worker`: Asynchronous curriculum ingestion worker (`python -m app.workers.rag_worker`).
  - `outbox_worker`: Reliable notification & communication outbox dispatcher (`python -m app.workers.outbox_worker`).
  - `frontend`: Next.js 16.4.5 standalone container (port 3000).
  - `nginx`: Reverse proxy with TLS termination and Let's Encrypt certbot integration.
  - `certbot`: Automated TLS certificate renewal sidecar.
- **Backend Containerfile:** `backend/Dockerfile` multi-stage build:
  - Builder: `python:3.12-slim`, builds wheel dependencies.
  - Runner: Non-root user `appuser` (UID 1001), healthcheck against `http://localhost:8000/healthz`.
- **Frontend Containerfile:** `frontend/Dockerfile` multi-stage build:
  - Builder: `node:20-alpine`, builds standalone Next.js bundle.
  - Runner: Non-root user `nextjs` (UID 1001), healthcheck against `http://localhost:3000/`.
- **Deployment Script:** `deploy.sh` handles rolling zero-downtime updates via Docker Compose.

### 2.2 CI/CD Pipeline Discovery
- **GitHub Actions Workflows:**
  - `.github/workflows/ci.yml`:
    - Backend Gate: Python 3.12 compilation, Ruff lint (`E9,F63,F7,F82`), test import check with synthetic `SECRET_KEY` and SQLite, tenant branding guard `backend/scripts/check_hardcoded_tenant.sh`.
    - Frontend Gate: Node 20 installation, `npm ci`, TypeScript `npx tsc --noEmit`, ESLint, unit tests, and production build `npm run build`.
  - `.github/workflows/keep-alive.yaml`:
    - Scheduled CRON job (`0 0 */3 * *`) pinging Supabase REST API via `SUPABASE_URL` and `SUPABASE_ANON_KEY` to prevent project pausing.

---

## 3. Database Architecture & Alembic Lineage

- **Database Engine:** PostgreSQL via Supabase Pooler (`aws-1-ap-south-1.pooler.supabase.com:6543`).
- **Connection Configuration:** SSL required (`sslmode=require`), PgBouncer transaction pooling.
- **Alembic Configuration:** `backend/alembic.ini` and `backend/alembic/env.py`.
- **Current Alembic Head:** `f8a9b0c1d2e3` (*storage_auth_security_and_outbox*).
- **Migration History:** 22 chronological migrations from `d771a4257381_initial_schoolos_schema.py` through `f8a9b0c1d2e3`.
- **Row-Level Security (RLS) Status:** Dedicated migrations exist (`a2b3c4d5e6f7`, `c4d5e6f7a8b9`, `cedb24c053f7`, `xxxx_enforce_native_rls.py`) implementing RLS policies alongside application-level multi-tenant filters.

---

## 4. Application Architecture Summary

- **Backend Stack:**
  - FastAPI 0.115+
  - SQLAlchemy 2.0+ with session lifecycle helpers in `app/core/db_utils.py`
  - Pydantic v2 schemas and validation models
  - PyJWT + Argon2/Bcrypt password hashing with rate limiting and session revocation
  - Gemini AI Client integration via `app/core/ai_client.py`
- **Frontend Stack:**
  - Next.js 16.4.5 (App Router)
  - React 19.3.1
  - Tailwind CSS v4.3.3
  - Lucide React icons
  - Custom i18n translation system supporting English (`en`) and Bengali (`bn`)
  - Offline mutation queue and PWA service worker infrastructure

---

## 5. Baseline Forensics Verdict

The repository is fully accounted for at commit `d545460`, verified against remote `origin/main`, with clean git hygiene and existing automated test suites passing. Baseline forensics is complete and verified. Ready to proceed to **Phase 1: Full Security Audit**.

