# EducationOS — Production Support & Operations Manual
**Document ID:** `docs/PRODUCTION_SUPPORT_OPERATIONS.md`  
**Generated:** 2026-11-09  
**Version:** 1.0.0 (Production / Kids Shine Pilot)  
**Target Market:** Bangladesh Primary & Secondary Schools  
**Audience:** Customer Support, Product Operations, Customer Success, and DevOps  

---

## 1. Operational Support Philosophy

School operations in Bangladesh follow strict daily routines: school assemblies and attendance happen between 08:00 AM and 09:30 AM BST. Report card distribution and fee collection peaks happen around examination terms and the 1st–10th of every month.

The support organization must guarantee zero operational downtime during peak academic hours and provide accessible, localized assistance in both Bengali and English.

---

## 2. Multi-Tier Support Organization

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Customer Intake Channels                             │
│   WhatsApp Business API | In-App Helpdesk | School Direct Hotline       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1: Frontline School Support                                       │
│ • Local Bengali/English phone & WhatsApp response                      │
│ • Basic navigation, login recovery, roster upload formatting           │
│ • First-contact resolution target: 70%                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Escalation within 15 min if unresolvable)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 2: Product & Technical Operations                                 │
│ • Data reconciliation, payment TrxID investigation                     │
│ • Roster sanitization, subscription tier configuration                 │
│ • Tenant-safe administrative diagnostics (no raw DB access)            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Escalation within 30 min if code/infra bug)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 3: Core Engineering & Site Reliability (SRE)                      │
│ • Bug remediation, hotfixes, DB performance tuning                     │
│ • Security audit, AI Gateway policy, cloud infrastructure              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Operational Windows & Service Level Objectives (SLOs)

### Support Windows (Bangladesh Standard Time - UTC+6)
- **Standard Operating Hours:** Sunday – Thursday: 07:30 AM – 06:00 PM BST
- **Weekend / Exam Support:** Saturday: 08:30 AM – 02:00 PM BST
- **Automated Monitoring & Emergency P0 On-Call:** 24 hours / 7 days / 365 days

### Support Ticket Response & Resolution Targets

| Ticket Category | First Response Target | Target Resolution | Escalation Trigger |
| :--- | :--- | :--- | :--- |
| **P0 - System Down / Cannot take attendance** | < 15 minutes | < 2 hours | Immediate page to Tier 3 on-call |
| **P1 - Fee collection broken / Report card block** | < 30 minutes | < 4 hours | Escalated to Tier 2 after 20 mins |
| **P2 - Account lockout / Roster CSV error** | < 1 hour | < 8 hours | Escalated to Tier 2 after 1 hour |
| **P3 - General query / Theme adjustment** | < 4 hours | < 24 hours | Handled by Tier 1 within shift |

---

## 4. Standard Operating Procedures (SOPs)

### SOP-01: School Administrator Account Recovery & Verification
**Objective:** Securely reset an administrator's credentials without risking institutional hijacking.
1. **Verification Requirement:** Tier 1 agents must verify:
   - Official School EIIN / Registration Number.
   - School Headmaster's registered phone number.
   - Confirmation from the primary institutional billing email.
2. **Action:** Once verified, trigger a secure password reset link via `POST /api/v1/auth/forgot-password`.
3. **Prohibition:** Agents are strictly prohibited from setting temporary passwords manually or reading credentials.

### SOP-02: Bulk Student & Staff Roster Import Remediation
**Objective:** Assist schools encountering errors during CSV roster import.
1. Download the school's rejected CSV log (which masks personal contact info).
2. Validate required columns: `admission_number`, `first_name`, `last_name`, `class_name`, `section_name`, `guardian_phone`.
3. Check for common issues:
   - Bengali character encoding issues (ensure UTF-8 with BOM or standard UTF-8).
   - Phone numbers lacking national prefixes (`017XXXXXXXX` vs `+88017XXXXXXXX`).
   - Duplicate admission numbers within the same school.
4. Provide the cleaned, sanitized CSV back to the administrator for direct upload via `/dashboard/settings?tab=roster`.

### SOP-03: Payment & TrxID Reconciliation (bKash / Nagad / Bank)
**Objective:** Resolve discrepancies between school fee receipts and bank deposits.
1. Retrieve payment transaction ID (`TrxID`) provided by guardian or accountant.
2. Query the internal transaction audit log:
   ```bash
   GET /api/v1/billing/reconcile-lookup?trx_id=BKASH9928310
   ```
3. Check gateway status:
   - If gateway reports `COMPLETED` but EducationOS state is `PENDING`, click **Sync Transaction State** to trigger server-to-server inquiry.
   - If gateway reports `FAILED` or `NOT_FOUND`, advise accountant to request bank/MFS statement from payer.

### SOP-04: Report Card & Examination Result Re-generation
**Objective:** Fix published grade anomalies caused by late score submissions.
1. School administrator unlocks the exam term via `/dashboard/academics/grading`.
2. Subject teacher submits corrected raw score.
3. Administrator clicks **Recalculate GPA & Rank**.
4. Cached PDF report cards are automatically invalidated; fresh PDF is generated upon next download request.

---

## 5. Institutional Health & Satisfaction Metrics

Customer Success monitors the following real-time signals on the Admin FinOps & Telemetry Dashboard:

1. **Daily Active Attendance Rate (DAAR):** Percentage of registered classrooms submitting morning attendance before 10:00 AM BST. (Benchmark: > 92%).
2. **Parent Engagement Index (PEI):** Percentage of guardians logging in or acknowledging absentee notifications weekly. (Benchmark: > 65%).
3. **Receipting Regularity:** Frequency of fee collection ledger entries matching institutional term deadlines.
4. **Offline Queue Sync Latency:** Mean time for offline attendance mutations to synchronize once teacher reconnects to WiFi/4G. (Target: < 5 seconds).

