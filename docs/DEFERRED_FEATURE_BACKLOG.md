# EducationOS — Deferred Feature Backlog & Scope Governance
**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/DEFERRED_FEATURE_BACKLOG.md`  
**Governing Policy:** Sequential Enterprise Reconstruction & Readiness-Driven Release Governance  
**Date:** November 2026  
**Status:** **ACTIVE / FROZEN FOR INSTITUTIONAL PILOT**  

---

## 1. Executive Policy on Feature Deferral

To ensure absolute operational reliability, data integrity, and security for the **Kids Shine School Institutional Pilot**, non-essential commercial SaaS automation and unverified third-party integrations are formally deferred.

**Core Principles:**
1. **Readiness Over Calendar Pressure:** Release decisions are governed strictly by verified functional, data integrity, and security criteria, not artificial calendar deadlines.
2. **Preservation of Existing Architecture:** No working codebase or migration will be deleted. Rather, deferred capabilities remain dormant behind feature toggles or configuration flags until their prerequisites are fulfilled.
3. **Core Domain Focus:** Engineering priorities remain locked on operational school workflows: daily attendance lifecycle, student roster management, parent communication, academic routine scheduling, NCTB grading, and cash counter fee accounting.

---

## 2. Deferred Feature Inventory

| Feature ID | Feature Name & Domain | Priority | Target Milestone | Reason for Deferral | Prerequisite Dependencies |
|:---:|:---|:---:|:---:|:---|:---|
| **DEF-01** | **Live Online Payment Gateway Activation (bKash, Nagad, SSLCommerz)** | P2 | Stage 12.6 | Commercial merchant credentials, IPN webhooks, and live transaction settlements must be verified in an authorized merchant staging environment. The pilot operates with verified cash counter receipts and pre-allocated institutional subscription. | Merchant agreement execution, webhook HMAC validation, operator authorization. |
| **DEF-02** | **Public Self-Serve Tenant Provisioning** | P2 | Stage 12.6 | Open automated tenant creation risks spam and resource exhaustion. Initial pilot deployment uses controlled institutional onboarding. | Operator review queue, verified database migrations, rate limiting. |
| **DEF-03** | **Automated Dunning & Involuntary Suspension** | P2 | Stage 12.6 / 12.8 | Automated suspension workers must not lock out school operators during initial adoption trials. | Background worker daemon, transactional email/alert delivery. |
| **DEF-04** | **Commercial Module Marketplace** | P2 | Stage 12.6 | Self-service purchasing of modular add-ons is unnecessary for core school operations. | Canonical pricing engine approval, payment gateway activation. |
| **DEF-05** | **Multi-Currency Invoicing (USD, EUR, GBP)** | P3 | Stage 14 | Domestic Bangladesh institutional pilots operate in BDT with integer minor units. | Multi-currency ledger models, exchange rate API. |
| **DEF-06** | **Real-Time WebRTC Voice AI Lesson Streaming** | P3 | Post-Pilot (Stage 13) | Audio streaming incurs high token costs and network overhead; unnecessary for core academic records. | Dedicated audio gateway, quota controls. |
| **DEF-07** | **Semantic RAG with pgvector Embeddings** | P3 | Post-Pilot (Stage 13) | Standard NCTB textbooks are already indexed in structured formats; vector similarity search can be activated later. | pgvector extension on PostgreSQL, chunk embedding pipeline. |
| **DEF-08** | **Prometheus & Grafana Enterprise Telemetry** | P2 | Stage 13 | Structured application logging and health check endpoints provide sufficient operational visibility for initial pilot workloads. | Telemetry container orchestration. |
| **DEF-09** | **Native Mobile Applications (Flutter / iOS / Android)** | P3 | Post-Stage 14 | The PWA with offline Service Worker support satisfies mobile requirements for teachers and guardians. | App Store / Play Store developer accounts, CI build runners. |

---

## 3. Detailed Scope & Reactivation Criteria

### 3.1 DEF-01: Live Payment Gateway Checkout
- **Current State:** Payment provider adapters exist in `backend/app/services/payment_providers.py` supporting signature hashing and checkout URLs.
- **Why Deferred:** Activating live payment processing in production requires real merchant credentials, live callback IPNs, and rigorous settlement auditing. Attempting this prematurely introduces financial and legal risks.
- **Pilot Strategy:** The pilot institution operates with an active institutional subscription (`InstitutionSubscription`), and fee dues are tracked via the double-entry cash counter ledger.
- **Reactivation Gate:** Stage 12.6 authorization with verified sandbox and production merchant keys.

---

### 3.2 DEF-02: Self-Serve Tenant Provisioning
- **Current State:** `/onboard` renders a clean marketing intake form capturing school name, EIIN, contact email, and student count.
- **Why Deferred:** Automated schema creation without human oversight could allow unauthorized actors to exhaust database connection pools.
- **Pilot Strategy:** The pilot school tenant is provisioned via an authorized administration onboarding runbook.
- **Reactivation Gate:** Stage 12.6 with rate limiting, email verification, and CAPTCHA protection.

---

### 3.3 DEF-03: Dunning & Grace Period Auto-Suspension
- **Current State:** `backend/app/services/entitlement.py` contains state machine logic for transitioning subscriptions from `ACTIVE` → `PAST_DUE` → `GRACE_PERIOD` → `SUSPENDED`.
- **Why Deferred:** Involuntary suspension during a live pilot could disrupt classroom attendance or examination marks entry due to a software configuration glitch.
- **Pilot Strategy:** Automatic suspension is disabled for the pilot tenant; `valid_until` is set to December 31, 2026.
- **Reactivation Gate:** Commercial launch (Stage 12.8) with automated SMS/email warning workflows.

---

### 3.4 DEF-04: Module Marketplace
- **Current State:** `/features` catalog presents available modules with category badges.
- **Why Deferred:** Core features (students, attendance, exams, fees) are enabled by default for the pilot license.
- **Reactivation Gate:** Stage 12.6 Module Commerce release.

---

## 4. Architectural Safeguards During Deferral

To ensure deferred features do not pollute the pilot user experience:
1. **No Broken Links:** Any public reference to deferred features displays an informative "Pilot Preview" or "Contact Campus Sales" badge.
2. **Code Integrity:** All deferred endpoints remain intact in the codebase; they are not deleted, preventing code churn or regression.
3. **Clean Logging:** Deferred features do not emit noisy warning logs or trigger unhandled background timers.
