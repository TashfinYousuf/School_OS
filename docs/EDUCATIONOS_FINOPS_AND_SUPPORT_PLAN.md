# EducationOS — FinOps, Support & Operational Readiness Plan
**Document ID:** `docs/EDUCATIONOS_FINOPS_AND_SUPPORT_PLAN.md`  
**Execution Standard:** Stage 10 Operational Governance  
**Generated:** 2026-11-11  
**Status:** **AUTHORITATIVE OPERATIONAL SPECIFICATION**  
**Pilot Customer:** Kids Shine School, Dhaka, Bangladesh  

---

## 1. Operational Support Model (Tiers & SLAs)

To guarantee high institutional confidence and zero operational friction for school principals, teachers, accountants, and parents, EducationOS establishes a 3-tier support hierarchy:

```
[ Tier 1: Campus Onboarding & WhatsApp Desk ]
           │ (Unresolved / Technical Issue)
           ▼
[ Tier 2: SaaS Application Support Engineers ]
           │ (Code Bug / Cloud / Infrastructure)
           ▼
[ Tier 3: Core Platform Engineering & SRE ]
```

### 1.1 Support Tier Definitions

| Tier Level | Responsible Team | Coverage Hours | Contact Channels | Scope & Capabilities | Response SLA | Resolution SLA |
| :--- | :--- | :--- | :--- | :--- | :---: | :---: |
| **Tier 1: Campus Helpdesk** | Dedicated School Success Specialist | 07:30 – 17:00 (Sun–Thu) | Dedicated WhatsApp Hotline, Direct Phone, On-Site (Dhaka) | Password resets, guardian portal guidance, fee entry assistance, routine troubleshooting | < 15 mins | < 1 hour |
| **Tier 2: Application Support** | SaaS Support Engineering Team | 07:00 – 21:00 (Sun–Thu), On-Call Friday | In-App Helpdesk, Ticket Escalation, Email | Ledger reconciliation, failed payment tracing, student transfer unlinking, bulk roster imports | < 30 mins | < 4 hours |
| **Tier 3: Platform SRE** | Core DevOps & Database Engineering | 24/7/365 Continuous On-Call | PagerDuty, Internal Slack `#incident-war-room` | Database deadlocks, Supabase pooler saturation, Vercel edge routing errors, security alerts | < 15 mins (P0) | < 2 hours (P0) |

---

## 2. Incident Classification & Escalation Matrix

| Priority | Definition | Real-World School Example | Escalation Path | Communication Cadence |
| :---: | :--- | :--- | :--- | :--- |
| **P0: Critical Outage** | Entire platform or vital institutional workflow unavailable during operating hours | Morning roll call blocked across all classes; Term exam grading crash during report card release | Direct page to Tier 3 Lead & CTO within 5 mins; emergency war room | Status updates to Principal every 15 minutes |
| **P1: Major Degradation** | Critical business function impaired with no immediate workaround | MFS payment gateway rejecting bKash transactions; SMS blast queue stuck during emergency school closure | Tier 2 dispatches to Gateway Lead; fallback payment rails enabled | Status updates every 45 minutes |
| **P2: Moderate Issue** | Workflow impaired but clear manual workaround exists | PDF receipt logo rendering misaligned; daily lesson plan auto-generator slow | Tier 1 logs bug ticket; Tier 2 schedules fix for next daily sprint release | Notification upon patch deployment |
| **P3: Minor / Request** | Non-blocking cosmetic defect or enhancement suggestion | Teacher requests new filter by student blood group; color scheme tweak | Product backlog triage; evaluated during bi-weekly roadmap grooming | Product backlog notification |

---

## 3. Dedicated Kids Shine School Pilot Support Package

For the initial institutional pilot at **Kids Shine School**:
1. **On-Site Launch Specialist:**
   A dedicated EducationOS support specialist will be present on-site at the school campus during the first 3 days of launch (morning arrival through afternoon dismissal).
2. **Dedicated WhatsApp Pilot Group:**
   Direct real-time WhatsApp bridge connecting the Kids Shine Headmaster, Head Accountant, Lead Teacher, and the EducationOS Principal Software Architect.
3. **Daily Evening Sync:**
   15-minute daily check-in at 16:30 BST to review roll-call completion, fee payments recorded, and any reported guardian friction.

---

## 4. FinOps Governance & Cost Alerts

1. **Daily Cloud Consumption Audits:**
   Automated daily script evaluates Gemini Flash token consumption, database storage, and edge egress.
2. **Proactive Budget Threshold Alerts:**
   - **50% of Tenant AI Quota:** Informational email sent to school administrator.
   - **80% of Tenant AI Quota:** Warning banner in Admin Dashboard recommending token top-up.
   - **100% of Tenant AI Quota:** Graceful degradation; AI question generator throttles and prompts manual editing; zero overage charges without explicit pre-payment.
3. **Storage Cap Enforcement:**
   Maximum upload size capped at 5 MB per student document; automatic image compression to WebP (< 250 KB) ensures Cloudflare R2 storage remains well within the zero-cost base tier.

