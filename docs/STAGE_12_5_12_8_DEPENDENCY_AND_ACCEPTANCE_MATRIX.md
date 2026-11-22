# EducationOS — Productization Dependency, Status & Acceptance Matrix (Stages 12.5 – 12.8)

**Document Version:** 1.0.0-PROD  
**Author:** Principal Product Architect & Release Manager  
**Target Milestone:** Stages 12.5, 12.6, 12.7, 12.8  
**Execution Mode:** Gated Architectural Specification (Awaiting Executive Authorization)

---

## 1. Executive Summary

This matrix establishes the authoritative dependency tree, current implementation state, security risks, migration impacts, test strategies, and formal acceptance criteria across the four productization stages:
- **Stage 12.5:** Brand, Public Website & Trust Architecture
- **Stage 12.6:** Self-Service Onboarding, Module Marketplace & Commerce Engine
- **Stage 12.7:** Performance Optimization & Modern User Experience
- **Stage 12.8:** Product Operations, Support Ticketing & Global Expansion Readiness

---

## 2. Granular Capability Status Matrix

| ID | Stage | Feature / Capability | Classification | Current State in Repository | Proposed Architecture & Target State | Security & Architectural Risks |
|:---:|:---:|---|:---:|---|---|---|
| **CAP-01** | 12.5 | Public Commercial Homepage | **Partial** | Minimal 1-page marketing overview in `frontend/app/page.tsx` ("Vision 2030"). | Full commercial homepage with interactive personas, solutions showcase, ROI calculator, and trust signals. | Unverified external assets; asset injection vulnerabilities. |
| **CAP-02** | 12.5 | Solutions Sub-Pages (School, Academy, Unified) | **Missing** | None. Routes `/solutions/*` do not exist. | Dedicated deep-dive routes detailing curriculum, exam styles, and dual-mode campus operations. | Information leakage of unreleased features. |
| **CAP-03** | 12.5 | Public Pricing & Calculator | **Partial** | In-dashboard admin pricing page exists (`dashboard/pricing/page.tsx`). Public `/pricing` missing. | Public pricing calculator with currency toggle (BDT/USD) and student-tier slider driven by backend quote API. | Client-side tampering of calculated quotes. |
| **CAP-04** | 12.5 | Security Hub & Compliance Specs | **Missing** | Security features exist in backend (RLS, RBAC), but public `/security` page is missing. | Public Security Hub showcasing AEGIS-X Sentinel, PostgreSQL RLS, data locality, and audit logging. | Misleading compliance claims without independent certification. |
| **CAP-05** | 12.5 | Comprehensive Legal Suite | **Missing** | None. No privacy policy, terms of service, or user agreements exist in `/app`. | Complete legal suite (`/legal/privacy`, `/legal/terms`, `/legal/cookies`, `/legal/refund`). | Regulatory non-compliance with Bangladesh ICT Act or GDPR. |
| **CAP-06** | 12.5 | Public Support AI Assistant | **Missing** | Socratic tutor exists in dashboard (`doubt-solver`). Public assistant is missing. | Sandboxed public floating AI assistant (`POST /api/v1/support/chat`) with strict read-only knowledge base and ticket creation tool. | Prompt injection, unauthorized data probing, resource exhaustion via spam. |
| **CAP-07** | 12.5 | Verified Institutional Trust Footer | **Missing** | Only minimal CTA button on homepage. No structured footer. | Official trust footer linking verified Bangladesh regulatory bodies (NCTB, BANBEIS, IPEMIS) and contact channels. | Endorsement misrepresentation. Must only link official portals. |
| **CAP-08** | 12.6 | 7-Step Institutional Onboarding | **Missing** | Single-form tab on login page (`/api/v1/auth/register-school`) creates basic unprovisioned tenant. | Dedicated `/onboard` wizard: Institution Info ➔ Workspace Setup ➔ Modules ➔ Quotas ➔ Quote ➔ Checkout ➔ Provisioning. | Incomplete transaction state; orphaned tenants on abort. |
| **CAP-09** | 12.6 | Dynamic Authoritative Quote Engine | **Missing** | Server computes checkout in `/api/v1/billing/checkout` for fixed plans only. | Backend endpoint `POST /api/v1/billing/quote` calculating dynamic quotes with add-ons and annual discounts. | Decimal precision rounding bugs; currency conversion drift. |
| **CAP-10** | 12.6 | Custom Module Request Workflow | **Missing** | None. | "Request Bespoke Module" workflow generating pending approval task without auto-activation. | Privilege escalation; unapproved code execution. |
| **CAP-11** | 12.6 | bKash & SSLCOMMERZ Payment Rails | **Partial** | Webhook callback verification and checkout intent generation implemented in Stage 12. | Live gateway adapter classes, session redirects, and daily automated settlement reconciliation. | Webhook replay attacks, fraudulent payment confirmations. |
| **CAP-12** | 12.6 | Atomic Multi-Entity Provisioning | **Partial** | Stage 01/02 scripts exist; onboarding registration is not yet unified into single atomic transaction. | Atomic transaction provisioning `Tenant`, `Organization`, `Workspace`, `User`, `InstitutionSubscription`, `TenantEntitlement`. | Database deadlock or partial commits during high concurrency. |
| **CAP-13** | 12.7 | Dashboard Query Aggregation | **Missing** | Dashboard executes 5–7 sequential individual `count()` queries in `backend/app/api/endpoints/dashboard.py`. | Single-pass SQL aggregation query with conditional filtering (`COUNT(*) FILTER (...)`). | Query timeouts under massive multi-tenant database load. |
| **CAP-14** | 12.7 | Composite Database Indexes | **Partial** | Basic single-column indexes exist from Alembic migrations. | Add composite indexes: `(tenant_id, date, status)`, `(tenant_id, status, class_name)`. | Increased write latency on high-frequency tables. |
| **CAP-15** | 12.7 | Persisted AI Chat History | **Missing** | Socratic tutor and Teacher diary hold conversation in volatile component `useState`. | `AIChatThread` and `AIChatMessage` models with cursor pagination and full-text search. | Cross-tenant thread leakage; memory exhaustion on large history. |
| **CAP-16** | 12.7 | IndexedDB Client Reference Caching | **Partial** | `safeFetch` uses synchronous `localStorage`. IndexedDB exists for offline mutations (Stage 11). | Upgrade `safeFetch` to use async `IndexedDB` reference store with TTL, tags, and tenant isolation. | Cache staleness; serving invalid permissions from client cache. |
| **CAP-17** | 12.7 | Modern Personal & Role Settings | **Missing** | `SettingsModal` and `settings/page.tsx` duplicate institutional profile. No user settings. | Multi-tab settings suite (`/dashboard/settings/*`): User Profile, Security/2FA, Role Preferences. | Unauthorized password resets; insecure session revocation. |
| **CAP-18** | 12.8 | Support Ticketing & Escalation | **Missing** | None. | `SupportTicket` and `SupportTicketMessage` domain models with SLA tracking and human escalation. | PII leakage in ticket text; unauthorized access to foreign tickets. |
| **CAP-19** | 12.8 | Searchable Help Center & Guides | **Missing** | None. | Markdown-driven, searchable knowledge base localized in English and Bengali. | Broken documentation links; out-of-date guide instructions. |
| **CAP-20** | 12.8 | Privacy-Preserving Telemetry | **Missing** | Dummy endpoint `/api/v1/analytics/overview` returns hardcoded numbers. | Privacy-conscious event telemetry scrubber tracking conversion and feature adoption. | Accidental tracking of student/guardian PII. |
| **CAP-21** | 12.8 | Subscription Dunning Automation | **Partial** | State machine transitions implemented in `EntitlementService` (Stage 12). No automated cron worker. | Scheduled worker running dunning checks, issuing grace period alerts and suspension notices. | Inadvertent premature suspension of paying customers. |
| **CAP-22** | 12.8 | Developer API & Outbound Webhooks | **Missing** | None. | `ApiKey` hashed authentication and outbound institutional webhooks (`attendance.marked`, etc.). | API key leaks; SSRF vulnerabilities in customer webhook URLs. |

---

## 3. Inter-Stage Dependency Tree

```
Stage 12.5 (Brand & Trust)
   │
   ├── CAP-01, 02, 04, 05 (Public Web & Legal)
   ├── CAP-03 (Public Pricing) ──► Requires CAP-09 (Quote API from 12.6)
   └── CAP-06 (Public Support AI) ──► Standalone, zero tenant DB dependency
         │
         ▼
Stage 12.6 (Onboarding & Commerce)
   │
   ├── CAP-09 (Authoritative Quote Engine)
   ├── CAP-08 (7-Step Onboarding UI) ──► Depends on CAP-09 & CAP-01 Design System
   ├── CAP-10 (Custom Module Requests) ──► Depends on CAP-08
   ├── CAP-11 (Payment Rails Integration) ──► Reuses Stage 12 Models
   └── CAP-12 (Atomic Provisioning) ──► Extends Stages 01, 02, 12 Models
         │
         ▼
Stage 12.7 (Performance & Modern UX)
   │
   ├── CAP-13, 14 (DB Aggregations & Indexes) ──► Optimizes Core APIs
   ├── CAP-15 (Persisted AI Chat History) ──► Depends on Stage 10 AI Gateway
   ├── CAP-16 (Async IndexedDB Caching) ──► Extends Stage 11 Offline DB
   └── CAP-17 (Role-Specific Settings) ──► Extends Stage 05 RBAC
         │
         ▼
Stage 12.8 (Product Operations & Expansion)
   │
   ├── CAP-18 (Ticketing Engine) ──► Extends CAP-06 (Support AI Escalations)
   ├── CAP-19 (Searchable Help Center) ──► Extends CAP-05 Documentation
   ├── CAP-20 (Product Telemetry) ──► Telemetry hooks on CAP-08 Onboarding
   ├── CAP-21 (Dunning Automation) ──► Extends Stage 12 Entitlement Engine
   └── CAP-22 (Developer API & Outbound Webhooks) ──► Final enterprise expansion
```

---

## 4. Database Migration & Schema Plan

To execute Stages 12.5–12.8, the following Alembic forward migrations will be introduced sequentially without disturbing active migrations:

### Migration Plan
1. **Migration 1 (`c4d5e6f7a8b9_stage12_6_onboarding_quotes.py`):**
   - Tables: `module_catalog`, `custom_module_requests`.
   - Modifies: `organizations` (adds `billing_quote_id`, `onboarding_status`).
2. **Migration 2 (`c5d6e7f8a9b0_stage12_7_persisted_chat_history.py`):**
   - Tables: `ai_chat_threads`, `ai_chat_messages`.
   - Indexes: `ix_ai_chat_threads_lookup` on `(tenant_id, user_id, updated_at DESC)`, `ix_ai_chat_messages_thread` on `(thread_id, created_at ASC)`.
   - Composite performance indexes: `ix_attendance_tenant_date_status` on `attendance_events`.
   - Row Level Security (RLS) policies on `ai_chat_threads` and `ai_chat_messages`.
3. **Migration 3 (`c6d7e8f9a0b1_stage12_8_product_operations.py`):**
   - Tables: `support_tickets`, `support_ticket_messages`, `telemetry_events`, `api_keys`, `outbound_webhook_endpoints`.
   - Row Level Security (RLS) policies on tenant-scoped operations tables.

---

## 5. Comprehensive Quality & Acceptance Gates

### Stage 12.5 Acceptance Gate: Brand, Public Website & Trust
- [ ] Public landing page Core Web Vitals: LCP $\le 1.8\text{ s}$, CLS $\le 0.05$, FID/INP $\le 100\text{ ms}$.
- [ ] 100% WCAG 2.1 AA keyboard accessibility and color contrast compliance.
- [ ] Zero unhandled routes in `/solutions/*`, `/pricing`, `/security`, `/legal/*`.
- [ ] Public AI Assistant verified: Fails closed on prompt injection; zero access to tenant database; support ticket generation succeeds.
- [ ] Verified trust footer links strictly to authorized official government portals.
- [ ] Automated frontend test coverage: Minimum 10 dedicated Stage 12.5 component tests passing.

### Stage 12.6 Acceptance Gate: Onboarding, Marketplace & Checkout
- [ ] 7-step onboarding wizard completes end-to-end for School, Academy, and Unified workspaces.
- [ ] Pricing calculations match server-side quote to 2 decimal places in BDT.
- [ ] 14-day free trial provisions strictly free-tier entitlements.
- [ ] Paid entitlements require cryptographic webhook execution; zero bypass via client redirects.
- [ ] Webhook replay protection verified: Duplicate gateway callbacks return `ALREADY_PROCESSED` without double activation.
- [ ] Automated test coverage: Minimum 10 dedicated backend onboarding & quote tests passing.

### Stage 12.7 Acceptance Gate: Performance & Modern UX
- [ ] Dashboard query count reduced from 5–7 queries to $\le 2$ queries per view.
- [ ] Dashboard API p95 response time $\le 200\text{ ms}$ under 50 concurrent requests.
- [ ] AI conversation threads persist across page reload and user session restarts.
- [ ] Cursor-based pagination returns 20 messages in $\le 50\text{ ms}$.
- [ ] SafeFetch client caching migrated to async IndexedDB with automatic logout purge.
- [ ] Institutional and personal user profile settings decoupled; zero code duplication between modal and page.
- [ ] Automated test coverage: Minimum 10 dedicated Stage 12.7 backend & frontend tests passing.

### Stage 12.8 Acceptance Gate: Product Operations & Expansion
- [ ] Support tickets can be submitted, categorized, assigned, and resolved with full audit history.
- [ ] Telemetry events logged without student, guardian, or teacher PII.
- [ ] Dunning engine executes daily: Successfully transitions overdue subscriptions through 7-day grace period to suspended status.
- [ ] Non-destructive suspension verified: Core institutional data remains read-only; zero data deletion.
- [ ] Multi-timezone support verified with `Asia/Dhaka` default.
- [ ] Automated test coverage: Minimum 10 dedicated Stage 12.8 backend tests passing.

---

## 6. Rollback & Fault-Recovery Specifications

1. **Alembic Down-Revisions:** Each newly introduced migration file (`c4d5...`, `c5d6...`, `c6d7...`) contains a tested `downgrade()` function that cleanly drops newly added tables, constraints, and RLS policies in reverse dependency order without dropping baseline Stage 01–12 tables.
2. **Feature-Flag Decoupling:** All newly introduced public routes, onboarding steps, and AI chat endpoints will be feature-flagged behind application settings (`ENABLE_PUBLIC_COMMERCIAL_SITE`, `ENABLE_SELF_SERVE_ONBOARDING`, `ENABLE_PERSISTENT_AI_CHAT`). If an issue is detected in production, setting the flag to `false` restores the verified Stage 11/12 baseline immediately without requiring a full code rollback.
3. **Database Snapshot Protocol:** Before applying each stage's database migration, a complete point-in-time PostgreSQL snapshot will be recorded.
