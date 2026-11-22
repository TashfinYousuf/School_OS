# EducationOS — Product Operations, Support & Expansion Roadmap (Stage 12.8)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Operations Engineer & Product Strategy Lead  
**Target Milestone:** Stage 12.8 Implementation  
**Execution Mode:** Gated Architectural Plan (Awaiting Authorization)

---

## 1. Executive Summary & Strategic Objectives

Stage 12.8 equips EducationOS with operational infrastructure to transition from engineering development into sustainable commercial SaaS operations. 

Key Operational Pillars:
1. **Integrated Support Ticketing & Human Escalation:** In-app ticket lifecycle engine routing inquiries from schools to support agents with strict SLA tracking.
2. **Searchable Help Center & Knowledge Base:** Self-service guides, FAQs, and video tutorials reducing support overhead.
3. **Privacy-Preserving Telemetry & Funnel Analytics:** Product usage metrics, onboarding funnel drops, and feature adoption tracking without logging student PII.
4. **Subscription Dunning & Churn Mitigation:** Automated dunning workflows preventing involuntary churn from failed mobile banking/card renewals.
5. **Internationalization & Multi-Currency Engine:** Standardized timezone handling (`Asia/Dhaka` baseline), multi-currency calculation, and dynamic bilingual EN/BN dictionary.
6. **Disciplined Native App Strategy:** Objective threshold criteria preventing premature native app fragmentation while maximizing PWA capabilities.
7. **Public API & Webhook Infrastructure:** Secure API key management and outbound webhooks for third-party institutional integrations.

---

## 2. Customer Support Ticketing & Human Escalation Engine

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Tenant Admin / │       │ Support Agent / │       │ Lead Engineer / │
│     Teacher     │       │ Tier 1 Support  │       │ Root Admin (L3) │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │ 1. Create Ticket        │                         │
         ├────────────────────────►│                         │
         │                         │ 2. Investigate & Reply  │
         │                         ├────────────────────────►│
         │                         │                         │
         │                         │ 3. Escalate (High/Crit) │
         │                         ├────────────────────────►│
         │                         │                         │ 4. Fix & Patch
         │ 5. Verified & Resolved  │                         ├───────────────┐
         │◄────────────────────────┴─────────────────────────┴───────────────┘
```

### 2.1 Domain Schema (`SupportTicket` & `SupportTicketMessage`)

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│           support_tickets            │          │       support_ticket_messages        │
├──────────────────────────────────────┤          ├──────────────────────────────────────┤
│ id: UUID (PK)                        │1        *│ id: UUID (PK)                        │
│ tenant_id: String(64) [Index]        ├──────────┤ ticket_id: UUID (FK) [Index]         │
│ creator_user_id: String(64)          │          │ sender_id: String(64)                │
│ ticket_number: String(32) [Unique]   │          │ sender_role: String(32)              │
│ category: String(32)                 │          │ is_internal_note: Boolean            │
│ priority: String(16)                 │          │ message_text: Text                   │
│ status: String(20)                   │          │ attachments_payload: JSONB           │
│ assigned_agent_id: String(64)        │          │ created_at: DateTime(UTC)            │
│ sla_due_at: DateTime(UTC)            │          └──────────────────────────────────────┘
│ resolved_at: DateTime(UTC)           │
│ created_at: DateTime(UTC) [Index]    │
└──────────────────────────────────────┘
```

### 2.2 Ticket Categories & SLA Tiers
- **Category Matrix:**
  - `BILLING_PAYMENT`: Payment verification, invoice issues, upgrade requests (SLA: 2 hours).
  - `EXAM_GRADING`: NCTB gradebook calculation discrepancies, pass/fail inquiries (SLA: 4 hours).
  - `ATTENDANCE_HARDWARE`: Biometric machine connectivity, sync failures (SLA: 4 hours).
  - `BUG_TECHNICAL`: UI crashes, routing errors, access permissions (SLA: 8 hours).
  - `DATA_MIGRATION`: Bulk student/staff CSV spreadsheet import assistance (SLA: 12 hours).
  - `GENERAL_INQUIRY`: Feature requests, product usage questions (SLA: 24 hours).
- **Priority Escalation:**
  - `URGENT`: Campus exam blocked or payment verified but plan not activated ➔ SMS alert dispatched to On-Call SaaS Engineering Lead.

---

## 3. Privacy-Preserving Telemetry & Funnel Analytics

EducationOS enforces strict data ethics: **Student, teacher, and guardian PII is never tracked in product analytics.**

### 3.1 Event Taxonomy (`telemetry_events`)
- **Tracked Operational Events:**
  - `onboarding_step_completed`: Tracking conversion through Steps 1 to 7.
  - `feature_invoked`: Anonymized usage counter for `omr_scan`, `socratic_query`, `nctb_report_generated`, `attendance_roll_call`.
  - `offline_sync_executed`: Record count and sync duration to monitor network quality.
  - `error_boundary_triggered`: Client React exception trace (sanitized of personal data).
- **Sanitization Invariant:** All event properties are passed through a PII scrubber removing phone numbers, student names, email addresses, and student IDs before logging.

### 3.2 Conversion & Operational Dashboards (Internal Admin)
- Real-time conversion funnel: `/onboard` step 1 ➔ step 7.
- Active Institution DAU/MAU ratios.
- Quota utilization heatmap across AI Exam Blueprints and WhatsApp alert credits.

---

## 4. Subscription Dunning & Churn Mitigation

To protect cash flow and minimize involuntary churn (caused by expired cards, low bKash balance, or forgotten renewals), EducationOS implements an automated dunning engine.

```
Day -3: Pre-Expiration Notice (In-App Banner + Admin Email)
Day  0: Expiration Date (Subscription enters PAST_DUE -> GRACE_PERIOD)
Day +1: Dunning Email 1: "Your EducationOS subscription has entered its 7-day grace period."
Day +3: Dunning SMS + WhatsApp alert to School Administrator.
Day +6: Urgent Warning: "24 hours remaining before write operations are suspended."
Day +7: Grace Period Expiration (Transition to SUSPENDED status).
Day +14: Inactive Account Survey: "How can we improve EducationOS for your campus?"
```

### Invariants:
- All dunning state transitions log an entry in `BillingAuditLog`.
- Data is preserved indefinitely during suspension (read-only mode enabled).

---

## 5. Internationalization, Currency & Timezone Architecture

### 5.1 Timezone Management
- **Standard Storage Invariant:** All database timestamps (`created_at`, `valid_until`, `period_start`) are stored in **UTC (`timezone=True`)**.
- **Domestic Institution Operations:** Scheduled school events, daily attendance cutoffs, and report card dates serialize in **`Asia/Dhaka` (UTC+6)** using Python `zoneinfo.ZoneInfo("Asia/Dhaka")`.
- **International Support:** Tenant profile stores `timezone` string (e.g. `Asia/Kolkata`, `Asia/Dubai`, `Asia/Singapore`), formatting dates to localized client time.

### 5.2 Multi-Currency Handling
- **Database Precision:** Stored as `Numeric(12, 2)` accompanied by a 3-character ISO currency code (`currency = "BDT"` | `"USD"` | `"EUR"`).
- **Exchange Rate Engine:** Central exchange rate table updated daily for international quote conversions:
  - Base currency: `BDT`.
  - Currency display: ৳ for BDT, $ for USD, € for EUR, ₹ for INR.

### 5.3 Dynamic Bilingual Dictionary (`i18n`)
- Centralized JSON translation dictionaries: `frontend/lib/i18n/en.json` and `frontend/lib/i18n/bn.json`.
- Type-safe React translation hook: `useTranslation()` ensuring zero untranslated fallback keys.

---

## 6. Mobile & Desktop Expansion Decision Framework

EducationOS will **not** build separate native mobile (React Native/Flutter) or desktop (Electron) applications prematurely. 

### Objective Evaluation Framework
Native application investment is gated on fulfilling **at least two** of the following empirical criteria over a 6-month commercial operating period:

| Criterion | Evaluation Metric | Threshold Required for Native Investment | Current Status |
|---|---|:---:|:---:|
| **Mobile Web Traffic Dominance** | Mobile device share of total active school logins | $\ge 70\%$ of teacher/guardian sessions on mobile | Currently $\approx 55\%$ |
| **Hardware Driver Barrier** | Browser PWA inability to interface with specific hardware | Inability of WebUSB/WebBluetooth to poll fingerprint biometric hardware or thermal receipt printers in background | PWA WebPush & Camera OMR suffice for $95\%$ of use cases |
| **Offline Sync Scale Ceiling** | Local queue size exceeding browser IndexedDB quotas | Regular sync queues $>5,000$ records per device per session | Current queues are $<500$ records |
| **Enterprise Client Contract Requirement** | Tier-1 client mandates app store distribution | Minimum 5 contracted enterprise institutions requiring MDM distribution | Not yet contracted |

**Strategic Directive:** Maintain **PWA-First** focus throughout 2026. The progressive web app delivers push notifications, camera scanning, offline attendance caching, and zero app store fee overhead.

---

## 7. Public API & Outbound Webhook Readiness

To prepare EducationOS for institutional integrations (e.g. smart turnstiles, government IPEMIS connectors, bespoke accounting software):

### 7.1 Developer API Authentication
- **Model:** `ApiKey(id, tenant_id, name, key_hash, prefix, scopes, is_active, expires_at)`.
- **Key Format:** `eos_live_sk_...` (Never stored in plaintext; hashed via SHA-256).
- **Scopes:** Granular permissions (`attendance:read`, `attendance:write`, `students:read`, `finance:read`).

### 7.2 Outbound Webhooks Engine
- Institutions configure webhook endpoints (e.g. `https://myschool.edu.bd/api/events`).
- Event types: `attendance.marked`, `invoice.paid`, `exam.published`, `student.admitted`.
- Webhook payloads signed with HMAC-SHA256 (`X-EducationOS-Signature`) with automatic exponential retry on endpoint failure.
