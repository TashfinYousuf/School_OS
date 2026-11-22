# Stage 12: Subscription, Billing & Entitlement Infrastructure Acceptance Report

**Project:** EducationOS (SchoolOS Enterprise)  
**Stage:** 12 — SaaS Subscription, Billing & Entitlement Infrastructure  
**Status:** **ACCEPTED & PASSED**  
**Gate Evaluation:** **PASS**  
**Author:** Principal Software Architect & QA Lead  
**Date:** 2026-11-08  

---

## 1. Executive Summary

Stage 12 establishes a hardened, enterprise-grade SaaS subscription billing and feature entitlement engine for EducationOS.

Prior to Stage 12, subscription licensing relied on a basic `InstitutionSubscription` table lacking lifecycle states (such as dunning, grace periods, and non-destructive suspension), had no separation between student tuition invoices and software licensing invoices, offered no replay protection against duplicate payment gateway callbacks, and lacked dynamic server-side feature entitlement enforcement.

In Stage 12, the SaaS commercial architecture was reconstructed with:
1. **Absolute Bounded-Context Segregation:** Clear domain boundary separating Academic Finance (`FeePayment`, `Invoice`, `InvoiceLineItem` in `app/models/finance.py` for student tuition) from SaaS Software Billing (`SubscriptionPlan`, `PlanVersion`, `BillingInvoice`, `BillingInvoiceLineItem`, `BillingWebhookEvent`, `TenantEntitlement`, `BillingAuditLog` in `app/models/billing.py`).
2. **Fixed-Precision Monetary Calculations & Proration:** Monetary values strictly enforce `Numeric(12, 2)` / `Decimal` precision with explicit BDT currency. Mid-cycle plan upgrades compute day-precise unused credit deducted from new plan fees.
3. **Cryptographic Webhook Security & Replay Protection:** Webhooks from payment gateways (bKash, Nagad, SSLCommerz) require HMAC-SHA256 signature verification. Replay attacks are defeated by storing provider event IDs in `BillingWebhookEvent` under a unique `(gateway, event_id)` constraint.
4. **Subscription Lifecycle State Machine & Dunning:** Deterministic transitions: `TRIALING` -> `ACTIVE` -> `PAST_DUE` -> `GRACE_PERIOD` (7 days) -> `SUSPENDED` -> `EXPIRED`.
5. **Non-Destructive Suspension Invariant:** When a subscription is suspended for non-payment, institutional data is never destroyed; core read operations (student directory, report cards, school profiles) remain accessible while premium write features are blocked.
6. **Feature Entitlement Gating & Quota Service:** `EntitlementService` resolves feature access hierarchically across plan matrices, lifecycle states, and explicit `TenantEntitlement` overrides, paired with atomic quota verification (`ai_questions`, `active_students`).

---

## 2. Architecture & Domain Modeling

### 2.1 Bounded-Context Domain Model (`backend/app/models/billing.py`)

| Model | Table Name | Purpose & Invariants |
|---|---|---|
| `SubscriptionPlan` | `subscription_plans` | Authoritative pricing catalogue (code, tier, BDT price, quotas, features) |
| `PlanVersion` | `plan_versions` | Immutable version snapshots preserving terms for existing active subscribers |
| `BillingInvoice` | `billing_invoices` | Immutable SaaS software license invoices (unique `INV-SAAS-YYYY-XXXX` numbering) |
| `BillingInvoiceLineItem` | `billing_invoice_line_items` | Itemised subscription fee, upgrade proration, or add-ons |
| `BillingWebhookEvent` | `billing_webhook_events` | Append-only ledger of verified gateway webhook callbacks with unique `(gateway, event_id)` |
| `TenantEntitlement` | `tenant_entitlements` | Granular per-tenant feature overrides and custom resource quotas |
| `BillingAuditLog` | `billing_audit_logs` | Tamper-evident operational audit trail capturing all state transitions and plan changes |

### 2.2 Subscription Lifecycle State Machine

```
              ┌───────────────┐
              │   TRIALING    │
              └───────┬───────┘
                      │ (Trial ends without payment)
                      ▼
              ┌───────────────┐
  Payment ───►│    ACTIVE     │◄──── Reactivated
              └───────┬───────┘
                      │ (valid_until passed)
                      ▼
              ┌───────────────┐
              │   PAST_DUE    │
              └───────┬───────┘
                      │ (Immediate 7-day dunning)
                      ▼
              ┌───────────────┐
              │ GRACE_PERIOD  │ (Full access + warning banner)
              └───────┬───────┘
                      │ (7 days elapsed without renewal)
                      ▼
              ┌───────────────┐
              │   SUSPENDED   │ (Non-destructive: read-only access)
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────┐
              │    EXPIRED    │
              └───────────────┘
```

### 2.3 Entitlement Service & Gating (`backend/app/services/entitlement.py`)
- **Hierarchical Resolution:**
  1. `TenantEntitlement` override: If an explicit record exists for `(tenant_id, feature_key)`, its `is_enabled` flag rules (unless `valid_until` has expired).
  2. Lifecycle check: If status is `SUSPENDED` or `EXPIRED`, only `READ_ONLY_FALLBACK_FEATURES` (`student_directory`, `report_cards`, `attendance_view`, `school_profile`) evaluate to `True`.
  3. Plan-based matrix: Resolves against `PLAN_FEATURES` matrix (`school_starter`, `school_growth`, `school_pro`, `academy_starter`, `academy_growth`, `unified_growth`, `unified_pro`).
- **Atomic Quota Validation:** `check_and_consume_quota` performs row-locked (`with_for_update`) inspection of `ai_questions_used_this_month` against `ai_question_quota_monthly` and `Student` active counts against `max_active_students`.
- **FastAPI Route Guards:**
  - `require_entitlement("whatsapp_alerts")`: Rejects unentitled tenants with HTTP 403 Forbidden.
  - `require_active_subscription()`: Guards mutating actions against suspended or expired tenants.

### 2.4 Webhook Replay Protection & Invoicing Workflow
When a provider callback arrives at `POST /api/v1/billing/webhook/payment-callback`:
1. Cryptographic HMAC-SHA256 signature is verified against `settings.PAYMENT_WEBHOOK_SECRET`.
2. Provider `event_id` is evaluated against `billing_webhook_events`. If previously processed, the endpoint returns `ALREADY_PROCESSED` without mutating records.
3. Subscription validity is extended from `max(now, current_valid_until)`.
4. An immutable `BillingInvoice` (`status="PAID"`) and `BillingInvoiceLineItem` are generated and persisted.
5. An entry in `BillingAuditLog` records the activation details.
6. Entitlements are synchronized for the tenant via `EntitlementService.sync_tenant_entitlements_for_plan`.

---

## 3. Database Migration Integrity

- **Revision:** `c3d4e5f6a7b8`
- **Predecessor:** `b2c3d4e5f6a7` (Stage 10 AI Curriculum Chunks)
- **DAG State:** Verified single linear head (`c3d4e5f6a7b8 (head)`).
- **PostgreSQL Row Level Security (RLS):**
  - RLS enabled and forced on `billing_invoices`, `tenant_entitlements`, and `billing_audit_logs`.
  - Restrictive policy: `tenant_id::text = NULLIF(current_setting('app.current_tenant_id', true), '')`.

---

## 4. Test Verification Matrix

### 4.1 Dedicated Stage 12 Test Suite (`backend/tests/test_stage12_subscription_billing.py`)
All 11 Stage 12 unit/integration tests passed in Pytest:

| # | Test Case | Target Capability | Result |
|---|---|---|---|
| 1 | `test_pricing_catalogue_and_plan_structure` | Single source of truth pricing catalogue | **PASSED** |
| 2 | `test_subscription_checkout_intent_creation_and_proration` | Server-side BDT calculation & upgrade proration | **PASSED** |
| 3 | `test_subscription_checkout_student_cap_enforcement` | Active student capacity protection at checkout | **PASSED** |
| 4 | `test_payment_webhook_hmac_signature_verification` | HMAC-SHA256 signature verification & tamper rejection | **PASSED** |
| 5 | `test_payment_webhook_replay_protection_and_activation` | Webhook replay protection & BillingInvoice creation | **PASSED** |
| 6 | `test_saas_billing_invoice_bounded_context_separation` | Domain separation: SaaS vs Academic Invoices | **PASSED** |
| 7 | `test_subscription_lifecycle_state_machine_and_dunning` | Lifecycle: ACTIVE -> GRACE_PERIOD -> SUSPENDED | **PASSED** |
| 8 | `test_non_destructive_suspension_read_only_access` | Non-destructive read access under SUSPENDED status | **PASSED** |
| 9 | `test_entitlement_gating_and_explicit_override` | Plan matrix gating & TenantEntitlement overrides | **PASSED** |
| 10 | `test_quota_consumption_and_limits` | Atomic AI question quota checking & consumption | **PASSED** |
| 11 | `test_tenant_invoices_and_entitlements_api` | Entitlements & SaaS Invoices query endpoints | **PASSED** |

### 4.2 Full Regression Test Suite
- **Backend Regression Suite:** **112/112 passed** across Stages 01–12:
  - `test_stage01_startup.py`: 9/9 passed
  - `test_stage02_migrations.py`: 10/10 passed
  - `test_stage03_auth.py`: 18/18 passed
  - `test_stage04_tenant_isolation.py`: 6/6 passed
  - `test_stage05_rbac.py`: 10/10 passed
  - `test_stage06_finance.py`: 8/8 passed
  - `test_stage08_backend_domain.py`: 9/9 passed
  - `test_stage09_institution_operations.py`: 14/14 passed
  - `test_stage10_ai_gateway.py`: 12/12 passed
  - `test_stage11_offline_sync.py`: 5/5 passed
  - `test_stage12_subscription_billing.py`: 11/11 passed
- **Frontend Test Suite:** **24/24 passed** (Stage 07 + Stage 11).
- **Frontend Type-Check:** **0 errors** (`tsc --noEmit`).
- **Integrity Check:** `bash backend/scripts/check.sh` -> **ALL OK**.

---

## 5. Stage 12 Gate Verdict

| Evaluation Criteria | Requirement | Result |
|---|---|---|
| Bounded Context Separation | SaaS Billing separated from Academic Fees | **VERIFIED** |
| Fixed Monetary Precision | Decimal / Numeric(12, 2) in BDT | **VERIFIED** |
| Webhook Replay Protection | Provider event uniqueness & idempotent handling | **VERIFIED** |
| Lifecycle State Machine | TRIALING -> ACTIVE -> GRACE -> SUSPENDED -> EXPIRED | **VERIFIED** |
| Non-Destructive Suspension | Read access to core data preserved; writes blocked | **VERIFIED** |
| Feature Entitlement Gating | Dynamic entitlement resolution & quota controls | **VERIFIED** |
| Alembic Migration Graph | Single linear head with PostgreSQL RLS policies | **VERIFIED** (`c3d4e5f6a7b8`) |
| Regression Test Gate | 112 backend + 24 frontend tests passing | **VERIFIED** |

**Stage 12 Verdict:** **PASS**  
EducationOS Stage 12 Subscription, Billing & Entitlement Infrastructure is successfully implemented, verified, and released.

