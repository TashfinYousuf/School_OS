# EDUCATIONOS RELEASE NOTES — STAGE 12.5
## Version `v1.12.5-commercial-public-surface`

**Release Date:** November 9, 2026  
**Release Type:** Major Public Infrastructure & Commercial Surface Release  
**Target Milestone:** Stage 12.5 (Public Website, Brand & Trust Infrastructure)  
**Status:** **STABLE & VERIFIED (RELEASE GATE: PASS)**  

---

## 1. Release Overview

EducationOS Release `v1.12.5` represents the official deployment of the platform's public commercial, marketing, and institutional trust infrastructure. 

Prior to this release, EducationOS existed primarily as an internal enterprise application for authenticated administrators, teachers, and guardians. With `v1.12.5`, institutional decision-makers—including K-12 school principals, college rectors, coaching academy founders, and Madrasah administrators—can explore platform capabilities, review verified regulatory compliance (NCTB / IPEMIS / BANBEIS), calculate institutional ROI, examine deterministic pricing, and interact with a sandboxed documentation AI assistant.

This release has been engineered in strict compliance with the **Master Commercial Productization Directive**, ensuring zero data leakage of multi-tenant academic or financial records while delivering a high-performance, accessible, bilingual web experience.

---

## 2. Key New Features & Capabilities

### 2.1 Public Commercial Marketing Routes (21 Routes)
Deployed 21 new public routes with dedicated information architecture:
- **Homepage (`/`):** High-converting commercial landing page featuring hero value proposition, institutional persona selector, feature bento grid, pricing snapshot, ROI calculator preview, FAQ accordion, and dual CTAs.
- **Institutional Solutions (`/solutions/*`):** Tailored workflow deep-dives:
  - `/solutions/schools` (and `/solutions/school`): K-12 formal school operations, continuous assessment, NCTB 2026 GPA-5 grading, IPEMIS roster sync.
  - `/solutions/colleges`: Higher Secondary colleges, Morning/Day shift management, Science/Arts/Commerce stream routing, practical lab scheduling.
  - `/solutions/academies` (and `/solutions/academy`): Coaching and test-prep academies, live MCQ tests, -0.25 negative marking, OMR optical evaluation, and instant parent SMS.
- **Categorized Feature Catalog (`/features`):** Interactive module explorer with live search, categorization (Academic, Exam, Finance, AI, Portals), and subscription tier badges.
- **Brand & Engineering Trust (`/about`, `/mission`, `/security`, `/technology`):** Detailed narratives on founding principles, 2030 digital twin campus vision, AEGIS-X Sentinel security, and fast-path offline architecture.
- **Knowledge Base & Help Desk (`/docs`, `/help`, `/support`):** Comprehensive user guides for CSV roster imports, gradebook configuration, priority SLA matrices, and live operational status (99.98% uptime).
- **Institutional Inquiries (`/contact`):** Enterprise consultation scheduling, campus demo booking, and multi-campus partnership intake.
- **Legal & Compliance Infrastructure (`/legal/*`):** Transparent drafts covering Privacy (`/legal/privacy`), Terms (`/legal/terms`), Refund Policy (`/legal/refund`), and Cancellation (`/legal/cancellation`).
- **Pre-Stage 12.6 Onboarding Teaser (`/onboard`):** Pre-registration intake preview without premature billing or database provisioning.

---

### 2.2 Bilingual Localization Engine (`frontend/lib/i18n.ts`)
- Introduced a lightweight, zero-dependency localization engine supporting English (`EN`) and Bengali (`BN`).
- Synchronized translation dictionaries covering all navigation menus, hero titles, value propositions, persona descriptions, pricing intervals, and footer notices.
- Integrated into `frontend/components/providers.tsx` via `LanguageProvider`, ensuring full backward compatibility with internal dashboard pages.

---

### 2.3 Single-Source Pricing & Annual Formula (`frontend/lib/plans.ts`)
- Authoritative pricing table matching backend models in `backend/app/api/endpoints/billing.py`:
  - **Starter:** BDT 1,500/month (BDT 15,000/year) — Up to 250 students, single campus.
  - **Standard:** BDT 3,500/month (BDT 35,000/year) — Up to 750 students, 2 branches.
  - **Pro:** BDT 6,000/month (BDT 60,000/year) — Up to 2,000 students, 5 branches, AI Tutor.
  - **Enterprise:** BDT 12,000/month (BDT 120,000/year) — Unlimited students, unlimited branches, custom SLA.
- Enforces the verified **10-months-for-12-months** annual subscription discount formula across all tiers.
- Interactive category filtering (All, Schools, Colleges, Academies) and billing cycle toggle.

---

### 2.4 Interactive ROI Estimator (`RoiCalculator.tsx`)
- Dynamic calculator for institutional administrators to project concrete financial and operational savings.
- Real-time parameter recalculation:
  - Enrollment range: 50 to 5,000 students.
  - Faculty administrative hours saved (18 hrs/teacher/month benchmark).
  - Uncollected fee dues recovered (+15% timely collection benchmark).
  - Paper and stationery savings (BDT 35/student/term benchmark).
- Prominent legal disclaimer rejecting guaranteed outcomes and emphasizing standard adoption variances.

---

### 2.5 Sandboxed Public Support AI Assistant (`PublicSupportAssistant.tsx`)
- High-speed, client-side conversational assistant answering questions exclusively from indexed platform documentation.
- **Multi-layer prompt injection defense:** Intercepts and rejects SQL statements (`SELECT`, `DROP`, `INSERT`), system prompt inquiries, password requests, and student PII queries.
- Zero connection to private backend databases or API tokens.
- Explicit deferral of support ticket creation, informing users that ticketing functionality is reserved for the authenticated dashboard (scheduled for Stage 12.8).

---

### 2.6 SEO & Discoverability Infrastructure
- **Metadata Factory (`frontend/lib/seo.ts`):** Canonical URL generator with OpenGraph cards, Twitter cards, and Schema.org `SoftwareApplication` JSON-LD structured data.
- **Crawler Directives (`frontend/app/robots.ts`):** Static robots configuration explicitly disallowing indexing of private administrative paths (`/dashboard/`, `/dashboard/*`, `/api/`, `/api/*`).
- **Sitemap (`frontend/app/sitemap.ts`):** Static sitemap indexing all 21 public marketing and legal routes.

---

## 3. Security, Boundaries & Architectural Integrity

1. **Isolation from Internal Dashboards:**
   - Public pages are cleanly separated from authenticated internal layouts (`frontend/app/dashboard/layout.tsx`).
   - Visiting public marketing pages requires zero authentication tokens and does not leak or alter stored session credentials.
2. **Third-Party Linkage & Disclaimers:**
   - All outbound government reference links (`moedu.gov.bd`, `nctb.gov.bd`, `banbeis.gov.bd`, `ipemis.dpe.gov.bd`) declare `rel="noopener noreferrer"`.
   - Comprehensive footer disclaimers confirm EducationOS is an independent software platform not affiliated with or endorsed by any government entity.
3. **Database Schema Continuity:**
   - Zero database migrations were required for Stage 12.5.
   - Alembic head remains locked at `c4d5e6f7a8b9 (head)`.
4. **Stage 12.6 Handoff Discipline:**
   - Live payment gateway processing (bKash/Nagad/SSLCommerz) and automatic tenant database provisioning remain completely dormant until Stage 12.6 is formally authorized.

---

## 4. Verification & Quality Assurance Summary

All tests executed successfully in the staging and build environments:

```
Automated Test Verification Matrix
──────────────────────────────────────────────────────────────────────────
Backend Stage 01–12 Pytest Suite:           114/114 Passed (100%)
Frontend Automated Test Suite:               62/62 Passed (100%)
  - Stage 07 Academic Operations:            10 Passed
  - Stage 11 Offline Sync & Storage:          9 Passed
  - Stage 11 PWA Installability & Manifest:   9 Passed
  - Stage 12.5 Public Website & Brand IA:    34 Passed
──────────────────────────────────────────────────────────────────────────
Total Passing Automated Tests:              176/176 Passed (100% Green)
TypeScript Static Analysis (tsc --noEmit):   0 Errors
Next.js Production Build (next build):       47/47 Routes Statically Prerendered
```

---

## 5. What's Next in the Commercial Roadmap

Stage 12.5 establishes the public storefront. The subsequent productization stages will build directly upon this foundation:

- **Stage 12.6 (Next):** Self-Serve Onboarding, Automated Tenant Provisioning, Module Marketplace, and Live Payment Gateway Checkout.
- **Stage 12.7:** School-in-a-Box Operational Experience, Academic Setup Wizard, Bulk Import Verification, and Role-Based Dashboards.
- **Stage 12.8:** Commercial SLA Enforcement, Help Desk & Ticketing Infrastructure, In-App Customer Support, and Multi-Tenant Auditing.
- **Stage 13–14:** Production Hardening, Multi-Tenant Database RLS Verification on Native PostgreSQL, and Final Enterprise Release.

---

*Stage 12.5 implementation is complete and sealed. Execution has halted to await explicit user authorization before initiating Stage 12.6.*

