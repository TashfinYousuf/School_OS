# EducationOS — Stage 06 Finance & Payment Integrity Baseline Inventory

**Document Type:** Financial Architecture & Baseline Audit  
**Stage:** Stage 06 — Finance & Payment Integrity Reconstruction  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-11-05  

---

## 1. Executive Summary

Stage 06 addresses critical financial integrity, payment gateway security, and billing lifecycle risks in EducationOS. Prior to this stage:
- **BLK-P0-08 Vulnerability**: Clients could submit arbitrary string values as `transaction_id`, and the system immediately marked the payment as `status="COMPLETED"`, allowing fraudulent tuition fee completion without genuine payment provider verification.
- **Missing Invoicing Architecture**: Student fees were recorded as flat ledger entries without formal invoices, line item itemisation, or partial payment balance tracking.
- **Webhook Spoofing Risk**: Gateway callbacks had no cryptographic signature validation, allowing unauthorized external actors to forge payment completion events.
- **Float Precision Danger**: Financial computations were exposed to floating-point rounding errors.
- **Reversal Race Conditions**: Double-reversal vulnerabilities existed due to lack of strict concurrency locks.

Stage 06 reconstructs the financial subsystem to production-grade standards:
1. Complete remediation of **BLK-P0-08** across `backend/app/services/payment_providers.py` and `backend/app/api/endpoints/finance.py`.
2. Native Invoicing Architecture (`invoices`, `invoice_line_items`) with `Numeric(12, 2)` fixed Decimal precision.
3. Cryptographic Webhook Signature Verification (`HMAC-SHA256`) and replay protection.
4. Concurrency-safe row locking (`with_for_update()`) on fee collection, invoice application, and reversal.
5. Append-only ledger accounting with strict separation of duties (`finance.refunds.approve`).
6. Comprehensive test suite (`backend/tests/test_stage06_finance.py`) with 8/8 passing tests and 61/61 cumulative passing tests across Stages 01–06.

---

## 2. Financial Model & Database Schema Inventory

### 2.1 `invoices` Table
| Column Name | SQLAlchemy Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, default `uuid4` | Unique invoice identifier |
| `tenant_id` | `VARCHAR(64)` | Indexed, Not Null | Multi-tenant scoping identifier |
| `student_id` | `VARCHAR(64)` | Indexed, Not Null | Target student receiving invoice |
| `invoice_number` | `VARCHAR(64)` | Unique per tenant, Indexed | Canonical invoice code (e.g. `INV-2026-XXXXXX`) |
| `title` | `VARCHAR(150)` | Not Null | Invoice title (e.g. "Monthly Tuition Invoice") |
| `billing_month` | `VARCHAR(50)` | Not Null | Target billing period (e.g. "October 2026") |
| `total_amount` | `NUMERIC(12, 2)` | Not Null, Default `0.00` | Sum of all line item amounts |
| `paid_amount` | `NUMERIC(12, 2)` | Not Null, Default `0.00` | Cumulative settled payment amount |
| `discount_amount` | `NUMERIC(12, 2)`| Not Null, Default `0.00` | Institutional waiver or concession |
| `currency` | `VARCHAR(3)` | Default `"BDT"` | Fiat currency denominator |
| `status` | `VARCHAR(32)` | Indexed, Default `"ISSUED"` | `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`, `OVERDUE` |
| `due_date` | `TIMESTAMPTZ` | Nullable | Payment due deadline |
| `issued_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Formal issuance timestamp |
| `created_at` | `TIMESTAMPTZ` | Not Null, Default `now()` | Record creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | Not Null, OnUpdate `now()` | Last modification timestamp |

### 2.2 `invoice_line_items` Table
| Column Name | SQLAlchemy Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, default `uuid4` | Unique line item identifier |
| `invoice_id` | `UUID` | Foreign Key `invoices.id`, Cascade | Parent invoice reference |
| `tenant_id` | `VARCHAR(64)` | Indexed, Not Null | Multi-tenant isolation |
| `description` | `VARCHAR(255)` | Not Null | Fee breakdown item (e.g. "Lab Fee") |
| `quantity` | `INTEGER` | Not Null, Default `1` | Item quantity or unit count |
| `unit_price` | `NUMERIC(12, 2)` | Not Null, Default `0.00` | Unit price per line item |
| `amount` | `NUMERIC(12, 2)` | Not Null, Default `0.00` | Net line item amount |

### 2.3 `fee_payments` Table (Hardened)
| Column Name | SQLAlchemy Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, default `uuid4` | Payment transaction UUID |
| `tenant_id` | `VARCHAR(64)` | Indexed, Not Null | Multi-tenant isolation |
| `student_id` | `VARCHAR(64)` | Indexed, Not Null | Linked student identifier |
| `invoice_id` | `UUID` | Foreign Key `invoices.id`, Set Null | Optional linked invoice reference |
| `amount` | `NUMERIC(12, 2)` | Not Null | Transaction settlement amount |
| `currency` | `VARCHAR(3)` | Default `"BDT"` | Currency code |
| `payment_method` | `VARCHAR(32)` | Indexed, Not Null | `CASH`, `BANK`, `BKASH`, `NAGAD`, `SSLCOMMERZ` |
| `payment_status` | `VARCHAR(32)` | Indexed, Not Null | `PENDING`, `COMPLETED`, `FAILED`, `REVERSED`, `ADJUSTED` |
| `receipt_number` | `VARCHAR(64)` | Unique, Indexed, Not Null | Official audit receipt code (`REC-2026-XXXXXX`) |
| `provider_transaction_id`| `VARCHAR(128)` | Indexed, Nullable | Gateway TrxID (verified or pending) |
| `collected_by_user_id` | `VARCHAR(64)` | Nullable | Cashier user UUID (mandatory for CASH) |
| `idempotency_key` | `VARCHAR(128)` | Unique, Indexed, Not Null | Client idempotency token |
| `is_reconciled` | `BOOLEAN` | Default `False` | Bank / gateway statement reconciliation status |
| `is_reversed` | `BOOLEAN` | Default `False` | True if transaction was reversed |
| `reversal_reference_id` | `UUID` | Nullable | Pointer to original transaction if reversal entry |

---

## 3. BLK-P0-08 Root Cause Analysis & Remediation Architecture

### 3.1 Defect Analysis
In the legacy codebase, `payment_providers.py` contained stub provider implementations for `BKashMerchantProvider` and `NagadProvider`:
```python
# LEGACY VULNERABLE PATTERN:
return PaymentExecutionResult(
    success=True,
    transaction_id=trx_id,
    status="COMPLETED",  # <-- FLAW: Marked COMPLETED unconditionally
    ...
)
```
And `finance.py` accepted `transaction_id` from the client and saved `payment_status="COMPLETED"` unconditionally. This allowed students or rogue actors to forge payment records by simply submitting a synthetic string.

### 3.2 Implemented Architectural Fix
Under the reconstructed `BasePaymentProvider` architecture:
1. **Unverified MFS Claims Default to `PENDING`**:
   When a client submits `/api/v1/finance/collect` with `payment_method="BKASH"` or `"NAGAD"`:
   ```python
   # SEC-INVARIANT (BLK-P0-08): Do NOT mark as COMPLETED. Set PENDING for verification.
   return PaymentExecutionResult(
       success=True,
       transaction_id=str(trx_id).strip(),
       status="PENDING",
       message="bKash transaction registered. Awaiting provider confirmation or signed webhook.",
       raw_response={"trx_id": trx_id, "channel": "BKASH", "verified": False}
   )
   ```
2. **Transition to `COMPLETED` Requires Cryptographic Proof**:
   The fee payment only transitions to `COMPLETED` when:
   - A valid gateway webhook arrives with matching HMAC-SHA256 signature, OR
   - A genuine merchant query API validates the transaction directly with provider credentials.
3. **Cash Counter Auditing**:
   `CashDeskProvider` strictly enforces `cashier_user_id`:
   ```python
   cashier_id = client_metadata.get("cashier_user_id")
   if not cashier_id:
       return PaymentExecutionResult(
           success=False,
           status="FAILED",
           message="Cash collection rejected: cashier_user_id is required."
       )
   ```
   Physical cash collections are bound to the authenticated user ID of the cashier.

---

## 4. Cryptographic Webhook Security Architecture

### 4.1 HMAC-SHA256 Verification Pipeline
Webhook notifications received at `POST /api/v1/finance/webhook/{provider_name}` pass through a strict verification pipeline:
```python
def verify_webhook_signature(
    self,
    payload_bytes: bytes,
    signature: str,
    secret: str
) -> bool:
    if not signature or not secret:
        return False
    
    expected_sig = hmac.new(
        secret.encode("utf-8"),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_sig.lower(), signature.strip().lower())
```
- Missing or invalid signatures trigger immediate `HTTP 401 Unauthorized`.
- Uses constant-time `hmac.compare_digest` to prevent timing side-channel attacks.

### 4.2 Replay Protection & Concurrency Row Locking
- When a valid webhook arrives, the target payment is queried with `.with_for_update()`.
- If `payment.payment_status == "COMPLETED"`, the endpoint returns `{"status": "ALREADY_COMPLETED"}` immediately without duplicate balance deductions.
- If linked to an invoice, the invoice is also locked with `.with_for_update()`, its `paid_amount` is incremented, and its lifecycle status is updated.

---

## 5. Invoicing Lifecycle & Payment Application

```
                    ┌──────────────┐
                    │    DRAFT     │
                    └──────┬───────┘
                           │ Issue
                           ▼
                    ┌──────────────┐
       ┌───────────►│    ISSUED    │
       │            └──────┬───────┘
       │ Reversal          │ Partial Payment
       │                   ▼
       │            ┌──────────────┐
       └────────────┤PARTIALLY_PAID│
       │ Reversal   └──────┬───────┘
       │                   │ Final Payment (paid_amount >= net_payable)
       │                   ▼
       │            ┌──────────────┐
       └────────────┤     PAID     │
                    └──────────────┘
```

1. **Invoice Issuance**: Invoice created in `ISSUED` state with line items.
2. **Partial Settlement**: When payment is applied, `paid_amount` increments; if `paid_amount < (total - discount)`, invoice moves to `PARTIALLY_PAID`.
3. **Full Settlement**: When `paid_amount >= (total - discount)`, invoice moves to `PAID`.
4. **Reversal Propagation**: If a payment is reversed, the deduction is undone on the linked invoice, moving `PAID` back to `PARTIALLY_PAID` or `ISSUED`.

---

## 6. Append-Only Ledger Reversal & Separation of Duties

- **No Hard Deletes**: `DELETE /api/v1/finance/{payment_id}` returns `HTTP 405 Method Not Allowed`. Financial compliance strictly forbids deleting financial records.
- **Role Isolation**: Only administrators with `finance.refunds.approve` can execute reversals. Cashiers and finance officers with only `finance.refunds.initiate` cannot unilaterally execute reversals.
- **Append-Only Entry**: Reversal inserts a new balancing record with negative amounts (`amount = -abs(original.amount)` and `payment_status="ADJUSTED"`).
- **Double-Reversal Guard**: Checks `original_payment.is_reversed` under row lock; second reversal returns `HTTP 409 Conflict`.

