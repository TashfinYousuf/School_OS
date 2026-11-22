# EducationOS — Payment Gateway Security & Adapter Specification
**Document ID:** `docs/PAYMENT_GATEWAY_SECURITY_SPEC.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section F4 (Phase 4) Master Engineering Directive  
**Status:** **SANDBOX READY / PRODUCTION LIVE GATE LOCKED**  

---

## 1. Provider Adapter Architecture

EducationOS provides native adapter abstractions for Bangladesh's primary domestic digital payment rails:
1. **bKash Tokenized Checkout (Direct Merchant API v1.2.0)**
2. **Nagad Merchant Direct Checkout (Public Key Cryptography API)**
3. **SSLCommerz Hosted Session Gateway (IPN Webhook Architecture)**

```
                      [Client Checkout Request]
                                  │
                                  ▼
               [PaymentGatewayService Router]
                                  │
           ┌──────────────────────┼──────────────────────┐
           ▼                      ▼                      ▼
    [bKash Adapter]        [Nagad Adapter]       [SSLCommerz Adapter]
    • Token Grant          • Public Key Encrypt   • Session Key Post
    • Create Payment       • Sensitive Data       • Validated URL
    • Execute Payment      • Verification API     • Validation API
           │                      │                      │
           └──────────────────────┼──────────────────────┘
                                  │
                                  ▼
                     [Server-Side IPN Webhook]
                     ├── HMAC-SHA256 Signature Verify
                     ├── Exact Amount & Currency Match
                     ├── Replay Defense (Nonce/TrxID)
                     └── Idempotent State Transition
```

---

## 2. Mandatory Security & Fraud Controls

### 2.1 Replay Protection & Unique Transaction Identifiers
- Every checkout intent initiates a server-side record with a unique `intent_id: UUID`.
- When an IPN webhook or callback is delivered, the gateway's `transaction_id` (e.g., `TRX-BKASH-9X87`) is matched against the database.
- If `transaction_id` already exists with status `COMPLETED`, the callback is marked duplicate and rejected with **HTTP 409 Conflict** or acknowledged idempotently without double-crediting.

### 2.2 Server-Side Transaction Verification (No Client-Trust)
- A subscription or invoice is **NEVER** activated based on a browser URL redirect (`/payment/callback?status=success`).
- Upon client return, the server dispatches a private, back-channel query to the payment provider API (`POST /tokenized/checkout/execute` for bKash or `POST /validator/api/validationserverAPI.php` for SSLCommerz).
- Only when the provider's authoritative API confirms `transactionStatus: "Completed"` and `amount: expected_amount` does the subscription state transition.

### 2.3 Integer Minor Unit Currency Match
- All currency comparisons are performed in integer BDT (or minor subunits) to eliminate floating-point rounding attacks.
- If an invoice is for ৳6,000, a callback asserting ৳5,999 or ৳6,001 fails verification closed and triggers an audit alert.

### 2.4 Webhook HMAC Signature Validation
- All inbound webhooks must pass cryptographic signature verification using the provider's shared secret key (`HMAC-SHA256`).
- Unsigned or invalidly signed webhooks return HTTP 401 Unauthorized immediately.

---

## 3. Production Release Gate Status

- **Status:** **SANDBOX TESTED / PRODUCTION COLLECTION LOCKED**
- **Requirements for Live Gateway Activation:**
  1. Signed commercial merchant agreement with bKash, Nagad, and SSLCommerz.
  2. Production API credentials and merchant numbers configured via secure environment secrets.
  3. Verified HTTPS callback IPN endpoints with active TLS 1.3 certificates.
  4. Explicit operator authorization recorded in `docs/PRICING_APPROVAL_REQUIRED.md`.

