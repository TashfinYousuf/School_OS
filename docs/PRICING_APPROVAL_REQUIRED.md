# EDUCATIONOS — FORMAL OPERATOR APPROVAL GATE: COMMERCIAL PRICING
**Stage:** 12.5.7 Commercial Architecture Approval  
**Date:** 9 November 2026  
**Status:** ACTION REQUIRED FROM OPERATOR / CEO  
**Gate Status:** BLOCKED (CHANGES HELD IN STAGING UNTIL SIGNED OFF)

---

## 1. Summary of Proposed Changes

The engineering and product architecture team has formulated a comprehensive **Hybrid Usage-Based Pricing Model** to replace the legacy static tier system:

1. **Base Platform Fee**:
   - Schools: ৳ 2,500 / month
   - Academies: ৳ 3,500 / month
   - Colleges: ৳ 4,500 / month
2. **Graduated Student Volume Bands**:
   - 1 – 300 students: ৳ 15 / student / month
   - 301 – 800 students: ৳ 12 / student / month
   - 801 – 2,000 students: ৳ 10 / student / month
   - 2,001+ students: ৳ 8 / student / month
3. **Annual Incentive**:
   - 12 months of service charged for 10 months (2 months free).
4. **Pilot Invariant**:
   - Kids Shine School retains flat ৳ 5,000/month pilot terms for 6 months.

---

## 2. Strict Engineering Governance Invariant

> [!IMPORTANT]
> In accordance with Section 0 of the **Master Product Reconstruction Directive**, no code changes to `frontend/app/pricing/page.tsx`, `frontend/lib/plans.ts`, or `backend/app/api/endpoints/billing.py` will be applied until the operator/CEO provides explicit documented approval of this proposal.

### Approval Options:
- [ ] **APPROVE AS PROPOSED**: Proceed to code implementation and public website parity update.
- [ ] **APPROVE WITH MODIFICATIONS**: Adjust base fees or volume band thresholds.
- [ ] **MAINTAIN CURRENT TIERS**: Retain the existing 6 fixed tiers (Starter ৳ 4,999 to Enterprise ৳ 24,999).

