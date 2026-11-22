# EDUCATIONOS — BILLING, PRICING & SUBSCRIPTION SECURITY AUDIT

**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/BILLING_PRICING_SECURITY_AUDIT.md`  
**Security Level:** CRITICAL / FINANCIAL INTEGRITY BOUNDARY  
**Audit Date:** November 9, 2026  
**Auditors:** Application Security Engineer, Principal Architect, Payments Specialist  
**Status:** **AUDITED / REMEDIATION REQUIRED (P0)**  

---

## 1. Executive Summary & Security Directives

EducationOS SaaS billing operates as an essential security and financial boundary. A failure in billing security can result in unauthorized privilege escalation, fraudulent subscription activation, cross-tenant data exposure (BOLA/IDOR), or database corruption.

### Critical Audit Findings:
1. **Live Schema Mismatch (P0 - F-01):** `GET /api/v1/billing/status` crashes on production PostgreSQL with `psycopg2.errors.UndefinedColumn: column institution_subscriptions.currency does not exist`. Migration `c3d4e5f6a7b8` was never executed against the live Supabase instance.
2. **Pricing Discrepancy & Ambiguity (P0 - F-05):** Backend `PRICING_PLANS` in `backend/app/api/endpoints/billing.py` specifies:
   - `school_starter`: BDT 990/month (100 students)
   - `school_growth`: BDT 2,490/month (500 students)
   - `school_pro`: BDT 5,990/month (1,500 students)
   Meanwhile, Stage 12.5 reports and some marketing materials claimed Starter at BDT 1,500/mo, Standard at BDT 3,500/mo, Pro at BDT 6,000/mo, and Enterprise at BDT 12,000/mo.
3. **Premature Payment Buttons in UI (P1 - F-09):** `frontend/app/dashboard/pricing/page.tsx` exposed live "Pay with bKash", "Pay with Nagad", and "Card / SSLCommerz" checkout flows while the backend payment gateway adapter in `payment_providers.py` remains unverified with live merchant API keys.
4. **Strict Segregation of Financial Domains:** The application maintains a strict separation between **Academic Student Fees** (`app/models/finance.py` - tuition, admission fees, vouchers) and **EducationOS SaaS Subscriptions** (`app/models/billing.py`, `app/models/subscription.py` - institutional software license). This segregation is healthy and must be preserved.

---

## 2. Route-by-Route Billing Endpoint Security Matrix

All billing endpoints are housed in `backend/app/api/endpoints/billing.py` and mounted under `/api/v1/billing`:

| Method & Path | Auth Required | Required Role | Tenant Scope | Input Schema | Output Schema | DB Tables Touched | Idempotency & Replay Defense | Payment / Verification Requirement | Frontend Caller |
|:---|:---:|:---:|:---:|:---|:---|:---|:---:|:---:|:---|
| `GET /api/v1/billing/plans` | No (Public) | Any / None | Global | None | `{ plans: Record<string, PlanDict> }` | `subscription_plans` (Optional) | Safe / Read-Only | None | Standalone `/pricing` |
| `GET /api/v1/billing/status` | Yes (Bearer) | `admin` | Current Tenant | None | `SubscriptionStatusResponse` | `institution_subscriptions`, `students` | Safe / Read-Only | Checks valid until & grace period | `/dashboard` header, Settings |
| `POST /api/v1/billing/checkout` | Yes (Bearer) | `admin` | Current Tenant | `CheckoutRequest` (`plan_key`, `billing_cycle`, `gateway`) | `CheckoutResponse` (`checkout_url`, `payment_reference`, `payable_amount`) | `subscription_payments`, `billing_invoices` | Generates unique UUID `payment_reference` | Server computes authoritative price; rejects client price tampering | `/pricing` (Stage 12.6 Gate) |
| `POST /api/v1/billing/verify-payment` | Yes (Bearer) | `admin` | Current Tenant | `PaymentVerifyRequest` (`payment_reference`, `gateway_trx_id`) | `PaymentVerifyResponse` (`status`, `subscription_updated`) | `subscription_payments`, `institution_subscriptions`, `billing_invoices` | Checks payment status != 'SUCCESS' before applying | Server-to-server query or webhook receipt check | Checkout redirect callback |
| `GET /api/v1/billing/payments/{ref}` | Yes (Bearer) | `admin` | Current Tenant | `ref: str` (path) | `PaymentStatusResponse` | `subscription_payments` | Safe / Read-Only | Enforces `tenant_id == current_tenant_id` (BOLA defense) | Payment polling modal |
| `POST /api/v1/billing/webhook/payment-callback` | No (HMAC Signature) | None (Gateway) | Derived from payload | Raw Request Body + `X-Signature` | `WebhookReceiptResponse` (`received: true`, `event_id`) | `billing_webhook_events`, `subscription_payments`, `institution_subscriptions` | **Strict Idempotency**: Unique constraint on `(gateway, event_id)` rejects replays | Constant-time HMAC-SHA256 signature check (`hmac.compare_digest`) | Payment Gateway Webhook |
| `GET /api/v1/billing/entitlements` | Yes (Bearer) | `admin`, `teacher` | Current Tenant | None | `EntitlementsResponse` (`features: list`, `quotas: dict`) | `tenant_entitlements`, `institution_subscriptions` | Safe / Read-Only | Evaluates plan tier & quota limits | Frontend `PermissionGate` |
| `GET /api/v1/billing/invoices` | Yes (Bearer) | `admin` | Current Tenant | Optional query filters | `List[InvoiceSummary]` | `billing_invoices` | Safe / Read-Only | Enforces tenant RLS | Admin Billing Center |
| `GET /api/v1/billing/invoices/{id}` | Yes (Bearer) | `admin` | Current Tenant | `id: UUID` (path) | `InvoiceDetailResponse` | `billing_invoices`, `billing_invoice_line_items` | Safe / Read-Only | Validates tenant ownership (404 if mismatch) | Admin Invoice View |
| `POST /api/v1/billing/simulate-lifecycle` | Yes (Bearer) | `superadmin` | Current Tenant | `LifecycleActionRequest` | `LifecycleActionResponse` | `institution_subscriptions`, `billing_audit_logs` | Audit logged with actor & timestamp | Restricted to dev/staging environments | QA Test Suite Only |

---

## 3. Deep Security Vulnerability Analyses

### 3.1 BOLA / IDOR Defense on Billing Entities
- **Vulnerability Vector:** An attacker with admin credentials in Tenant A submits a `payment_reference` or `invoice_id` belonging to Tenant B.
- **Audit Verification:**
  - In `backend/app/api/endpoints/billing.py`:
    ```python
    payment = db.query(SubscriptionPayment).filter(
        SubscriptionPayment.payment_reference == reference,
        SubscriptionPayment.tenant_id == str(tenant_id)
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")
    ```
  - Both `SubscriptionPayment` and `BillingInvoice` queries filter explicitly by `tenant_id == str(tenant_id)` from the verified JWT token.
  - Furthermore, native PostgreSQL RLS policies on `billing_invoices` enforce tenant boundary fail-closed isolation.
- **Status:** **SECURE / DEFENSE-IN-DEPTH VERIFIED**.

---

### 3.2 Price & Quota Tampering Defense
- **Vulnerability Vector:** An attacker intercepts the client-side checkout request and modifies `amount`, `max_students`, or `discount`.
- **Audit Verification:**
  - `CheckoutRequest` schema in `billing.py`:
    ```python
    class CheckoutRequest(BaseModel):
        plan_key: str
        billing_cycle: Literal["monthly", "annual"] = "monthly"
        gateway: Literal["BKASH", "NAGAD", "SSLCOMMERZ"] = "BKASH"
    ```
  - The request accepts **ONLY** `plan_key`, `billing_cycle`, and `gateway`. It does **not** accept a price or quota field from the client.
  - The backend retrieves the price strictly from the authoritative server-side dictionary `PRICING_PLANS[req.plan_key]["price_bdt"]`.
  - For annual billing, the backend applies its own formula (`monthly_price * 10`).
- **Status:** **SECURE / SERVER-AUTHORITATIVE**.

---

### 3.3 Webhook Replay Protection & Signature Timing
- **Vulnerability Vector:** An attacker replays an old payment confirmation webhook or uses a timing side-channel attack to forge signatures.
- **Audit Verification:**
  - Webhook receiver in `billing.py` (lines 480–520):
    ```python
    # Constant-time comparison
    if not hmac.compare_digest(computed_hash, signature_header):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    ```
  - The event is logged in `billing_webhook_events` with unique constraint `(gateway, event_id)`.
  - A duplicate webhook payload triggers an `IntegrityError`, terminating execution safely with an idempotent `200 OK: Event already processed` message.
- **Status:** **SECURE / IDEMPOTENT**.

---

### 3.4 Undefined Column Error on `institution_subscriptions.currency` (F-01)
- **Vulnerability / Crash Vector:**
  - Line 251: `db.query(InstitutionSubscription).filter(...)` selects all model columns.
  - Because `currency` does not exist on the live database table, the entire query raises an unhandled `psycopg2.errors.UndefinedColumn` exception, resulting in an ungraceful 500 server crash.
- **Remediation Plan:**
  - Provide an immediate forward migration adding `currency VARCHAR(3) DEFAULT 'BDT' NOT NULL`, `current_period_start`, `trial_ends_at`, and `grace_period_until`.
  - Wrap read queries in defensive savepoints where appropriate.
- **Status:** **P0 DEFECT IDENTIFIED — RESOLUTION SPECIFIED IN RECONCILIATION PLAN**.

---

## 4. Pricing Source of Truth & Plan Reconciliation

To eliminate contradictions across reports, marketing copy, and code, the platform adopts the following authoritative pricing schedule:

```
Plan Key           Category   Monthly (BDT)   Annual (BDT)   Student Quota   AI Quota / mo   Target Segment
────────────────────────────────────────────────────────────────────────────────────────────────────────────────
school_starter     school     ৳990            ৳9,900         100             100             Small K-12 / Rural Schools
school_growth      school     ৳2,490          ৳24,900        500             500             Standard Secondary Schools
school_pro         school     ৳5,990          ৳59,900        1,500           2,000           Large Colleges & Campuses
academy_starter    academy    ৳1,490          ৳14,900        150             200             Local Coaching Centers
academy_growth     academy    ৳2,990          ৳29,900        600             1,000           Regional Test-Prep Institutes
academy_pro        academy    ৳6,990          ৳69,900        2,000           3,000           Multi-Branch Academies
unified_elite      unified    ৳8,990          ৳89,900        Unlimited       5,000           Group of Institutions
```

### Approved Pricing Rules:
1. **Single Source of Truth:** `backend/app/api/endpoints/billing.py::PRICING_PLANS`.
2. **Annual Discount Formula:** Standard 10-months-for-12-months formula (`monthly_fee * 10`).
3. **Public API Contract:** `GET /api/v1/billing/plans` dynamically serves this JSON structure.
4. **Frontend Binding:** `frontend/lib/plans.ts` must exactly mirror this specification or fetch dynamically from the public endpoint.

---

## 5. Pilot-First Security Directives for Kids Shine Launch

1. **Defer Live Payment Gateways:** For the 15 November pilot at Kids Shine School, automatic credit card/bKash checkout is deactivated. The tenant is provisioned with an active institutional pilot license.
2. **Deactivate Public Self-Serve Checkout:** The `/pricing` page must display "Request Pilot Demo" or "Contact Campus Sales" rather than routing to live checkout until Stage 12.6 is fully verified.
3. **Maintain Financial Separation:** Student tuition fee records (`fee_payments`, `invoices`) must remain strictly isolated from SaaS subscription fee records (`subscription_payments`, `billing_invoices`).

