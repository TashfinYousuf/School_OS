# EducationOS — Production & Commercial Release Blockers
**Document ID:** `docs/RELEASE_BLOCKERS.md`  
**Generated:** 2026-11-11  
**Author:** Independent Release Auditor & DevOps Lead  
**Scope:** Strict Inventory of Operational, Technical, Legal & Commercial Blockers  

---

## 1. Executive Summary

In compliance with Rule 11 (*"Do not mark a stage complete until its acceptance criteria are independently demonstrated"*) and Rule 12 (*"Work sequentially. Do not start a later stage while an unresolved critical dependency blocks it"*), this document records the active gates and blockers preventing unrestricted general production release.

A **Pilot Launch (Kids Shine School)** may proceed in a controlled environment with documented manual processes; however, **General Commercial Production** remains gated by the blockers listed below.

---

## 2. Blockers Inventory

### BLK-01: Native PostgreSQL 17 Staging Rehearsal & RLS Policy Verification
- **Classification:** **TECHNICAL / DATABASE GATE (P0)**
- **Current Behavior:** All automated unit and integration tests run against isolated SQLite with PostgreSQL type emulation. The production Supabase database contains live migrations, but full drop/re-migration from scratch and native Row Level Security (RLS) catalog queries (`pg_class.relrowsecurity = true`) have not been rehearsed against a disposable PostgreSQL 17/18 instance.
- **Expected Behavior:** An automated test script spins up a clean, disposable PostgreSQL instance, executes `alembic upgrade head` from revision `d771a4257381` to `c4d5e6f7a8b9`, verifies table constraints, runs the multi-tenant isolation suite, and measures query latency.
- **Root Cause:** Absence of a dedicated throwaway PostgreSQL container in the development environment and prohibition of destructive DDL on live Supabase.
- **Affected Modules / Files:**
  - `backend/alembic/versions/`
  - `backend/alembic/env.py`
  - `backend/app/core/database.py`
  - `backend/tests/test_rls_isolation.py`
- **Security / Business Impact:** Risk of schema drift, unindexed foreign keys, or unexpected RLS permission denial during live customer onboarding.
- **Proposed Change:** Execute disposable PostgreSQL 18 rehearsal using local `/usr/local/bin/initdb` or staging container in Stage 8, then record full DDL and RLS evidence in `docs/POSTGRESQL_17_RELEASE_GATE.md`.
- **Regression Tests:** `tests/test_stage02_migrations.py` and `tests/test_stage04_tenant_isolation.py` running against native PostgreSQL.
- **Evidence Required:** Complete migration execution log with 0 errors and verified RLS catalog verification query.

---

### BLK-02: Owner Commercial Approval of Dynamic Pricing Rates & Multipliers
- **Classification:** **COMMERCIAL / BUSINESS GATE (P1)**
- **Current Behavior:** Pricing values on the website and backend are staged defaults (1,500 BDT base, 12 BDT/student, 15% annual discount) awaiting final ratification from the platform owner.
- **Expected Behavior:** Owner reviews `docs/COMMERCIAL_DECISION_REGISTER.md` and provides signed confirmation or adjusted values for the base fee, tier brackets, module costs, and annual discount rate.
- **Root Cause:** Prudent policy prohibiting agents from unilaterally setting SaaS product pricing.
- **Affected Modules / Files:**
  - `docs/COMMERCIAL_DECISION_REGISTER.md`
  - `frontend/lib/plans.ts`
  - `backend/app/services/pricing_engine.py`
- **Security / Business Impact:** Customer churn or revenue loss if published rates are economically unviable or unapproved by leadership.
- **Proposed Change:** Maintain staged configurable values with clear `"Draft / Pending Owner Approval"` badges in the UI until ratified.
- **Regression Tests:** Parameterized pricing calculation tests covering edge cases (0 students, 1 student, 300 students, 10,000 students).
- **Evidence Required:** Written confirmation or approval ticket from the product owner.

---

### BLK-03: Bangladesh Merchant Payment Gateway Credentials & Commercial Agreement
- **Classification:** **LEGAL & FINANCIAL GATE (P1)**
- **Current Behavior:** Payment service operates in simulation mode with mocked API calls for bKash, Nagad, and SSLCommerz.
- **Expected Behavior:** Official merchant trade license, BIN, TIN, bank merchant account, and signed API gateway contracts are acquired from bKash / SSLCommerz / Nagad.
- **Root Cause:** Legal incorporation and corporate banking onboarding cannot be performed autonomously by an AI assistant.
- **Affected Modules / Files:**
  - `backend/app/services/payment_providers.py`
  - `backend/app/api/endpoints/billing.py`
- **Security / Business Impact:** Inability to accept automated debit/credit card or MFS payments directly from public onboarding without manual review.
- **Proposed Change:** Default the pilot deployment to **Mode A (Low-cost manual reconciliation)** where payments are submitted via verified bank transfer / merchant bKash TrxID and reviewed by an admin. Mode B automated gateway will be gated behind merchant credential provisioning.
- **Regression Tests:** Automated tests for Mode A manual review lifecycle and audit logging.
- **Evidence Required:** Validated bank deposit or TrxID reconciliation audit record.

---

### BLK-04: Production Domain, DNS & Multi-Tenant Wildcard SSL Provisioning
- **Classification:** **INFRASTRUCTURE & DEVOPS GATE (P2)**
- **Current Behavior:** Application runs on local ports (FastAPI on 8000, Next.js on 3000) and staging hosts. Custom domains (`school.edu.bd`) and tenant subdomains (`kidsshine.educationos.com`) are architectural designs without live Cloudflare DNS delegation.
- **Expected Behavior:** Official domain (`educationos.com` or equivalent) registered, delegated to Cloudflare, with wildcard SSL certificates (`*.educationos.com`) configured for tenant routing.
- **Root Cause:** Domain purchase and DNS nameserver configuration require owner registrar credentials.
- **Affected Modules / Files:**
  - `docs/TENANT_DOMAIN_ARCHITECTURE.md`
  - `nginx/nginx.conf`
  - `docker-compose.prod.yml`
- **Security / Business Impact:** Schools cannot be issued live production URLs until DNS delegation is active.
- **Proposed Change:** Provide complete Nginx, Cloudflare, and Docker Compose configurations ready for single-command DNS cutover upon owner domain delegation.
- **Regression Tests:** Local Nginx reverse proxy test verifying Host header forwarding and sub-path routing.
- **Evidence Required:** Successful HTTPS handshake and valid SSL certificate verification.

---

### BLK-05: Isolation of Production Secrets from Staging/Dev
- **Classification:** **SECURITY & COMPLIANCE GATE (P0)**
- **Current Behavior:** Backend uses `.env` containing remote Supabase test credentials and local fallback secrets.
- **Expected Behavior:** Production deployment injects dedicated, cryptographically generated secrets (`SECRET_KEY`, `ALGORITHM`, `DATABASE_URL`, `ENCRYPTION_KEY`, `GEMINI_API_KEY`) via environment secrets manager (e.g. AWS Secrets Manager, Doppler, or Docker Swarm Secrets). Zero production credentials committed to Git.
- **Root Cause:** Early-stage development environment sharing configuration files.
- **Affected Modules / Files:**
  - `backend/.env`
  - `backend/app/core/config.py`
- **Security / Business Impact:** Potential unauthorized database access if development machines or repository archives are compromised.
- **Proposed Change:** Create sanitized `.env.production.example` and enforce runtime validation blocking startup if default or development secret keys are detected in production environment.
- **Regression Tests:** Startup validation test asserting that `SECRET_KEY` cannot be default in `ENVIRONMENT=production`.
- **Evidence Required:** Startup test log asserting `RuntimeError: Insecure default secret key detected in production mode`.

