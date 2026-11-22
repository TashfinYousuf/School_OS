# STAGE 11 & STAGE 12 — FINAL SECURITY RE-AUDIT REPORT
## Offline Synchronization & SaaS Billing Infrastructure

**Project:** EducationOS / SchoolOS Enterprise  
**Audit Scope:** Stage 11 (PWA & Offline Synchronization) + Stage 12 (SaaS Billing & Entitlements)  
**Document ID:** `STAGE_11_12_FINAL_SECURITY_REAUDIT.md`  
**Classification:** Application Security & Financial Cryptography Audit  
**Status:** **PASS — APPLICATION & TEST LAYER VERIFIED**  
**Audit Date:** November 8, 2026  

---

## 1. Executive Summary

This document presents a comprehensive, forensic security audit of EducationOS's offline synchronization subsystem (Stage 11) and SaaS subscription billing engine (Stage 12). 

As schools and academies in Bangladesh frequently operate over intermittent cellular connections (2G/3G/4G) and shared Android/Windows hardware, offline synchronization introduces critical attack vectors including **cache poisoning**, **PII leakage**, **cross-user mutation interception**, and **actor ID spoofing**. Concurrently, SaaS billing introduces high-risk financial vulnerabilities including **webhook replay**, **amount tampering**, **proration manipulation**, and **cross-tenant entitlement escalation**.

Both subsystems were subjected to rigorous threat modeling and penetration-style automated testing:
- **Offline Sync & Storage Security:** Verified fail-closed sensitive API cache bypass, URL normalization, multi-user IndexedDB quarantine, silent 401 token refresh vs dropping, 409 conflict handling, and server-side actor ID enforcement.
- **SaaS Billing & Webhook Security:** Verified server-authoritative pricing, HMAC-SHA256 signature verification, replay prevention via `(gateway, event_id)` uniqueness, strict currency/amount matching, and complete bounded context separation between student tuition and SaaS institutional billing.

**Audit Verdict:** Both Stage 11 and Stage 12 pass application-level security verification with **zero high-severity vulnerabilities**.

---

## 2. PART A — Offline Synchronization Security Audit (B2)

```
+---------------------------------------------------------------------------------------------------+
|                               OFFLINE MUTATION PIPELINE & TRUST BOUNDARY                          |
+---------------------------------------------------------------------------------------------------+
|  [Untrusted Browser Environment]                                                                  |
|  User UI -> Enqueue Mutation -> Client Mutation Sanitizer                                         |
|                                       │                                                           |
|             ┌─────────────────────────┴────────────────────────┐                                  |
|             ▼                                                  ▼                                  |
|  [Sensitive Data Check]                             [Tenant/User Partition Key]                   |
|  - Financial records? BLOCKED                       - key: `tenant_id:user_id:offline_queue`       |
|  - Student PII? BLOCKED                             - Logout -> Purge departing user partition    |
|  - Public syllabus? ALLOWED                         - Switch Tenant -> Quarantine previous        |
|                                                                                                   |
|  ──────────────────────────── Network Reconnect Boundary ───────────────────────────────────────  |
|                                                                                                   |
|  [Replay Engine]                                                                                  |
|  - Check JWT Claims (sub, tenant_id) -> Strip client-supplied user_id/tenant_id                   |
|  - If HTTP 401 -> Mutexed Refresh Token Exchange -> Retry once; if failed -> Purge & Drop         |
|  - If HTTP 409 -> Quarantine to REQUIRES_MANUAL_REVIEW (Never loop; alert admin)                  |
|  - If HTTP 4xx -> Permanent client error -> Mark REJECTED & Dead-letter                           |
|  - If HTTP 5xx -> Exponential backoff with jitter (Max 5 attempts)                               |
+---------------------------------------------------------------------------------------------------+
```

### 2.1 Sensitive API Cache Bypass & Quarantine
- **Threat Vector:** Browsers and Service Workers caching sensitive student financial records, parent contact details, or credentials in unencrypted HTTP caches or IndexedDB, accessible via local device inspection on shared school computers.
- **Mitigation Implemented:**
  1. `frontend/lib/offline/offlineCacheManager.ts` implements a strict **allowlist-only** caching policy.
  2. Public and academic read models (e.g. `/api/v1/academic/curriculum`, `/api/v1/institution/branding`) are permitted.
  3. All requests matching `/api/v1/finance/`, `/api/v1/billing/`, `/api/v1/guardians/`, `/api/v1/students/`, `/api/v1/auth/`, or containing `token` / `credentials` explicitly trigger a `SecurityViolationError` if caching is attempted.
  4. In `frontend/public/sw.js`, runtime fetch handlers inspect request URLs and bypass Cache API completely for any mutation method (`POST`, `PUT`, `PATCH`, `DELETE`) and all endpoints containing `/api/`.
- **Verification Evidence:** `frontend/tests/test_stage11_offline.test.ts` asserts that attempts to cache fee receipts or student PII throw `SecurityViolationError: Sensitive data quarantine violation`.

### 2.2 URL Normalization & Cache Key Poisoning Defense
- **Threat Vector:** Attackers manipulating URL casing, query parameter permutations, or trailing slashes (e.g., `/api/v1/Finance/Invoices?` vs `/api/v1/finance/invoices`) to evade cache bypass filters.
- **Mitigation Implemented:**
  - `normalizeCacheUrl(rawUrl)` performs canonical RFC 3986 URL parsing:
    1. Lowers protocol and hostname to lowercase.
    2. Strips URL fragments (`#`).
    3. Normalizes directory slashes and removes duplicate slashes.
    4. Alphabetically sorts query parameters.
    5. Evaluates regex matchers against the normalized canonical path.

### 2.3 Multi-User & Multi-Tenant Storage Quarantine
- **Threat Vector:** Multiple teachers or staff members sharing a single tablet or computer in a school staff room. Teacher A logs out; Teacher B logs in. If offline mutation queues or cached data are stored in a global `localStorage` or shared IndexedDB namespace, Teacher B could view or replay Teacher A's operations.
- **Mitigation Implemented:**
  1. Offline mutation queues and caches are keyed by `tenant_id:user_id:offline_queue`.
  2. On logout (`clearSession()` in `frontend/lib/api-client.ts`), all session tokens (`token`, `access_token`, `refresh_token`, `tenant_id`, `user_role`) are removed from memory and storage.
  3. `offlineQueue.clearUserQueue(userId, tenantId)` explicitly purges the departing user's queue without destroying offline data belonging to other accounts that may safely share the device.
- **Verification Evidence:** `frontend/tests/test_stage11_offline.test.ts` (Section 2) validates that two users on the same tenant have independent queues, two tenants have zero queue overlap, and logout purges only the active user's partition.

### 2.4 Silent 401 Token Refresh vs Session Dropping
- **Threat Vector:** When reconnecting after being offline for hours, the user's short-lived JWT access token has expired. Blindly firing queued mutations will result in HTTP 401 cascades. If unhandled, mutations might be dropped or infinite refresh loops triggered.
- **Mitigation Implemented:**
  1. `frontend/lib/api-client.ts` intercepts HTTP 401 responses.
  2. If a valid `refresh_token` exists, a single synchronized refresh request (`POST /api/v1/auth/refresh`) is executed with request queuing for concurrent requests.
  3. If refresh succeeds, new access tokens are saved and failed mutations are re-executed transparently.
  4. If refresh fails (e.g. token revoked on server), the session is purged immediately (`clearSession()`), and all pending authenticated mutations are placed in `QUARANTINE_EXPIRED_AUTH` rather than endlessly retrying.

### 2.5 409 Conflict Handling & Non-Destructive Resolution
- **Threat Vector:** Teacher A marks student attendance offline. Meanwhile, Admin B updates student status online. When Teacher A reconnects, replaying the offline mutation causes a database concurrency collision (HTTP 409 Conflict). Overwriting blindly destroys administrative audit records; infinite retries lock the sync engine.
- **Mitigation Implemented:**
  1. Permanent client errors (HTTP 400, 403, 404, 422) are marked `REJECTED` and removed from the active queue to avoid poison pill loops.
  2. HTTP 409 Conflict transitions the mutation to `REQUIRES_MANUAL_REVIEW`.
  3. The conflict is recorded in IndexedDB with both the local mutation payload and server conflict response, and surfaced on the `/offline` UI hub for staff review.
- **Verification Evidence:** `frontend/tests/test_stage11_offline.test.ts` (Section 3) verifies that 409 errors transition to manual review and do not enter retry loops.

### 2.6 Actor ID Spoofing Prevention
- **Threat Vector:** A malicious client tampering with the offline queue in IndexedDB to forge `user_id`, `tenant_id`, or `created_by` attributes before the mutation is sent over the wire.
- **Mitigation Implemented:**
  - The backend FastAPI dependency `get_current_tenant_id` and `get_current_user` extracts identity **exclusively from cryptographically verified JWT claims** (`sub`, `tenant_id`, `role`).
  - Client-supplied `tenant_id` or `user_id` inside mutation body payloads is discarded and overridden by server-side authenticated context.

---

## 3. PART B — SaaS Billing & Payment Security Verification (B3)

```
+---------------------------------------------------------------------------------------------------+
|                                SAAS BILLING GATEWAY TRUST BOUNDARY                                |
+---------------------------------------------------------------------------------------------------+
|  [External Payment Gateway (bKash / Nagad / SSLCommerz / Stripe)]                                 |
|                                       │                                                           |
|                                       ▼ Webhook HTTP POST                                         |
|  [EducationOS Edge / Ingress]                                                                     |
|  1. Verify Raw Body HMAC-SHA256 Signature (`X-Webhook-Signature` / `stripe-signature`)            |
|     -> Signature Invalid? Return HTTP 401 Unauthorized (Reject payload immediately!)              |
|                                       │ Signature Valid                                           |
|                                       ▼                                                           |
|  2. Atomic Replay Check (`BillingWebhookEvent`)                                                   |
|     -> Query UNIQUE(gateway, event_id)                                                            |
|     -> Already processed? Return HTTP 200 OK (Idempotent ignore, prevent double-crediting)         |
|                                       │ Unprocessed Event                                         |
|                                       ▼                                                           |
|  3. Currency & Amount Validation                                                                  |
|     -> Compare invoice.amount vs payload.amount (Exact Decimal Match, e.g. 2490.00 == 2490.00)     |
|     -> Compare invoice.currency vs payload.currency (Exact match: BDT == BDT)                     |
|     -> Mismatch? Transition to UNCOLLECTIBLE / AUDIT_FLAG (Reject plan activation!)               |
|                                       │ Amount Validated                                          |
|                                       ▼                                                           |
|  4. Single Database ACID Transaction                                                              |
|     - Mark BillingWebhookEvent.processed = True                                                   |
|     - Mark BillingInvoice.status = 'PAID', paid_at = now                                          |
|     - Extend InstitutionSubscription.valid_until = valid_until + 1 month / 1 year                 |
|     - Refresh TenantEntitlement records                                                           |
|     - Append to BillingAuditLog (Actor: gateway_webhook)                                          |
+---------------------------------------------------------------------------------------------------+
```

### 3.1 Gateway Verification Workflows
EducationOS interfaces with Bangladesh and international payment rails under strict zero-trust principles:

| Payment Provider | Integration Pattern | Validation Mechanism | Key Material Isolation |
|---|---|---|---|
| **bKash Tokenized** | Server-to-Server Checkout | Query / Execute API with `paymentID` verification | `BKASH_APP_KEY`, `BKASH_APP_SECRET` isolated in env |
| **SSLCommerz** | Hosted Payment & IPN | Server-side IPN validation via `val_id` verification API | `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWD` |
| **Nagad** | Gateway Redirect | Cryptographic signature verification using public key | `NAGAD_PUBLIC_KEY`, `NAGAD_PRIVATE_KEY` |
| **Stripe** | Embedded Checkout | `stripe.Webhook.construct_event(payload, sig, secret)` | `STRIPE_WEBHOOK_SECRET` |

### 3.2 Webhook Atomicity, Idempotency & Replay Defense
- **Threat Vector:** Network timeouts causing payment gateways to dispatch duplicate webhook notifications (at-least-once delivery). If an endpoint lacks idempotency, an institution could receive multiple months of validity for a single payment.
- **Mitigation Implemented:**
  1. The database table `billing_webhook_events` enforces a PostgreSQL unique constraint on `(gateway, event_id)`:
     ```sql
     CONSTRAINT uq_billing_webhook_gateway_event UNIQUE (gateway, event_id)
     ```
  2. In `backend/app/api/endpoints/billing.py`:
     - The webhook endpoint verifies HMAC-SHA256 signature using `hmac.compare_digest`.
     - It checks whether `event_id` was previously recorded. If already processed, it immediately returns `{"status": "already_processed"}` with HTTP 200, terminating further execution without altering subscriptions.
     - If new, the event recording, invoice settlement, subscription extension, and audit log generation execute within **one single database transaction (`db.commit()`)**. If any step fails, the entire transaction rolls back.
- **Verification Evidence:** `backend/tests/test_stage12_subscription_billing.py` (Tests 4 & 5) verifies tamper rejection on altered payloads and idempotent duplicate handling.

### 3.3 Server-Side Authoritative Pricing & Tamper Protection
- **Threat Vector:** Malicious users modifying client-side JavaScript or intercepting checkout requests to alter subscription prices (e.g. submitting BDT 10 instead of BDT 2,490).
- **Mitigation Implemented:**
  1. The checkout endpoint (`POST /api/v1/billing/checkout`) accepts **only** `plan_code` and `billing_cycle`.
  2. Pricing is retrieved strictly from the database (`SubscriptionPlan` and `PlanVersion`). Client-supplied amounts are never accepted.
  3. Annual billing discount (10 months charged for 12 months) is computed deterministically on the server:
     `price = monthly_price * 10`.
  4. Active student capacity limit is validated at checkout: if current active students exceed the target plan's `max_active_students`, checkout is blocked with HTTP 400.
- **Verification Evidence:** `backend/tests/test_stage12_subscription_billing.py` (Tests 2 & 3) asserts server-side pricing and capacity checks.

### 3.4 Bounded Context Separation: SaaS Billing vs Student Tuition
- **Threat Vector:** Mixing SaaS institutional subscription payments with internal school tuition fees, allowing tenant administrators to manipulate platform invoices or polluting accounting ledgers.
- **Mitigation Implemented:**
  1. **Model Segregation:**
     - Student Tuition: `app.models.finance.Invoice`, `fee_payments` (scoped to individual students and school classes).
     - Platform SaaS Billing: `app.models.billing.BillingInvoice`, `billing_invoice_line_items`, `subscription_payments` (scoped to institutional tenant subscription).
  2. **API Endpoint Segregation:**
     - Student Tuition: `/api/v1/finance/invoices`, `/api/v1/finance/collect-fee`.
     - Platform SaaS Billing: `/api/v1/billing/invoices`, `/api/v1/billing/checkout`.
  3. **Permission Segregation:**
     - Student Tuition: guarded by `FEE_COLLECTION_MANAGE`, `FINANCE_VIEW`.
     - Platform SaaS Billing: guarded strictly by `TENANT_ADMIN` role and `require_active_subscription`.
- **Verification Evidence:** `backend/tests/test_stage12_subscription_billing.py` (Test 6) explicitly asserts bounded context separation.

---

## 4. Threat Matrix & Residual Risk Summary

| Category | Vulnerability Inspected | Mitigation Architecture | Automated Test | Status |
|---|---|---|---|---|
| **PWA Cache** | Financial / PII cached in ServiceWorker | Allowlist-only caching; strict URL blocklist | `test_stage11_offline.test.ts` | **MITIGATED** |
| **Offline Auth** | Replaying mutations after token revocation | Synchronized token refresh; immediate session drop on 401 fail | `test_stage07_frontend.test.ts` | **MITIGATED** |
| **Offline Concurrency** | Concurrency conflicts causing data loss | HTTP 409 quarantined to manual review | `test_stage11_offline.test.ts` | **MITIGATED** |
| **Billing Gateway** | Tampered webhook payload | HMAC-SHA256 signature verification | `test_stage12_subscription_billing.py` | **MITIGATED** |
| **Billing Gateway** | Replay of valid webhook | Unique `(gateway, event_id)` constraint + idempotency check | `test_stage12_subscription_billing.py` | **MITIGATED** |
| **Pricing Integrity** | Client-manipulated checkout amounts | Database-driven server-side pricing engine | `test_stage12_subscription_billing.py` | **MITIGATED** |
| **Domain Integrity** | Student fees mixed with SaaS invoices | Strict bounded context separation across models and APIs | `test_stage12_subscription_billing.py` | **MITIGATED** |

---

## 5. Conclusion & Security Sign-Off

The security architecture of Stage 11 (Offline Synchronization) and Stage 12 (SaaS Subscription Billing) satisfies enterprise security and financial integrity standards. No architectural or implementation bypasses were identified.

**Audit Status:** **PASS (APPLICATION LAYER VERIFIED)**

