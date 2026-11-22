# EducationOS — Next Stage Execution Roadmap
**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/NEXT_STAGE_EXECUTION_ROADMAP.md`  
**Governing Principle:** Sequential, Evidence-Driven Enterprise Expansion  
**Current Baseline:** Stages 01–12, 12.5.1–12.5.9 Fully Accepted & Verified  
**Current Gate Status:** Core Pilot Personas Verified; Native PostgreSQL Gate Remains BLOCKED  

---

## 1. Executive Phasing Overview

Following the successful acceptance of **Stage 12.5.6 (Core Product Gaps)**, **Stage 12.5.7 (Pricing Architecture Governance)**, **Stage 12.5.8 (Content Truthfulness)**, and **Stage 12.5.9 (E2E Pilot Personas)**, EducationOS is stabilized for controlled institutional pilot usage.

The following sequential roadmap governs subsequent commercial, performance, operations, staging, and security stages:

```
[Stages 12.5.6 - 12.5.9] (COMPLETED & ACCEPTED)
          │
          ▼
    [Stage 12.6] Commercial Billing & Payment Infrastructure (P2)
          │
          ▼
    [Stage 12.7] Performance & Scalability Engineering (P2)
          │
          ▼
    [Stage 12.8] Support & Institutional Operations (P2)
          │
          ▼
    [Stage 13] Staging & Database Release Engineering (P2) — UNBLOCK PG GATE
          │
          ▼
    [Stage 14] Security & Compliance Readiness (P2)
```

---

## 2. Stage-by-Stage Technical Specifications

### 2.1 Stage 12.6: Commercial Billing and Payment Infrastructure (Priority: P2)
- **Objective:** Operationalize commercial SaaS subscription billing and prepare domestic payment gateway adapters for live deployment.
- **Prerequisites:** Formal operator approval of `docs/PRICING_APPROVAL_REQUIRED.md`.
- **Key Deliverables:**
  1. **Canonical Pricing Engine Execution:**
     - Activate the hybrid usage-based calculation engine in `backend/app/services/entitlement.py` and `frontend/lib/plans.ts`.
     - Ingestion of billable active student counts snapshot per billing period.
     - Enforce 10-month charge formula for annual upfront billing.
  2. **Payment Gateway Sandbox Adapters:**
     - Prepare sandboxed adapters for bKash Tokenized Checkout, Nagad, and SSLCommerz.
     - Implement HMAC-SHA256 signature verification and replay protection on IPN webhooks.
     - Ensure absolute bounded-context separation between EducationOS platform subscription invoices and institutional student tuition fee receipts.
  3. **Subscription Lifecycle & Dunning:**
     - Verify state machine transitions: `ACTIVE` → `PAST_DUE` → `GRACE_PERIOD` → `SUSPENDED`.
     - Scheduled cron sweep verifying idempotent invoice reconciliation.

---

### 2.2 Stage 12.7: Performance and Scalability (Priority: P2)
- **Objective:** Benchmark and optimize system responsiveness under multi-tenant institutional loads.
- **Key Deliverables:**
  1. **Database Query Profiling & Index Optimization:**
     - Profile composite queries on `attendance_records(tenant_id, class_name, date)` and `student_results(tenant_id, exam_term, student_id)`.
     - Evaluate index coverage for foreign key lookups and tenant filtering.
  2. **Streaming & Export Optimization:**
     - Ensure large class attendance rosters and grade ledgers stream directly without memory exhaustion.
  3. **Offline Sync Concurrency Testing:**
     - Benchmark concurrent offline sync submissions from multiple teachers synchronizing simultaneously upon reconnection.
  4. **Frontend Bundle & LCP Optimization:**
     - Validate Next.js chunking, PWA caching budgets, and responsive image loading across low-bandwidth 3G mobile connections.

---

### 2.3 Stage 12.8: Support and Institutional Operations (Priority: P2)
- **Objective:** Establish the essential support foundation for institutional pilot administrators.
- **Key Deliverables:**
  1. **Support Request Intake:**
     - Admin-accessible support ticket submission directly from the dashboard.
     - Categorization: Academic, Finance/Billing, Attendance, Account Access, Bug Report.
  2. **Operational Runbooks:**
     - Step-by-step incident resolution guides for school IT coordinators.
     - Tenant-isolated data export and audit log extraction procedures.

---

### 2.4 Stage 13: Staging and Release Engineering (Priority: P2)
- **Objective:** Unblock the PostgreSQL Release Gate via a disposable staging environment and prepare production deployment pipelines.
- **Current Blocker:** `Database Release Gate: BLOCKED — Disposable PostgreSQL unavailable in local environment`.
- **Key Deliverables:**
  1. **Disposable Staging PostgreSQL Environment:**
     - Provision an isolated disposable PostgreSQL 17 instance matching Supabase production kernel configuration.
     - Execute complete Alembic upgrade sequence (`alembic upgrade head`) from a clean slate.
  2. **Native RLS Policy & Pooler Verification:**
     - Run `test_rls_isolation.py` and OWASP regression tests against native PostgreSQL with Supabase pooler compatibility.
     - Verify `SET LOCAL app.current_tenant_id` propagation under connection pooling.
  3. **Release Smoke Tests & Rollback Rehearsal:**
     - Document migration rollback rehearsals (`alembic downgrade -1`).
     - Formal release sign-off checklist and environment health probes.

---

### 2.5 Stage 14: Security and Compliance Readiness (Priority: P2)
- **Objective:** Finalize institutional enterprise security controls and compliance audit documentation.
- **Key Deliverables:**
  1. **Comprehensive Application Security Review:**
     - Re-audit BOLA, IDOR, tenant isolation, and session rotation across all public and authenticated endpoints.
     - Verify rate-limiting enforcement on password resets and login routes.
  2. **ISO/IEC 27001 Gap Assessment:**
     - Prepare documented control readiness matrices for access control, cryptography, operations security, and incident management.
  3. **Privacy & Data Sovereignty Policy:**
     - Publish tenant data retention, deletion, and export policies ensuring institutional ownership of student and family records.

---

## 3. Stop Conditions & Quality Gates

1. **No Gateway Activation Without Credentials:** Do not activate live bKash/Nagad payments without verified merchant accounts and signed operator approval.
2. **No Production DDL Without Backup & Staging Test:** Never execute DDL migrations against live production databases without testing on a disposable staging instance first.
3. **Preserve Tested Persona Workflows:** No changes in Stages 12.6–14 may break the 5 verified persona workflows established in Stage 12.5.9.

