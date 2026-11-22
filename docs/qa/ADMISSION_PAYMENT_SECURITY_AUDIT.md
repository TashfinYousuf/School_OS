# EducationOS Admission Payment & Anti-Fraud Security Audit
**Release Track:** KSIS Pilot Readiness & Production Grade Hardening  
**Auditor Role:** Application Security & Financial Systems Reliability Engineer  
**Scope:** School Admission Fee Invoicing, Manual Counter Verification, Revenue Custody Separation, Anti-Fraud Sequential Receipts  

---

## 1. Separation of Financial Domains (School Revenue vs. Platform Billing)

A core requirement of the EducationOS multi-tenant architecture is strict architectural separation between **School Financial Custody** and **Platform Billing Custody**:

```
+--------------------------------------------------------------------------+
|                       EDUCATIONOS FINANCIAL DOMAINS                      |
+------------------------------------+-------------------------------------+
| DOMAIN A: SCHOOL REVENUE CUSTODY   | DOMAIN B: PLATFORM SAAS BILLING    |
| (School Counter, Invoices, Fees)   | (EducationOS Subscription Charges)  |
+------------------------------------+-------------------------------------+
| Table: `admission_receipts`        | Table: `billing_invoices`           |
| Table: `invoices`                  | Table: `subscription_payments`      |
| Table: `fee_payments`              | Table: `institution_subscriptions`  |
| Destination: School Bank/bKash/Cash| Destination: Platform Merchant Acct |
| Verification: School Cashier/Admin | Verification: Dual Custody / Super  |
| Currencies: BDT                    | Currencies: BDT / USD               |
+------------------------------------+-------------------------------------+
```

### Audit Findings:
- Zero cross-contamination between school student fee receipts and platform tenant subscriptions.
- `AdmissionReceipt` is scoped strictly to tenant-level school fee collections (`APPLICATION_FEE` and `FINAL_ADMISSION_FEE`).
- Admission payments never touch or modify platform billing balances or entitlements.

---

## 2. Server-Side Fee Snapshot & Tamper Resistance

### Attack Vector Analysis (Client Price Tampering):
In naive implementations, a malicious applicant or corrupted frontend payload might submit `{ "amount": 0.01, "fee_category": "APPLICATION_FEE" }` to bypass admission fees.

### Remediation & Invariant Enforcement:
1. `initiate_admission_payment` does NOT accept amount from the client. It calculates the snapshot server-side:
   ```python
   if fee_category == "APPLICATION_FEE":
       payable = app.application_fee
   else:
       payable = app.final_admission_fee
   ```
2. When an applicant submits an admission application via `POST /apply`, the fee is directly read from the server-persisted `AdmissionSession` or class override:
   ```python
   if session.class_fees and payload.class_name in session.class_fees:
       app_fee = Decimal(str(session.class_fees[payload.class_name]))
   else:
       app_fee = session.application_fee
   ```
3. When verifying payments via `POST /payments/verify`, the amount recorded on the immutable `AdmissionReceipt` is locked to the server snapshot `app.application_fee` or `app.final_admission_fee`. Any attempt by an applicant to pay less than the snapshot leaves the payment in `UNDER_REVIEW` until reconciled by the cashier.

---

## 3. Anti-Fraud Sequential Receipt Numbering

To prevent receipt forgery, double-invoicing, or off-the-books cashier fraud, every receipt issued by EducationOS adheres to the following cryptographic and sequential guarantees:

1. **Unique Tenant-Scoped Numbering:** Formatted as `RCP-YYYY-XXXX` (e.g. `RCP-2026-0001`, `RCP-2026-0002`).
   ```python
   def _generate_receipt_number(db: Session, tenant_id: str, year: str) -> str:
       count = count_rows(
           db,
           AdmissionReceipt,
           AdmissionReceipt.tenant_id == str(tenant_id),
       )
       return f"RCP-{year}-{count + 1:04d}"
   ```
2. **Database Constraint Enforcement:**
   A unique constraint `UniqueConstraint("tenant_id", "receipt_number", name="uq_tenant_admission_receipt_number")` at the PostgreSQL engine level rejects any duplicated receipt issuance.
3. **Immutable JSON Snapshot Payload:**
   Each receipt stores a frozen `receipt_payload` containing:
   - `student_name`, `class_name`, `academic_year`
   - `guardian_phone`, `guardian_name`
   - `amount_paid`, `currency`
   - `payment_method`, `transaction_reference`
   - `issued_by_user_id` (Audited user ID of the verifying cashier/admin)
   - `issued_at` (ISO timestamp in Asia/Dhaka context)
   This payload is never altered even if the student later changes their name or contact details.

---

## 4. Idempotency & Concurrency Safety

1. **Verification Idempotency:**
   If a network glitch or user double-click calls `POST /payments/verify` twice, the endpoint executes:
   ```python
   existing_receipt = db.query(AdmissionReceipt).filter(
       AdmissionReceipt.tenant_id == tid,
       AdmissionReceipt.application_id == app.id,
       AdmissionReceipt.fee_category == payload.fee_category,
   ).first()
   if existing_receipt:
       return existing_receipt
   ```
   No second receipt is minted, and no invoice is double-paid.
2. **Row Locking:**
   The application row is checked out using `.with_for_update()` during verification and enrollment to prevent race conditions during high-concurrency admission rush hours.

---

## 5. Role Isolation Audit

- **Admin / Cashier:** Permitted to verify payments and issue receipts (`claims["roles"]` contains `admin` or `superadmin`).
- **Teachers:** Strictly **forbidden (HTTP 403)** from accessing `POST /payments/verify`, `POST /approve`, or `POST /enroll`.
- **Students / Guardians:** Strictly read-only access to their own receipts via `GET /{id}/receipt` or public status tracking.

