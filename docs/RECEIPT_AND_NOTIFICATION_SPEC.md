# EducationOS — SaaS Receipting & Notification Delivery Specification
**Document ID:** `docs/RECEIPT_AND_NOTIFICATION_SPEC.md`  
**Generated:** 2026-11-11  
**Author:** Financial Systems Architect & UX Strategist  
**Scope:** Stage 4 Receipt Generation, Multi-Channel Notifications, and Financial Separation  

---

## 1. Immutable Server-Side Receipt Specification

Upon successful payment verification (via Mode A manual reconciliation or Mode B gateway webhook), an immutable server-side payment receipt and invoice line-item snapshot are generated immediately.

### 1.1 Mandated Receipt Fields

| Field Name | Type / Format | Example Value | Description |
| :--- | :--- | :--- | :--- |
| **Receipt Number** | String (`REC-SAAS-YYYY-XXXX`) | `REC-SAAS-2026-8A3F109D` | Globally unique, sequential receipt identifier. |
| **Invoice Reference** | String (`INV-SAAS-YYYY-XXXX`) | `INV-SAAS-2026-B91C220E` | Associated billing invoice reference. |
| **Institution Name** | String (UTF-8) | `Kids Shine School` | Official registered tenant name. |
| **Tenant ID** | UUID v4 | `0192e10c-396a-7253-b248-...` | Cryptographic tenant identifier. |
| **Payable Amount** | Decimal (2 places) | `৳5,650.00` | Net amount paid in Bangladesh Taka (BDT). |
| **Payment Method** | String Enum | `BKASH_MERCHANT` / `BANK_WIRE` | Method utilized for settlement. |
| **Transaction ID (TrxID)** | String | `BKA91029310` | Bank or MFS transaction reference. |
| **Timestamp (BST)** | ISO 8601 UTC+6 | `2026-11-15T10:45:00+06:00` | Exact moment of verification and settlement. |
| **Billing Cycle** | String | `ANNUAL` or `MONTHLY` | Period covered by the license fee. |
| **Itemized Breakdown** | JSON Array | Base fee, student capacity, modules | Immutable snapshot of billed items. |

### 1.2 Access & Archive:
- Downloadable in customer billing dashboard at `/dashboard/settings?tab=billing`.
- Generated as a printable, tamper-evident HTML/PDF document featuring the EducationOS seal and verification QR code.

---

## 2. Multi-Channel Notification Architecture

```
                          [ Verified Payment Confirmation ]
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
          [ Transactional Email ]    [ In-App Notice ]    [ Optional SMS/WhatsApp ]
          • Immediate delivery       • Dashboard alert    • Triggered only if provider
          • Attached PDF receipt     • Admin banner         & credit quota configured
```

### 2.1 Failure Decoupling Rule (Non-Negotiable):
**A failure in SMS, WhatsApp, or email notification delivery must NEVER roll back, invalidate, or delay a verified payment.**

- Payment verification and subscription activation commit atomically to the primary database.
- Notification dispatch is handed off to an asynchronous background task.
- If the SMS provider returns an error (e.g. gateway timeout or invalid phone number), the payment remains 100% active and the failure is recorded in `notification_delivery_logs` for retry.

---

## 3. Strict Financial Domain Separation

To protect financial integrity, EducationOS enforces a strict bounded context separation between SaaS subscription billing and school student tuition fee collection:

| Dimension | EducationOS SaaS Subscription Billing | School Student Tuition Fee Collection |
| :--- | :--- | :--- |
| **Target Payer** | School Administration / Principal | Guardian / Student / Parent |
| **Beneficiary** | EducationOS Platform Operator | School Institution Bank / Cash Box |
| **Database Tables** | `institution_subscriptions`, `billing_invoices`, `subscription_payments` | `student_fee_invoices`, `fee_payments`, `fee_structures` |
| **API Endpoints** | `/api/v1/billing/*` | `/api/v1/finance/*` |
| **Authorized Roles** | Superadmin & Institution Administrator | School Accountant, Finance Officer, Cashier |
| **Receipt Structure** | SaaS Platform Subscription Receipt | Dual-Copy Student Tuition Receipt (School + Student Copy) |

**Under no circumstances are SaaS platform subscription transactions merged or cross-queried with student tuition collection records.**

