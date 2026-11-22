# EDUCATIONOS — COMMERCIAL PRICING STRATEGY & UNIT ECONOMICS
**Stage:** 12.5.7 Commercial Architecture  
**Author:** Principal Product Architect & SaaS Commercial Strategy Analyst  
**Document Status:** PENDING OPERATOR SIGN-OFF (NO LIVE CHANGES WITHOUT APPROVAL)  
**Date:** 9 November 2026

---

## 1. Executive Summary & Market Context

The initial pricing model for EducationOS was based on 6 static tiers (Starter, Basic, Professional, Enterprise, Academy, College). While functional for early sales pitches, static tiering suffers from two critical flaws in the Bangladeshi educational ecosystem:

1. **Market Fragmentation**: A neighborhood primary school (e.g., Kids Shine School with 180–250 students) has vastly different budget elasticity compared to a premier English-medium school with 2,000+ students or a competitive test-prep academy (e.g., Udvash/Retina model) with 10,000+ examinees.
2. **Server & Cloud Cost Asymmetry**: Active student enrollment directly dictates database storage, background job processing, SMS notification volume, report card generation compute, and AI gateway token consumption. Flat tiers create margin compression on large accounts and high barrier-to-entry on smaller schools.

To establish EducationOS as a profitable, scalable SaaS serving Bangladesh initially and international emerging markets subsequently, we specify a **Hybrid Usage-Based Institutional Pricing Architecture**:
$$\text{Total Monthly Fee} = \text{Base Platform Fee} + \sum (\text{Active Enrolled Students} \times \text{Band Rate}) + \text{Add-On Consumption}$$

---

## 2. Unit Economics Breakdown (Cost of Goods Sold - COGS)

### Cost Per Active Enrolled Student Per Month (BDT)
| Cost Component | Monthly Cost per Active Student (BDT) | Basis / Driver |
|---|---|---|
| **Cloud Infrastructure (Compute & DB)** | ৳ 1.20 | PostgreSQL connection pool, Redis cache, Next.js edge compute. |
| **Object Storage & Backups** | ৳ 0.60 | PDF progress card archives, question papers, daily database snapshots. |
| **SMS / Notification Gateway** | ৳ 1.80 | Transactional morning absence SMS/WhatsApp alert (avg 4 alerts/month). |
| **AI Gateway & LLM Inference** | ৳ 1.40 | Teacher diary voice copilot, Socratic doubt solver, NCTB question drafting. |
| **Customer Support & DevOps Ops** | ৳ 1.50 | Local customer success, pilot onboarding, server monitoring. |
| **Total Blended COGS per Student** | **৳ 6.50** | **Baseline Direct Operational Expense** |

---

## 3. Recommended Hybrid Pricing Structure

### A. Base Institutional Platform Fee (Monthly)
The base platform fee guarantees minimum monthly recurring revenue (MRR) per tenant, covering tenant provisioning, domain routing, security governance, and baseline administrator access:
- **School Operating System (K-12 Primary & High Schools)**: **৳ 2,500 / month**
- **Academy Operating System (Coaching Centers & Test-Prep)**: **৳ 3,500 / month**
- **College Operating System (Higher Secondary & Intermediate)**: **৳ 4,500 / month**

### B. Active Enrolled Student Volume Bands (Graduated Per-Student Pricing)
Student billing is calculated monthly based on the peak count of active students (`status == 'Active'`):

| Volume Band | Student Count Range | Monthly Rate per Student (BDT) | Effective Gross Margin |
|---|---|---|---|
| **Tier 1 (Seed / Micro-School)** | 1 – 300 students | ৳ 15 / student / month | 56.7% |
| **Tier 2 (Standard School)** | 301 – 800 students | ৳ 12 / student / month | 45.8% |
| **Tier 3 (Institutional Scale)** | 801 – 2,000 students | ৳ 10 / student / month | 35.0% |
| **Tier 4 (Enterprise / Multi-Campus)** | 2,001+ students | ৳ 8 / student / month | 23.1% |

### C. Annual Billing Discount Formula
- To lock in predictable institutional cash flow and eliminate monthly collection overhead, institutions paying annually receive **12 months of service for the price of 10 months** (a 16.67% discount, equivalent to **2 months free**).

---

## 4. Realistic Institutional Scenarios

### Scenario A: Kids Shine School (Pilot Customer — 220 Students)
- Base Platform Fee: ৳ 2,500
- Active Students (Band 1: $220 \times ৳ 15$): ৳ 3,300
- **Total Monthly Charge**: **৳ 5,800 / month** (or **৳ 58,000 / year**)
- Blended Cost to Deliver: $220 \times ৳ 6.50 = ৳ 1,430$
- **Net Institutional Contribution Margin**: **75.3%**

### Scenario B: Regional High School (650 Students)
- Base Platform Fee: ৳ 2,500
- First 300 Students ($300 \times ৳ 15$): ৳ 4,500
- Remaining 350 Students ($350 \times ৳ 12$): ৳ 4,200
- **Total Monthly Charge**: **৳ 11,200 / month** (or **৳ 1,12,000 / year**)
- Blended Cost to Deliver: $650 \times ৳ 6.50 = ৳ 4,225$
- **Net Institutional Contribution Margin**: **62.3%**

### Scenario C: Premier College / Academy (2,500 Students)
- Base Platform Fee: ৳ 4,500
- First 300 Students ($300 \times ৳ 15$): ৳ 4,500
- Next 500 Students ($500 \times ৳ 12$): ৳ 6,000
- Next 1,200 Students ($1,200 \times ৳ 10$): ৳ 12,000
- Remaining 500 Students ($500 \times ৳ 8$): ৳ 4,000
- **Total Monthly Charge**: **৳ 31,000 / month** (or **৳ 3,10,000 / year**)
- Blended Cost to Deliver: $2,500 \times ৳ 6.50 = ৳ 16,250$
- **Net Institutional Contribution Margin**: **47.6%**

