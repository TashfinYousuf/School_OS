# EducationOS — Authoritative Dynamic Pricing Engine Specification
**Document ID:** `docs/DYNAMIC_PRICING_ENGINE_SPEC.md`  
**Generated:** 2026-11-11  
**Author:** SaaS Product Strategist & Financial Systems Architect  
**Version:** 2026.1-dynamic  
**Implementation Modules:** `backend/app/services/pricing_engine.py`, `backend/app/api/endpoints/billing.py`, `frontend/lib/plans.ts`  

---

## 1. Architectural Philosophy & Single Source of Truth

Fixed, rigid SaaS tier packages (`Starter`, `Growth`, `Pro`) fail to serve educational institutions whose capacities vary widely (e.g. 80 students, 240 students, 620 students).

The **EducationOS Dynamic Pricing Engine** establishes an authoritative, single-source-of-truth service where:
1. **The Backend is the Pricing Authority:** Frontend-submitted total amounts are untrusted. Every checkout, invoice, and subscription is calculated or verified server-side.
2. **Transparent Variable Capacity:** Pricing scales smoothly based on verified active student enrollments, base platform compute, and modular add-ons.
3. **Immutable Invoice Snapshots:** Line items on generated invoices store immutable unit prices and student counts. Changing future platform rates never alters historical financial records.

---

## 2. Dynamic Pricing Calculation Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                   TOTAL MONTHLY GROSS (BDT)                            │
│                                                                        │
│   Base Platform Fee (1,500 ৳)                                          │
│   + Graduated Active Student Capacity Charge (12 ৳ / 10 ৳ / 8 ৳)       │
│   + Selected Optional Paid Modules (AI Copilot, Advanced Finance, etc) │
│   + Service Usage Add-ons (SMS Credits, Extra AI Token Packs)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
       [ Monthly Billing ]                     [ Annual Billing ]
     Gross Monthly Amount                   Gross Monthly × 12 Months
       (Billed every 30 days)                - 15% Approved Discount
                                            = Total Net Annual Investment
```

### 2.1 Base Platform Infrastructure Fee
- **Rate:** **1,500 BDT / month**
- **Coverage:** Managed PostgreSQL high-availability database connection, daily automated WAL backups, tenant data isolation, cloud server compute, and all 9 Core Platform Modules.

### 2.2 Graduated Active Student Capacity Brackets
Student capacity fees scale on a progressive graduated tier to reward expanding institutions:

| Student Volume Bracket | Rate per Active Student (BDT/mo) | Bracket Capacity | Marginal Subtotal (BDT) | Cumulative Cap (BDT) |
| :--- | :---: | :---: | :---: | :---: |
| **Tier 1: 1 – 300 Students** | **12.00 ৳** | 300 students | 3,600.00 ৳ | 3,600.00 ৳ |
| **Tier 2: 301 – 800 Students** | **10.00 ৳** | 500 students | 5,000.00 ৳ | 8,600.00 ৳ |
| **Tier 3: 801+ Students** | **8.00 ৳** | Unlimited | Variable | $8,600.00 + (N - 800) \times 8.00$ ৳ |

*Example 1 (Kids Shine Pilot - 150 students):* $150 \times 12 = 1,800$ BDT student charge.  
*Example 2 (Medium School - 500 students):* $(300 \times 12) + (200 \times 10) = 3,600 + 2,000 = 5,600$ BDT student charge.

---

## 3. Module & Service Catalogue

### 3.1 Core Platform Modules (Included in Base Platform Fee)
Every registered institution automatically receives full access to these operational essentials:
1. `core_admin`: Institution Administration, Campus Setup, Academic Calendar.
2. `core_students`: Student Directory, Admissions, Student 360 Digital Twin.
3. `core_teachers`: Teacher & Staff Management, Classroom Allocations.
4. `core_guardians`: Guardian / Parent Portal with linked children overview.
5. `core_academic`: Grade Levels, Sections, Subjects, Class Routines.
6. `core_attendance`: 1-Tap Attendance Roll Call, PWA Offline Sync, CSV/Print export.
7. `core_exams`: Term Exams, Mark Sheets, NCTB/GPA Registry, Report Cards.
8. `core_notices`: Notice Composer, Emergency Broadcasts.
9. `core_reports`: Operational Summaries, Daily Absence Roster.

### 3.2 Optional Paid Modules

| Module Key | Name | Monthly Fee (BDT) | Entitlements & Features Granted |
| :--- | :--- | :---: | :--- |
| `module_ai_assistant` | **AI Copilot & Question Paper Generator** | **1,200 ৳** | 250k monthly Gemini API tokens, automated exam question drafting, syllabus chunk RAG. |
| `module_advanced_finance` | **Advanced Finance & Fee Collection** | **800 ৳** | Dual-copy tuition receipts, cash/bKash ledger reconciliation, fee arrears ledger. |
| `module_school_website` | **Hosted Institutional Public Website** | **1,000 ৳** | Templated public school website, CMS notice/gallery editor, admission lead capture. |
| `module_custom_domain` | **Custom Domain & Managed SSL** | **500 ৳** | Automated DNS hostname verification (`school.edu.bd`) with automated TLS renewal. |
| `module_whatsapp_alerts` | **Automated WhatsApp Absentee Alerts** | **600 ৳** | Real-time automated WhatsApp message delivery to parent mobile upon absence. |

### 3.3 Service Usage Add-ons
- `sms_bundle_500`: **175 BDT** per 500 SMS Communication Credits (0.35 BDT / SMS).
- `ai_tokens_500k`: **250 BDT** per 500,000 Extra AI Model Tokens.

---

## 4. Anti-Dispute Billable Active Student Definition

To eliminate billing disagreements between schools and the platform:
- **Active Student:** An enrolled student associated with the tenant who has at least one attendance mark or fee payment recorded within the active 30-day billing cycle.
- **Excluded Records:**
  - Archived or alumni students (`status = 'GRADUATED'`).
  - Officially transferred or withdrawn students (`status = 'WITHDRAWN'`).
  - Inactive application drafts.

---

## 5. Authoritative API Specifications

### `POST /api/v1/billing/calculate-quote`
- **Request Payload:**
  ```json
  {
    "institution_type": "school",
    "student_count": 250,
    "selected_modules": ["module_ai_assistant", "module_advanced_finance"],
    "add_ons": { "sms_bundle_500": 2 },
    "billing_cycle": "annual",
    "pilot_code": null
  }
  ```
- **Response Payload:**
  ```json
  {
    "pricing_version": "2026.1-dynamic",
    "is_owner_approved": false,
    "institution_type": "school",
    "student_count": 250,
    "billing_cycle": "annual",
    "base_platform_fee_bdt": 1500.0,
    "student_charge_bdt": 3000.0,
    "modules_subtotal_bdt": 2000.0,
    "addons_subtotal_bdt": 350.0,
    "monthly_gross_bdt": 6850.0,
    "discount_percent": 15.0,
    "discount_amount_bdt": 12330.0,
    "monthly_net_bdt": 5822.5,
    "total_due_bdt": 69870.0,
    "billing_period_months": 12,
    "line_items": [...],
    "entitlements_granted": [...],
    "is_complimentary_pilot": false,
    "notes": ["Annual billing applied: 15% discount saved 12,330.00 BDT."]
  }
  ```

