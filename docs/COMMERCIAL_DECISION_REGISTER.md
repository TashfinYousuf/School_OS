# EducationOS — Commercial Decision Register
**Document ID:** `docs/COMMERCIAL_DECISION_REGISTER.md`  
**Generated:** 2026-11-11  
**Author:** SaaS Product Strategist & Release Auditor  
**Status:** **PENDING FORMAL OWNER RATIFICATION (Configurable Defaults Staged)**  
**Target Market:** Bangladesh Primary, Secondary, Higher Secondary Schools & Coaching Academies  

---

## 1. Commercial Governance & Policy Statement

In strict adherence to Rule 3 (*"Never silently change approved business rules, pricing, billing or subscription semantics"*) and Rule 4 (*"Never invent prices, testimonials, customer counts, institutional partnerships, certifications, compliance status or payment capabilities"*), no commercial rate or discount is treated as finalized without explicit owner sign-off.

All values in the dynamic pricing engine are implemented as **configurable platform defaults** with draft status. This document formally tracks every required commercial parameter and its approval status.

---

## 2. Dynamic Pricing Parameter Register

| Decision Item | Proposed Baseline Default | Approval Status | Business Rationale & Notes |
| :--- | :--- | :---: | :--- |
| **CDR-01: Base Platform Fee** | **1,500 BDT / month** | `PENDING_OWNER_APPROVAL` | Covers minimum database, cloud storage, and baseline server compute per institution regardless of size. |
| **CDR-02: Per-Student Rate (Tier 1: 1–300 students)** | **12 BDT / student / month** | `PENDING_OWNER_APPROVAL` | Standard primary school capacity. 150 students = 1,800 BDT + base fee. |
| **CDR-03: Per-Student Rate (Tier 2: 301–800 students)** | **10 BDT / student / month** | `PENDING_OWNER_APPROVAL` | Volume discount for medium-sized secondary institutions. |
| **CDR-04: Per-Student Rate (Tier 3: 801+ students)** | **8 BDT / student / month** | `PENDING_OWNER_APPROVAL` | Large secondary colleges and multi-campus institutions. |
| **CDR-05: Core Platform Modules** | **Included in Base Fee** | `PENDING_OWNER_APPROVAL` | Includes: Admin, Students, Teachers, Guardian Portal, Academic Routine, Smart Attendance, Exams/Results, Notices, Basic Reports. |
| **CDR-06: Optional Paid Module — AI Assistant & Tutor** | **1,200 BDT / month** | `PENDING_OWNER_APPROVAL` | Includes 250,000 monthly Gemini API input/output tokens. Overage billed at cost + 20%. |
| **CDR-07: Optional Paid Module — Advanced Finance & Accounting** | **800 BDT / month** | `PENDING_OWNER_APPROVAL` | Automated fee invoice generation, dual-copy receipting, ledger reconciliation, and expense tracking. |
| **CDR-08: Optional Paid Module — Hosted School Website** | **1,000 BDT / month** | `PENDING_OWNER_APPROVAL` | Templated public institutional website, CMS editor, notices/events display, and SEO metadata. |
| **CDR-09: Optional Paid Module — Custom Domain Integration** | **500 BDT / month** | `PENDING_OWNER_APPROVAL` | Automated TLS provisioning and DNS hostname mapping (`school.edu.bd`). |
| **CDR-10: SMS Messaging Add-on** | **0.35 BDT / SMS** | `PENDING_OWNER_APPROVAL` | Passed through from Bangladesh telco/aggregator rate (no unlimited messaging claims). |
| **CDR-11: WhatsApp Messaging Add-on** | **0.80 BDT / message** | `PENDING_OWNER_APPROVAL` | Meta Cloud API messaging utility rate + gateway cost. |
| **CDR-12: Annual Billing Discount** | **15% Discount (or 10 mo fee for 12 mo)** | `PENDING_OWNER_APPROVAL` | Requires explicit owner confirmation prior to publishing on marketing calculator. |
| **CDR-13: Pilot Institution Terms (Kids Shine School)** | **60-Day Full Pilot at 0 BDT** | `APPROVED FOR PILOT` | Privileged pilot access granted with complimentary Core + Attendance + Finance modules. |
| **CDR-14: Grace Period Policy** | **14 Days Read-Only** | `PENDING_OWNER_APPROVAL` | Unpaid subscriptions enter restricted read-only mode after 14 days. Student records are NEVER deleted. |
| **CDR-15: Bangladesh VAT Compliance** | **Exempt / 0% unless registered** | `PENDING_OWNER_APPROVAL` | Local educational software tax treatment to be verified with certified tax accountant. |

---

## 3. Definition of Billable Active Student (Anti-Dispute Rule)

To prevent institutional fee disputes, the dynamic pricing engine calculates billable student volume using this precise formula:

$$\text{Billable Students} = \{ s \in \text{Students} \mid s.\text{tenant\_id} = T \land s.\text{is\_active} = \text{TRUE} \land s.\text{status} = \text{'ENROLLED'} \land (\text{attendance\_in\_last\_30d}(s) \lor \text{fee\_payment\_in\_last\_30d}(s)) \}$$

### Exclusions:
1. Graduated or alumni students (status = `GRADUATED`).
2. Officially withdrawn students (status = `WITHDRAWN`).
3. Inactive applicants who never enrolled.
4. Duplicate student records created in error (deduplicated by admission number).

---

## 4. Payment Settlement Strategy

### Mode A (Recommended Pilot MVP): Low-Cost Manual Reconciliation
1. Institution receives dynamic invoice with unique reference ID (`INV-2026-XXXX`).
2. Admin transfers funds via bKash Merchant / Bank Deposit / Nagad.
3. Admin enters TrxID and attaches deposit slip in billing portal.
4. Invoice transitions to `PENDING_REVIEW`.
5. EducationOS Finance Operations verifies against bank/merchant statement and approves.
6. Subscription transitions to `ACTIVE`.

### Mode B (Future Commercial Release): Automated Payment Gateway
- Activated only when legal merchant agreement and API credentials (bKash Checkout, SSLCommerz, Nagad) are executed by the platform owner.
- Requires server-to-server webhook verification with strict replay protection and idempotency keys.

