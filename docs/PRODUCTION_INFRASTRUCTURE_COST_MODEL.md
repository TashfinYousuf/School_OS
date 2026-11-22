# EducationOS — Production Infrastructure Cost Model & Unit Economics
**Document ID:** `docs/PRODUCTION_INFRASTRUCTURE_COST_MODEL.md`  
**Generated:** 2026-11-11  
**Status:** **AUTHORITATIVE COMMERCIAL FINOPS SPECIFICATION**  
**Currency Base:** BDT (Bangladeshi Taka) & USD (Exchange Benchmark: 1 USD = 120 BDT)

---

## 1. Executive Summary

This document establishes the comprehensive unit economics, fixed platform overhead, variable per-tenant infrastructure costs, and gross margin analysis for EducationOS across institutional growth stages:
- **Pilot Phase:** 1 School (Kids Shine School, 350 students)
- **Early Commercial:** 5–10 Schools (1,500–3,500 students)
- **Growth Commercial:** 25–50 Schools (10,000–25,000 students)
- **Scale Commercial:** 100+ Schools (50,000+ students)

Gross margins on SaaS software revenue remain **above 85%** across all stages due to multitenant shared-compute architecture, Cloudflare zero-egress storage, and Gemini Flash cost optimization.

---

## 2. Fixed Platform Overhead (Monthly)

| Service Layer | Provider & Tier | Specifications | Monthly Cost (USD) | Monthly Cost (BDT) |
| :--- | :--- | :--- | :--- | :--- |
| **Database & Auth** | Supabase Pro | 8 GB DB, 100k MAU, Point-in-time recovery (PITR), Compute Add-on | $25.00 | 3,000 BDT |
| **Frontend CDN / SSR** | Vercel Pro | Unlimited preview deploys, 1 TB bandwidth, edge middleware | $20.00 | 2,400 BDT |
| **Backend API Runner** | DigitalOcean / Hetzner Cloud | 4 vCPU, 8 GB RAM, NVMe SSD (Dockerized FastAPI + Celery) | $32.00 | 3,840 BDT |
| **Object Storage (Base)** | Cloudflare R2 | 10 GB free tier + Zero egress fees | $0.00 | 0 BDT |
| **Edge DNS & Security** | Cloudflare Pro | Advanced WAF, DDoS protection, managed SSL, page rules | $20.00 | 2,400 BDT |
| **Telemetry & Error Tracking** | Sentry Team + BetterStack | 50k error events/mo, 10 uptime checks, SMS alerts | $26.00 | 3,120 BDT |
| **Domain & DNS Registrations** | Cloudflare Registrar | `educationos.app`, `schoolos.cloud`, `educationos.bd` | $3.50 | 420 BDT |
| **TOTAL FIXED MONTHLY** | — | — | **$126.50** | **15,180 BDT** |

---

## 3. Variable Per-Tenant Unit Economics (Monthly COGS)

### 3.1 Unit Cost Drivers per Student / School

| Cost Component | Unit Metric | Unit Price (USD) | Unit Price (BDT) | Typical Consumption (School of 350 Students) | Monthly Cost per School (BDT) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AI Inference (Gemini Flash)** | Per 1M input / 1M output | $0.075 / $0.30 | 9 BDT / 36 BDT | 2.5M input tokens, 500k output tokens | ~40.50 BDT |
| **Document Storage (R2)** | Per GB-month (after base) | $0.015 / GB | 1.80 BDT / GB | 15 GB cumulative documents/receipts | 27.00 BDT |
| **SMS Notifications (Optional)** | Per outbound SMS message | $0.003 / SMS | 0.35 BDT / SMS | 350 SMS (1 blast/month or bill alert) | 122.50 BDT (billed to school) |
| **Payment Gateway Surcharge** | Per online settlement | 1.5% – 2.0% | 1.5% – 2.0% | Deducted at merchant settlement | 0 BDT (Direct merchant cost) |
| **Incremental Database Storage** | Per GB data storage | $0.125 / GB | 15.00 BDT / GB | ~0.5 GB relational records/year | 7.50 BDT |
| **Backup Archive Egress** | Periodic cold backups | $0.005 / GB | 0.60 BDT / GB | 2 GB compressed dump monthly | 1.20 BDT |
| **TOTAL VARIABLE COGS** | **Per School / Month** | — | — | — | **~76.20 BDT** (excl. SMS) |

---

## 4. Gross Margin Analysis Across School Profiles

### 4.1 Profile A: Kids Shine School Pilot (350 Students)
- **Monthly Subscription Price (Quote):** 5,000 BDT (Special pilot grant / staged baseline fee)
- **Included Add-ons:** Core Modules + Attendance + Gradebook + Guardian Portal
- **Variable COGS:** 76.20 BDT
- **Dedicated SMS Gateway Usage (Self-funded):** 0 BDT platform COGS
- **Gross Profit per Month:** 4,923.80 BDT
- **Gross Margin:** **98.4%**

### 4.2 Profile B: Mid-Sized School (600 Students, Commercial)
- **Dynamic Quote Formula:**
  - Base Fee: 1,500 BDT
  - Students: 300 @ 12 BDT + 300 @ 10 BDT = 3,600 + 3,000 = 6,600 BDT
  - Modules: AI Copilot (1,200 BDT) + Finance (800 BDT) = 2,000 BDT
  - **Total Monthly Revenue:** 10,100 BDT
- **Variable COGS:** 130 BDT (Higher AI & storage consumption)
- **Gross Profit per Month:** 9,970 BDT
- **Gross Margin:** **98.7%**

### 4.3 Profile C: Large School (1,200 Students, Commercial)
- **Dynamic Quote Formula:**
  - Base Fee: 1,500 BDT
  - Students: 300 @ 12 BDT + 500 @ 10 BDT + 400 @ 8 BDT = 3,600 + 5,000 + 3,200 = 11,800 BDT
  - Modules: AI Copilot (1,200 BDT) + Finance (800 BDT) + Custom Domain (500 BDT) = 2,500 BDT
  - **Total Monthly Revenue:** 15,800 BDT
- **Variable COGS:** 260 BDT
- **Gross Profit per Month:** 15,540 BDT
- **Gross Margin:** **98.3%**

---

## 5. Portfolio Break-Even & Financial Runway

| Metric | 1 School (Pilot) | 5 Schools | 25 Schools | 100 Schools |
| :--- | :--- | :--- | :--- | :--- |
| **Total Students** | 350 | 2,500 | 15,000 | 60,000 |
| **Gross Monthly SaaS Revenue** | 5,000 BDT | 42,000 BDT | 260,000 BDT | 1,150,000 BDT |
| **Variable COGS (Cloud + AI)** | 76 BDT | 550 BDT | 3,800 BDT | 16,500 BDT |
| **Fixed Platform Overhead** | 15,180 BDT | 15,180 BDT | 24,000 BDT (Scaled) | 48,000 BDT (Scaled) |
| **Net Infrastructure Profit / (Loss)** | **(10,256 BDT)** | **+26,270 BDT** | **+232,200 BDT** | **+1,085,500 BDT** |
| **Break-Even Threshold** | Break-even achieved at **2 paid commercial schools**. | — | — | — |

---

## 6. FinOps Controls & Cost Protection Rules

1. **AI Cost Circuit Breaker:**
   Every school has a monthly ceiling of 5,000,000 tokens. Upon reaching 80%, an automated warning is sent. At 100%, inference is gracefully queued or throttled unless the school upgrades their AI token pack.
2. **Storage Retention & Compression:**
   Uploaded student photos and documents are automatically compressed (WebP/PDF lossy) to keep file sizes under 250 KB each.
3. **Database Index Optimization:**
   Every multi-tenant query leverages compound indexes on `(tenant_id, ...)` to ensure memory-resident caching in PostgreSQL, preventing expensive IOPS upgrades.
4. **Cloudflare Zero-Egress Storage:**
   All document and asset downloads are served directly via Cloudflare R2 worker proxies, eliminating egress bandwidth billing entirely.

