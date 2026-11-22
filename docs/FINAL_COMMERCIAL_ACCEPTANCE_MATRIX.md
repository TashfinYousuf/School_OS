# EducationOS — Final Commercial Acceptance Matrix
**Document ID:** `docs/FINAL_COMMERCIAL_ACCEPTANCE_MATRIX.md`  
**Generated:** 2026-11-09  
**Version:** 1.0.0 (Commercial SaaS Foundation)  
**Target Market:** Bangladesh Primary & Secondary Schools (B2B SaaS)  
**Status:** **COMMERCIALLY STAGED & VERIFIED**  
**Commercial Gate Status:** **GO FOR CONTROLLED PILOT / STAGED BILLING**  

---

## 1. Commercial SaaS Model & Value Proposition

EducationOS provides an institutional multi-tenant SaaS platform tailored specifically to the economic realities and regulatory environment of Bangladesh schools.

### Pricing Architecture Summary

| Tier Name | Base Monthly Fee (BDT) | Included Active Students | Per-Student Overage (BDT/mo) | Key Features Included |
| :--- | :--- | :--- | :--- | :--- |
| **Starter / Pilot** | 0 BDT (Free / 60-day Pilot) | Up to 150 students | N/A | Full Attendance, Student 360, Basic Fee Collection, PWA Offline Sync, Guardian Portal |
| **Standard School** | 3,500 BDT / month | Up to 350 students | 12 BDT / student | Full Core Suite, Exam & Report Cards, WhatsApp Absentee Alerts, Bulk Roster Import, Standard Support |
| **Growth Academy** | 7,500 BDT / month | Up to 800 students | 10 BDT / student | All Standard features + AI Question Generator, AI Attendance Summary, Custom School Branding, Priority Support |
| **Enterprise Multi-Campus** | Custom Quote | 1,500+ students | Volume Tiered | Multi-branch analytics, Dedicated Database Replica, Custom Domain, SLA Guarantee, Onsite Training |

---

## 2. Active Student Calculation Methodology

To ensure transparent and ethical commercial billing without dispute:
1. **Definition of "Active Student":** A student who is:
   - Formally enrolled in the institution's current academic year; AND
   - Has at least one recorded attendance mark (Present, Absent, Late) or fee transaction within the active 30-day billing cycle.
2. **Excluded Students:**
   - Graduated, transferred, or officially withdrawn students (status = `ARCHIVED` or `WITHDRAWN`).
   - Inactive applicants whose admission was never finalized.
3. **Automated Monthly Metering Job:**
   ```sql
   SELECT COUNT(DISTINCT s.id) AS billable_student_count
   FROM students s
   JOIN enrollments e ON s.id = e.student_id
   WHERE s.tenant_id = :tenant_id
     AND s.is_active = TRUE
     AND s.status = 'ENROLLED'
     AND EXISTS (
       SELECT 1 FROM attendance a 
       WHERE a.student_id = s.id 
         AND a.date >= NOW() - INTERVAL '30 days'
     );
   ```

---

## 3. Subscription State Machine Verification

| Current State | Trigger / Event | Target State | Functional Behavior Enforced | Status |
| :--- | :--- | :--- | :--- | :--- |
| **ONBOARDING** | School registers via `/onboard` | **TRIALING** | 60-day full-access trial granted. Institutional records unrestricted. | **PASS** |
| **TRIALING** | 60 days elapse without payment | **GRACE_PERIOD** | 14-day banner warning displayed to School Admin. Full operational features remain active. | **PASS** |
| **GRACE_PERIOD** | Verified payment received | **ACTIVE** | Subscription renewed for 30/365 days. Next billing date recalculated. | **PASS** |
| **GRACE_PERIOD** | 14 days elapse with zero payment | **RESTRICTED** | School enters Read-Only mode. Teachers/Admins can view and export records; new writes blocked. Student data NEVER deleted. | **PASS** |
| **ACTIVE** | Payment fails on billing date | **PAST_DUE** | 3 automated retry attempts over 7 days via payment gateway webhook. | **PASS** |
| **RESTRICTED** | Payment settled | **ACTIVE** | Instant automatic reactivation. Full write permissions restored immediately. | **PASS** |

---

## 4. Payment Gateway Adapter Sandboxing & Verification

| Gateway Provider | Environment | Security Protocol | Callback / Webhook Validation | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **bKash Checkout** | Sandbox / UAT | Tokenized REST API with AES-256 encrypted app secrets | Query Payment API (`/v1.2.0-beta/tokenized/checkout/execute`) with server-side validation | **VERIFIED IN SANDBOX** |
| **Nagad Direct** | Sandbox / UAT | RSA public/private key verification | Server-side IPN verification against Nagad verify endpoint | **VERIFIED IN SANDBOX** |
| **SSLCommerz** | Sandbox / UAT | Session token + SHA-256 hash validation | Server-to-server IPN query (`/validator/api/validationserverAPI.php`) | **VERIFIED IN SANDBOX** |
| **Manual Cash / Cheque** | Production Office | Two-person dual approval | Admin uploads scanned bank deposit slip -> Operations approves | **VERIFIED** |

---

## 5. Commercial Acceptance Verification Matrix

| Commercial Acceptance Criteria | Verification Standard | Result | Audit Evidence |
| :--- | :--- | :---: | :--- |
| **Zero Hidden Fees** | Invoices list exact student tiers, base fee, overage, and VAT breakdown. | **PASS** | `backend/app/services/billing_calculator.py` |
| **Data Preservation Guarantee** | Unpaid or canceled accounts are never deleted; records remain exportable. | **PASS** | Data retention policy in `docs/COMMERCIAL_BILLING_ARCHITECTURE.md` |
| **Tenant Domain Isolation** | Billing records strictly partitioned by `tenant_id`. No cross-tenant invoice visibility. | **PASS** | Red-team test `test_cross_tenant_billing_isolation` passed |
| **SaaS vs School Fee Segregation** | School fee collections (tuition) are strictly separated from SaaS platform subscriptions. | **PASS** | Distinct database schemas & API endpoints |
| **Refund & Chargeback Policy** | Clear dispute resolution within 7 days for duplicate charges. | **PASS** | Defined in `docs/COMMERCIAL_BILLING_ARCHITECTURE.md` |

