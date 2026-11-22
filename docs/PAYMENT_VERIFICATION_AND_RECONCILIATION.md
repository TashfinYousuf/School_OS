# EducationOS — Payment Verification & Operational Reconciliation Specification
**Document ID:** `docs/PAYMENT_VERIFICATION_AND_RECONCILIATION.md`  
**Generated:** 2026-11-11  
**Author:** Payments Lead & Database Reliability Engineer  
**Scope:** Stage 4 Mode A (Manual Reconciliation) & Mode B (Automated Gateway Webhooks)  

---

## 1. Executive Summary & Dual Payment Modes

Payment collection for educational institutions in Bangladesh requires dual operational capabilities:
1. **Mode A (Low-Cost Manual Reconciliation):** Direct institutional bank deposits (BEFTN/NPSB/RTGS) and bKash Merchant transfers where transactions are recorded as `PENDING_REVIEW` and confirmed against verified bank statements by authorized operations personnel.
2. **Mode B (Automated Merchant Gateway Webhooks):** Real-time server-to-server webhook callbacks with cryptographic HMAC signature verification and API query validation.

---

## 2. Mode A: Operational Manual Reconciliation Protocol

### 2.1 Workflow Steps
1. **Intent Creation:** Institution selects capacity and billing cycle; calls `POST /api/v1/billing/checkout` to generate a unique reference (`SUB-KS001-A1B2C3D4`).
2. **Deposit Execution:** School transfers funds to the verified EducationOS bank account or bKash merchant number.
3. **Reference Submission:** School enters their bank deposit slip or bKash TrxID via `POST /api/v1/billing/verify-payment`. The status transitions to `SUBMITTED`.
4. **Statement Reconciliation:** Authorized platform operator inspects the live bank portal or bKash merchant statement, matching `verified_amount` and `statement_reference`.
5. **Privileged Approval:** Operator executes `POST /api/v1/billing/admin/reconcile-payment`.
6. **Instant Activation:**
   - Intent marked `PAID`.
   - Subscription advances to `ACTIVE`.
   - Immutable SaaS invoice (`INV-SAAS-2026-XXXX`) generated.
   - Audit log recorded capturing operator ID, timestamp, and statement reference.
   - Entitlements synchronized.

### 2.2 Security Invariants:
- Deposit amount must equal or exceed payable amount (`verified_amount >= intent.amount`).
- Idempotent: Attempting to reconcile an already paid reference returns `ALREADY_CONFIRMED`.
- Row-level lock (`with_for_update()`) prevents concurrent duplicate reconciliation.

---

## 3. Mode B: Automated Webhook Verification Protocol

### 3.1 Webhook Verification Invariants
- **Endpoint:** `POST /api/v1/billing/webhook/payment-callback`
- **Secret Signing:** Gateway signature verified using HMAC-SHA256:
  ```python
  expected_sig = hmac.new(settings.PAYMENT_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
  ```
- **Replay Protection:** Webhook event ID and signature hash are stored in table `billing_webhook_events`. Duplicate events return `HTTP 200 DUPLICATE_EVENT` without reprocessing.
- **Server-Side Intent Authority:** The tenant ID, subscription plan, and billing cycle are resolved strictly from our internal database intent record, never trusted from the webhook JSON body.
- **Amount Verification:** Webhook amount must exactly match the stored intent amount down to two decimal places; discrepancies fail closed with `HTTP 409 Conflict`.

---

## 4. Refund & Chargeback Settlement Architecture

1. **Refund Trigger:** Authorized platform admin initiates refund via gateway API.
2. **Subscription Status Adjustment:**
   - Full Refund: Subscription transitions to `CANCELLED` or downgraded to read-only `RESTRICTED`.
   - Partial Refund: Prorated adjustment recorded as a credit note.
3. **Data Preservation Guarantee:** Even in the event of a payment dispute, cancellation, or refund, student academic records, exam grades, and historical attendance logs are NEVER purged or deleted.

