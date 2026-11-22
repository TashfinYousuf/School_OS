# EducationOS — Bangladesh Payment Provider & Merchant Architecture Comparison
**Document ID:** `docs/PAYMENT_PROVIDER_COMPARISON.md`  
**Generated:** 2026-11-11  
**Author:** Payments Architect & Financial Systems Strategist  
**Market:** Bangladesh (B2B SaaS Institutional Subscriptions)  
**Scope:** Evaluation of Legitimate Payment Gateways, QR Rails, Aggregators & Manual Settlement  

---

## 1. Executive Summary & Strategy

In Bangladesh, educational institutions have distinct financial workflows: government and registered private schools typically maintain formal commercial bank accounts (e.g. Sonali Bank, Dutch-Bangla Bank, City Bank), while coaching academies and smaller private kindergartens frequently settle operational bills via Mobile Financial Services (MFS: bKash, Nagad).

To minimize initial operating overhead and eliminate costly monthly gateway maintenance fees during the Kids Shine School pilot, EducationOS implements a **Two-Mode Payment Strategy**:
- **Mode A (Low-Cost MVP / Manual Statement Reconciliation):** Enabled immediately. Schools pay via direct merchant bank transfer or bKash Merchant; our operations team verifies against bank/merchant statements and activates the tenant within 1 hour.
- **Mode B (Automated Merchant Gateway Integration):** Staged in sandbox; ready for activation once corporate trade license, BIN, TIN, and merchant gateway contracts are formalized by the platform owner.

---

## 2. Comprehensive Payment Gateway & Rails Comparison

| Payment Method / Provider | Integration Type | Setup Cost | Merchant Discount Rate (MDR) | Settlement Window | Technical Feasibility & Requirements |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Direct bKash Merchant (Online Gateway)** | Server-to-Server Tokenized REST API | ৳0 – ৳10,000 (depending on campaign) | **1.2% – 1.5%** per transaction | **T+1 to T+2** Business Days | Requires verified Corporate Trade License, TIN, BIN, and Merchant Bank Account. Supported in `backend/app/services/payment_providers.py`. |
| **bKash Merchant QR / Bangla QR** | Dynamic / Static QR Code | ৳0 | **1.0% – 1.2%** | **T+1** Business Day | Dynamic QR requires acquirer API; static QR functions identically to Mode A manual review. |
| **Nagad Merchant Direct** | RSA-signed REST API | ৳0 | **1.0% – 1.2%** per transaction | **T+2** Business Days | Requires Nagad corporate merchant account and public/private key pair configuration. |
| **SSLCommerz (Aggregator)** | Hosted / Checkout API | ৳15,000 – ৳25,000 (one-time setup) | **2.0% – 2.5%** (Cards) / **1.5%** (MFS) | **T+2 to T+3** Business Days | Broadest coverage (Visa, Mastercard, bKash, Nagad, Upay, DBBL Nexus). High initial setup fee. Supported in sandbox. |
| **Shurjopay / Aamarpay** | Local Payment Aggregator | ৳5,000 – ৳15,000 | **1.8% – 2.2%** | **T+2** Business Days | Budget aggregator alternative with local support. |
| **Direct Bank Transfer (BEFTN / NPSB / RTGS)** | Manual Wire Transfer | **৳0** | **৳0 (Zero gateway fee)** | **Instant (NPSB) to Same-Day** | School wire-transfers to EducationOS institutional bank account. Verified manually via bank portal. |

---

## 3. Two-Mode Payment Lifecycle

```
                                  [ Payment Intent Created ]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         [ Mode A: Manual Transfer ]                     [ Mode B: Automated Gateway ]
         • Bank BEFTN/NPSB or bKash TrxID                • bKash Checkout / SSLCommerz
         • Admin submits reference on-screen             • User completes payment in gateway modal
         • Status: PENDING_REVIEW                        • Gateway delivers signed HMAC webhook
         • Operations verifies against statement         • Backend validates signature & queries API
         • Admin clicks "Approve & Activate"             • Status: AUTOMATICALLY ACTIVATED
```

### 3.1 Mode A Implementation Guarantees:
1. **Never False Claims:** The UI explicitly states: *"Manual Bank / MFS Review: Activation will occur upon operational verification of deposit."*
2. **Reconciliation Audit Trail:** Approval stores `approved_by_user_id`, `bank_statement_ref`, `amount_received_bdt`, and `approved_at`.
3. **No Personal Accounts:** Payment instructions display only the verified corporate merchant number or institutional bank routing numbers.

### 3.2 Mode B Implementation Guarantees:
1. **Zero Client Trust:** Browser redirect parameters are never used to confirm payment. Only server-to-server webhook callbacks and verify APIs trigger activation.
2. **HMAC-SHA256 Verification:** Secret webhook keys stored strictly in server environment variables.
3. **Amount Tampering Check:** Incoming payload amount must match the stored intent amount down to two decimal places; mismatches fail with HTTP 409 Conflict.

