# EDUCATIONOS — PRICING MIGRATION & OPERATIONAL TRANSITION PLAN
**Stage:** 12.5.7 Pricing Strategy Migration  
**Author:** Principal Product Architect & Release Manager  
**Document Status:** TRANSITION PROPOSAL (AWAITING OPERATOR APPROVAL)  
**Date:** 9 November 2026

---

## 1. Migration Overview & Grandfathering Principles

To prevent churn or commercial friction during the transition from the legacy 6-tier static model to the hybrid usage-based model, EducationOS will execute a phased grandfathering strategy:

1. **Pilot Customers (Kids Shine School)**:
   - *Grandfathering Terms*: Kids Shine School is guaranteed pilot terms of ৳ 5,000/month flat for the initial 6 months as part of their pilot agreement.
   - *Post-Pilot Transition*: Migrates seamlessly to Base Fee (৳ 2,500) + 220 Students @ ৳ 15 (৳ 3,300) = ৳ 5,800/month.
2. **Early Adopter Schools**:
   - Granted 60-day notice prior to billing format transition.
   - Transparent itemized invoice showing exact student count vs previous flat tier.
3. **New Inbound Schools**:
   - Onboard directly into the hybrid model upon approval.

---

## 2. Technical Migration Checklist & Cutover Stages

```
[Phase 1: Operator Sign-Off]
├── Review docs/PRICING_APPROVAL_REQUIRED.md
└── Obtain documented operator approval

[Phase 2: Database Schema & Engine Implementation]
├── Create tenant_daily_active_students table via Alembic migration
├── Implement calculate_hybrid_subscription_fee in app/services/billing.py
└── Add unit test suite test_hybrid_pricing_engine.py

[Phase 3: Public Website & Client Parity]
├── Update frontend/lib/plans.ts with hybrid band constants
├── Enhance interactive ROI Calculator in frontend/app/pricing/page.tsx
└── Ensure 10-month annual formula invariants pass automated tests

[Phase 4: Billing Gateway & Notification Hook]
├── Wire bKash/Nagad checkout with dynamic invoice amounts
└── Emit monthly billing summary notifications to school administrators
```

---

## 3. Risk Mitigation & Fallback Invariants

| Risk Identified | Probability | Severity | Mitigation Strategy |
|---|---|---|---|
| **School enrolls sudden surge of students (e.g. admission month)** | High | Medium | 15% grace threshold: System never blocks student admission; charges adjust on subsequent monthly billing cycle. |
| **Operator rejects per-student pricing for small rural madrasas** | Medium | Low | Introduce "Rural / Micro-School Subsidy" toggle in admin configuration (50% base fee rebate). |
| **Data drift in active student count** | Low | High | Enforce daily snapshot idempotency; excluded archived/graduated/suspended students from billable count. |

