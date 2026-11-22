# EDUCATIONOS — HYBRID USAGE-BASED PRICING ENGINE SPECIFICATION
**Stage:** 12.5.7 Pricing Engine Engineering Design  
**Author:** Principal Software Architect & Financial Systems Lead  
**Document Status:** TECHNICAL SPECIFICATION (AWAITING APPROVAL PRIOR TO ENGINE ACTIVATION)  
**Date:** 9 November 2026

---

## 1. Architectural Objectives & Computational Invariants

1. **Deterministic Calculation**: Billing calculations must never rely on floating-point arithmetic. All rates, student counts, and invoice subtotals must be computed using `Decimal` or exact integer minor units (paisa / BDT cents).
2. **Graduated Tiering (Bracket Pricing)**: Pricing does not jump cliffs (which penalizes schools adding their 301st student); instead, student counts fill progressive brackets.
3. **Proration & Mid-Cycle Additions**: Students added during a billing cycle are snapshotted daily or metered based on active enrollment days.
4. **Offline Resilience**: Pricing definitions are baked into deterministic pure functions capable of running in both Python backend and TypeScript client-side calculators without discrepancy.

---

## 2. Mathematical Formalization & Bracket Function

Let $S$ be the total count of active enrolled students for tenant $T$ during billing month $M$.
Let $B$ be the base institutional platform fee.
Let $V_1, V_2, V_3, V_4$ be the graduated brackets:

$$\text{Bracket 1} (1 \le S \le 300): \quad R_1 = 15.00 \text{ BDT}$$
$$\text{Bracket 2} (301 \le S \le 800): \quad R_2 = 12.00 \text{ BDT}$$
$$\text{Bracket 3} (801 \le S \le 2000): \quad R_3 = 10.00 \text{ BDT}$$
$$\text{Bracket 4} (S > 2000): \quad R_4 = 8.00 \text{ BDT}$$

The student usage fee $U(S)$ is:
$$U(S) = \min(S, 300) \cdot R_1 + \max(0, \min(S - 300, 500)) \cdot R_2 + \max(0, \min(S - 800, 1200)) \cdot R_3 + \max(0, S - 2000) \cdot R_4$$

Total Monthly Invoice:
$$\text{Total Invoice}(S, \text{annual}=\text{False}) = B + U(S)$$
$$\text{Total Annual Invoice}(S, \text{annual}=\text{True}) = (B + U(S)) \times 10$$

---

## 3. Pure TypeScript Engine Prototype (Client-Side Parity)

```typescript
export interface PricingCalculationResult {
  baseFee: number;
  studentFee: number;
  totalMonthly: number;
  totalAnnual: number;
  effectiveRatePerStudent: number;
  breakdown: {
    bracket1Count: number;
    bracket1Cost: number;
    bracket2Count: number;
    bracket2Cost: number;
    bracket3Count: number;
    bracket3Cost: number;
    bracket4Count: number;
    bracket4Cost: number;
  };
}

export function calculateInstitutionalInvoice(
  studentCount: number,
  institutionType: "school" | "academy" | "college" = "school"
): PricingCalculationResult {
  const baseFees = {
    school: 2500,
    academy: 3500,
    college: 4500,
  };

  const baseFee = baseFees[institutionType] || 2500;
  const s = Math.max(0, Math.floor(studentCount));

  const b1Count = Math.min(s, 300);
  const b2Count = Math.max(0, Math.min(s - 300, 500));
  const b3Count = Math.max(0, Math.min(s - 800, 1200));
  const b4Count = Math.max(0, s - 2000);

  const b1Cost = b1Count * 15;
  const b2Cost = b2Count * 12;
  const b3Cost = b3Count * 10;
  const b4Cost = b4Count * 8;

  const studentFee = b1Cost + b2Cost + b3Cost + b4Cost;
  const totalMonthly = baseFee + studentFee;
  const totalAnnual = totalMonthly * 10; // 10-month annual formula

  return {
    baseFee,
    studentFee,
    totalMonthly,
    totalAnnual,
    effectiveRatePerStudent: s > 0 ? Math.round((totalMonthly / s) * 100) / 100 : 0,
    breakdown: {
      bracket1Count: b1Count,
      bracket1Cost: b1Cost,
      bracket2Count: b2Count,
      bracket2Cost: b2Cost,
      bracket3Count: b3Count,
      bracket3Cost: b3Cost,
      bracket4Count: b4Count,
      bracket4Cost: b4Cost,
    },
  };
}
```

---

## 4. Backend Billing Ingestion & Snapshot Cron

1. **Daily Metering Cron**:
   - Executes at 23:59:00 BD Time (`Asia/Dhaka`).
   - Counts `Student.query.filter(Student.tenant_id == tid, Student.status == 'Active').count()`.
   - Records into `tenant_daily_active_students` table:
     `{ tenant_id, date, active_student_count }`.
2. **Monthly Invoice Generation**:
   - Runs on the 1st of each month.
   - Computes $S = \text{max}(\text{active\_student\_count})$ across the prior 30 days.
   - Generates subscription invoice record with itemized line items:
     - Line 1: `Base Institutional Platform Fee - {Type}`
     - Line 2: `Active Enrolled Students ({S} Students across Graduated Bands)`
3. **Entitlement Engine Tie-In**:
   - Subscriptions in good standing grant unlimited student admission up to soft quota ($+15\%$ tolerance band).
   - If active enrollment exceeds the current volume band by $>15\%$, a notification is dispatched to school administration to adjust billing parameters without service disruption.

