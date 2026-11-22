# Financial Ledger, Reconciliation & Dual-Custody Governance

## 1. Bounded Financial Contexts
EducationOS strictly separates two independent financial ledgers:
1. **Academic Tuition & Fee Ledger (`app/models/finance.py`, `app/api/endpoints/finance.py`):**
   - Models: `FeePayment`, `Invoice`, `InvoiceLineItem`.
   - RLS: Protected by `tenant_isolation_policy` (`AS PERMISSIVE` + `RESTRICTIVE` under `SET LOCAL ROLE authenticated`).
   - Immutability & Reversal: Payments are append-only; reversals (`POST /api/v1/finance/reversal`) require `FINANCE_REFUNDS_APPROVE`, row lock (`with_for_update()`), duplicate-reversal guard (409), and recalculate student invoice balances cleanly.
   - Cash Desk invariant: Physical cash requires authenticated `cashier_user_id`. Electronic MFS client-submitted TrxIDs enter `PENDING` and only mark `COMPLETED` upon cryptographically verified provider webhook (`POST /api/v1/finance/webhook/{provider_name}`), failing closed HTTP 503 if provider webhook secret is unconfigured.

2. **SaaS Platform Subscription Ledger (`app/models/billing.py`, `app/models/subscription.py`, `app/models/subscription_payment.py`, `app/api/endpoints/billing.py`):**
   - Models: `SubscriptionPlan`, `PlanVersion`, `InstitutionSubscription`, `SubscriptionPayment`, `BillingInvoice`, `BillingInvoiceLineItem`, `BillingWebhookEvent`, `BillingAuditLog`, `TenantEntitlement`.
   - Uniqueness & Replay Protection:
     - `SubscriptionPayment.payment_reference` is globally unique.
     - Partial unique index `uq_sub_payment_trx` on `(gateway, transaction_id) WHERE transaction_id IS NOT NULL` prevents reusing a transaction reference across intents.
     - `BillingWebhookEvent` enforces `(gateway, event_id)` replay idempotency.

## 2. Mode A Dual-Custody Manual Reconciliation Workflow
Eliminates tenant self-approval risk:
1. **Checkout Intent (`POST /api/v1/billing/checkout`):** School `admin` creates `PENDING` `SubscriptionPayment`.
2. **Claim Submission (`POST /api/v1/billing/verify-payment` or `/manual-claim`):** School `admin` attaches `transaction_id`, recording `submitted_by`, `submitted_at`, status=`SUBMITTED`, and appending `BillingAuditLog(action="MANUAL_PAYMENT_CLAIM_SUBMITTED")`.
3. **Platform Verification (`POST /api/v1/billing/admin/reconcile-payment`):**
   - Restricted strictly to platform `superadmin` (`require_roles(["superadmin"])`).
   - Rejects self-approval (`submitted_by == operator_id` -> HTTP 403 Dual-Custody Violation).
   - Rejects duplicate `statement_reference` across intents (HTTP 409).
   - Validates `verified_amount >= expected_amount` using `Decimal`.
   - Marks `SubscriptionPayment` -> `PAID` (with `reviewed_by`, `reviewed_at`, `review_notes`), creates immutable `BillingInvoice` + `BillingInvoiceLineItem`, activates `InstitutionSubscription`, syncs `TenantEntitlement`, and writes `BillingAuditLog`.
4. **Dispute / Rejection (`POST /api/v1/billing/admin/reject-payment`):** Platform `superadmin` transitions `PENDING`/`SUBMITTED` claim to `REJECTED` with mandatory `reason` and audit log.
5. **Reversal (`POST /api/v1/billing/admin/reverse-payment`):** Platform `superadmin` transitions erroneous `PAID` payment to `REVERSED`, voids `BillingInvoice` (`status="VOID"`), moves subscription to `PAST_DUE` (3-day grace window), and records immutable `BillingAuditLog`.

