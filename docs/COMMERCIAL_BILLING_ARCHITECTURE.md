# EducationOS — Commercial Billing & FinOps Architecture
**Document ID:** `docs/COMMERCIAL_BILLING_ARCHITECTURE.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section F (Phase 4) Master Engineering Directive  
**Status:** **CANONICAL SPECIFICATION & BOUNDED CONTEXT ISOLATION**  

---

## 1. Executive Commercial Strategy

EducationOS operates under a **Hybrid Usage-Based Institutional Pricing Model** designed specifically for Bangladesh's educational economic landscape:
1. **Core Metric:** Number of active, enrolled students per institution per billing period.
2. **Platform Base Fee:** A predictable monthly institutional platform fee covering database isolation, daily backups, and core infrastructure.
3. **Volume-Tiered Student Bands:** Graduated per-student marginal pricing ensuring affordability for small community schools while scaling cost-effectively for large multi-campus institutions.
4. **Annual Incentive Rule:** **10 Months Charged for 12 Months of Service** (2 months free on upfront annual subscription).

---

## 2. Strict Bounded-Context Ledger Separation

A non-negotiable architectural invariant of EducationOS is the absolute structural and logical separation of the two financial domains:

```
┌─────────────────────────────────────────────────────────────┐
│                       EDUCATIONOS SaaS                      │
│                                                             │
│  [Institution / School Trust] ──(SaaS Subscription)──► [EducationOS]
│  • Platform Base Fee + Active Student Quota                 │
│  • Billed Monthly or Annually (BDT)                         │
│  • Governed by: InstitutionSubscription & SaaS Invoices     │
└─────────────────────────────────────────────────────────────┘
                               ▲
                       STRICT LEDGER SEPARATION
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 INSTITUTION ACADEMIC FINANCE                │
│                                                             │
│  [Parents / Guardians] ──(Tuition / Exam Fees)──► [School Cashier]
│  • Tuition Fees, Session Charges, Admission, Bus Fees       │
│  • Cash Counter, MFS Pay Slips, Thermal Receipts            │
│  • Governed by: FeePayment & Academic Student Balances      │
└─────────────────────────────────────────────────────────────┘
```

**Security Invariants:**
- Student tuition receipts are NEVER aggregated into EducationOS platform SaaS revenue.
- School financial officers cannot access EducationOS SaaS billing subscription keys.
- Subscription status (e.g., `PAST_DUE`) does NOT alter student academic fee balances.

---

## 3. Billable Active Student Definition

To ensure auditable, transparent billing without arbitrary customer surcharges, the following canonical rules govern billable student counts:
1. **Billable Student Eligibility:**
   - Any student record in `students` where `status = 'Active'` and `tenant_id = :tenant_id` at the time of the monthly billing snapshot.
2. **Excluded Student Categories:**
   - Archived, graduated, transferred out (TC issued), or suspended student records are NOT billable.
3. **Monthly Snapshot & Proration Policy:**
   - Billing is calculated from an auditable monthly snapshot timestamped on the first calendar day of the billing cycle.
   - Mid-cycle admissions are billed on the subsequent cycle snapshot, preventing fractional-day billing disputes.
4. **Dispute & Audit Record:**
   - Every SaaS subscription invoice immutably records:
     - `pricing_version`: e.g., `nctb_saas_v2026_1`
     - `active_students_snapshot_count`: Exact integer count
     - `base_fee_bdt`: Integer minor units (paisa) or Decimal
     - `calculated_total_bdt`: Exact breakdown

---

## 4. Canonical Pricing Calculation Specification

```python
def calculate_institutional_subscription(
    active_students: int,
    billing_cycle: str = "monthly",
    pricing_tier: str = "growth"
) -> dict:
    """
    Canonical backend pricing engine algorithm.
    Frontend calculator MUST call this service rather than inventing independent formulas.
    """
    # 1. Base platform fee
    base_fee_monthly = 2000 # BDT
    
    # 2. Graduated volume band per student
    if active_students <= 200:
        per_student_rate = 12 # BDT / student / mo
    elif active_students <= 500:
        per_student_rate = 10
    elif active_students <= 1000:
        per_student_rate = 8
    else:
        per_student_rate = 6

    student_charge_monthly = active_students * per_student_rate
    total_monthly = base_fee_monthly + student_charge_monthly

    # 3. Annual 10-Month discount formula
    if billing_cycle == "annual":
        total_billed = total_monthly * 10
        effective_monthly = total_billed / 12
        months_charged = 10
    else:
        total_billed = total_monthly
        effective_monthly = total_monthly
        months_charged = 1

    return {
        "active_students": active_students,
        "billing_cycle": billing_cycle,
        "base_platform_fee_bdt": base_fee_monthly,
        "per_student_rate_bdt": per_student_rate,
        "total_billed_bdt": total_billed,
        "effective_monthly_bdt": round(effective_monthly, 2),
        "annual_months_credited": 2 if billing_cycle == "annual" else 0,
        "currency": "BDT"
    }
```

