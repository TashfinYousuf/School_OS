# Phase 9: External Integrations Readiness Report (Domain, Email, SMS, Payments)

**Project:** EducationOS / SchoolOS Enterprise  
**Repository:** `TashfinYousuf/School_OS`  
**Pilot Institution:** Kids Shine International School (KSIS), Banani, Dhaka, Bangladesh  
**Execution Timestamp:** 2026-11-23T16:42:00+06:00 (Asia/Dhaka)  
**Classification:** Third-Party Integrations & Bangladesh Regulatory Compliance  
**Auditor:** Principal DevSecOps Architect  

---

## 1. Custom Domain & DNS Architecture

### 1.1 Production Hostname Allocation
- **Primary Web Application:** `https://schoolos.app` (or Vercel edge: `https://educationos.vercel.app`)
- **Core API Gateway:** `https://api.schoolos.app` (or Render service: `https://educationos-backend.onrender.com`)
- **Institution Portal Aliases:** `https://kidsshine.schoolos.app` (Multi-tenant subdomain resolution)

### 1.2 Required DNS Configurations
When mapping the custom apex domain:

| Type | Name | Target / Value | Purpose |
|---|---|---|---|
| `A` | `@` | `76.76.21.21` | Vercel Apex Ingress |
| `CNAME` | `www` | `cname.vercel-dns.com.` | Vercel WWW Alias |
| `CNAME` | `api` | `educationos-backend.onrender.com.` | Render Backend Ingress |

---

## 2. Transactional Email Integration

### 2.1 Current Pilot Mode: `EMAIL_PROVIDER=mock`
- Account activation tokens, guardian invitations, and password reset links are logged to the database `AccountInvitation` table and server audit log.
- Prevents accidental email spam to parents during initial testing and zero-cost operation.

### 2.2 Production Activation (Brevo / Resend / SMTP)
To enable live transactional dispatch:
1. Register domain in **Resend** or **Brevo**.
2. Add DNS verification records:
   - **SPF:** `v=spf1 include:spf.protection.outlook.com include:_spf.resend.com ~all`
   - **DKIM:** `resend._domainkey.schoolos.app`
   - **DMARC:** `v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@schoolos.app`
3. Set environment variable: `EMAIL_PROVIDER=resend` and `RESEND_API_KEY=re_...`.

---

## 3. Bangladesh SMS Gateway Integration

### 3.1 Current Pilot Mode: `SMS_GATEWAY_PROVIDER=mock`
- Daily attendance notifications ("Your child XYZ arrived at school at 08:15 AM") and fee alerts are safely routed to audit logs.

### 3.2 Bangladesh Regulatory (BTRC) Compliance
- In Bangladesh, commercial bulk/transactional SMS requires an approved Alpha Sender ID registered with the **Bangladesh Telecommunication Regulatory Commission (BTRC)**.
- **Supported Local Providers:**
  - **Greenweb Bangladesh:** `greenweb.com.bd` (REST API with token auth).
  - **Onnorokom SMS (OSEL):** `api2.onnorokomsms.com` (SOAP/REST).
- **Activation Gate:** Awaiting KSIS institutional trade license submission to BTRC for the sender ID `KIDSSHINE`.

---

## 4. Payment Gateway & Financial Custody

### 4.1 Current Pilot Mode: Institutional Cash & Manual bKash Reconciliation
- For the controlled KSIS pilot, tuition fees and admission fees are collected via:
  1. Direct school counter cash payments.
  2. Direct institutional bank deposits (e.g. City Bank, Brac Bank).
  3. School bKash Merchant account with manual TrxID logging.
- The accountant enters payment details; the system generates an immutable `FeePayment` record, updates invoice balances, issues a sequential money receipt number, and provides idempotency protection.

### 4.2 Automated Payment Gateways (Deferred to Post-Pilot)
- Direct automated online payment gateways (SSLCommerz, bKash Checkout, Nagad) are prepared via `app/api/endpoints/billing.py` but will remain in offline/manual mode until formal merchant agreements are executed by school management.
- **Zero Mocked Webhooks:** No simulated payment webhooks are represented as live transactions.

---

## 5. Phase 9 Conclusion

Integrations are architected for clean switching from pilot mock mode to live providers upon institutional credential delivery. No unauthorized financial or SMS charges were incurred. Approved for Phase 10 GitHub release.

