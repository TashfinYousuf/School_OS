# EducationOS — Commercial Owner Approvals & Ratification Sheet
**Document ID:** `docs/COMMERCIAL_OWNER_APPROVALS.md`  
**Generated:** 2026-11-11  
**Author:** SaaS Product Strategist & Release Auditor  
**Approval Status:** **PENDING FORMAL OWNER SIGN-OFF (Configurable Draft Baseline Staged)**  

---

## 1. Owner Ratification Mandate

In accordance with Rule 3 (*"Never silently change approved business rules, pricing, billing or subscription semantics"*) and Section 2.4 of the Master Directive:

> **The exact commercial values are not automatically approved:**
> Minimum platform fee, per-student rates, graduated pricing brackets, module rates, AI allowance, SMS/WhatsApp pricing, annual discount, trial policy, grace period, and tax treatment. If the owner has not approved a value, implement it as a configurable draft or mark it as pending approval. Do not publish invented rates.

This document serves as the formal review and sign-off register submitted to the EducationOS Platform Owner.

---

## 2. Commercial Approval Itemized Register

| Item ID | Parameter Name | Staged Proposal | Owner Decision | Notes & Conditions |
| :--- | :--- | :---: | :---: | :--- |
| **COA-01** | Base Platform Infrastructure Fee | **1,500 BDT / mo** | `PENDING_REVIEW` | Covers baseline PostgreSQL pooler, storage, and 9 Core Modules. |
| **COA-02** | Student Capacity Rate (1–300) | **12.00 BDT / student / mo** | `PENDING_REVIEW` | 150 students = 1,800 BDT monthly capacity charge. |
| **COA-03** | Student Capacity Rate (301–800)| **10.00 BDT / student / mo** | `PENDING_REVIEW` | Volume discount for growing secondary schools. |
| **COA-04** | Student Capacity Rate (801+) | **8.00 BDT / student / mo** | `PENDING_REVIEW` | High-volume multi-branch rate. |
| **COA-05** | AI Assistant & Exam Generator | **1,200 BDT / mo** | `PENDING_REVIEW` | Includes 250,000 monthly Gemini API input/output tokens. |
| **COA-06** | Advanced Finance & Tuition Fee | **800 BDT / mo** | `PENDING_REVIEW` | Dual-copy receipting, fee ledger, and bank reconciliation. |
| **COA-07** | Hosted School Website & CMS | **1,000 BDT / mo** | `PENDING_REVIEW` | Public school website with notice/event publishing. |
| **COA-08** | Custom Domain (`school.edu.bd`) | **500 BDT / mo** | `PENDING_REVIEW` | Managed TLS certificate and DNS hostname routing. |
| **COA-09** | WhatsApp Absentee Alerts Module| **600 BDT / mo** | `PENDING_REVIEW` | Automated WhatsApp message delivery to parent mobile. |
| **COA-10** | SMS Communication Credits | **0.35 BDT / SMS** | `PENDING_REVIEW` | Billed in bundles of 500 SMS (175 BDT). |
| **COA-11** | Extra AI Tokens Pack | **250 BDT / 500k tokens** | `PENDING_REVIEW` | Additional Gemini tokens when quota is exceeded. |
| **COA-12** | Annual Prepayment Discount | **15% Discount** | `PENDING_REVIEW` | Staged 15% discount for full 1-year prepayment. |
| **COA-13** | Kids Shine School Pilot Access | **60-Day Free Pilot** | `APPROVED FOR PILOT`| Full complimentary access to Core + Finance + Attendance. |
| **COA-14** | Unpaid Subscription Grace Period| **14 Days Read-Only** | `PENDING_REVIEW` | No data deletion. Schools retain export and read access. |
| **COA-15** | Payment Mode Strategy | **Mode A (Manual) First** | `APPROVED FOR PILOT`| Low-cost manual bank/bKash TrxID reconciliation for pilot. |

---

## 3. Owner Sign-Off Block

```
================================================================================
EDUCATIONOS PLATFORM OWNER COMMERCIAL RATIFICATION
================================================================================

I hereby confirm that I have reviewed the proposed commercial pricing 
parameters, student volume brackets, modular fee structure, and pilot 
complimentary policies set forth in this document.

[   ] APPROVED AS PROPOSED
[   ] APPROVED WITH MODIFICATIONS (Attached Below)
[   ] RETURNED FOR REVISION

Owner Name: _____________________________________________
Signature:  _____________________________________________
Date:       _____________________________________________
================================================================================
```

