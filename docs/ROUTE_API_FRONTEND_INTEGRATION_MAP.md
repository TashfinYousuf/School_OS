# EDUCATIONOS — ROUTE, API & FRONTEND INTEGRATION MAP

**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/ROUTE_API_FRONTEND_INTEGRATION_MAP.md`  
**Version:** 2.0 (Kids Shine Pilot Baseline)  
**Status:** **ACTIVE / VERIFIED**  
**Last Updated:** November 9, 2026  

---

## 1. Information Architecture & Layout Shell Boundaries

EducationOS enforces a strict architectural boundary between two distinct application shells:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PUBLIC WEBSITE SHELL                            │
│  Layout: Root layout with <PublicNavbar /> and <PublicFooter />        │
│  State: Completely unauthenticated, no token required, SSR/Static       │
│  Routes: /, /solutions/*, /features, /pricing, /about, /docs, /legal/* │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Login / Onboard Link
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AUTHENTICATED APPLICATION SHELL                      │
│  Layout: Dashboard layout with Sidebar, Topbar, WorkspaceSwitcher     │
│  State: JWT Access Token, Tenant Context, RBAC RoleGuard               │
│  Routes: /dashboard/* (/students, /attendance, /finance, /exams, etc.) │
└────────────────────────────────────────────────────────────────────────┘
```

> [!IMPORTANT]
> `/pricing` is strictly a member of the **Public Website Shell**. It must never be rendered inside the authenticated dashboard layout or sidebar. Any historical `/dashboard/pricing` route must be redirected or transformed into an administrative "License Info" view.

---

## 2. Public Website Route Integration Map

All public routes are statically prerendered or client-hydrated without requiring database tokens or authenticated tenant headers:

| Route Path | Frontend Component | Backend API Dependency | Auth / Scope | Purpose & Behavior |
|:---|:---|:---|:---:|:---|
| `/` | `frontend/app/page.tsx` | None (Static) | None / Public | Commercial Homepage: Hero, Persona Switcher, Feature Bento, ROI Preview, FAQ |
| `/about` | `frontend/app/about/page.tsx` | None (Static) | None / Public | Institutional story, zero-ads pledge, engineering principles |
| `/mission` | `frontend/app/mission/page.tsx` | None (Static) | None / Public | Mission & Vision 2030 (The Digital Twin Campus) |
| `/solutions` | `frontend/app/solutions/page.tsx` | None (Static) | None / Public | Tailored institutional solutions overview |
| `/solutions/schools` | `frontend/app/solutions/schools/page.tsx` | None (Static) | None / Public | K-12 Formal School operations, NCTB 2026 grading, IPEMIS integration |
| `/solutions/colleges` | `frontend/app/solutions/colleges/page.tsx` | None (Static) | None / Public | Higher Secondary Colleges, shift scheduling, science/commerce streams |
| `/solutions/academies` | `frontend/app/solutions/academies/page.tsx` | None (Static) | None / Public | Coaching and test-prep academies, -0.25 negative marking, OMR scanner |
| `/features` | `frontend/app/features/page.tsx` | None (Static) | None / Public | Categorized module catalog, live search, tier badges |
| `/pricing` | `frontend/app/pricing/page.tsx` | `GET /api/v1/billing/plans` (Optional) | None / Public | **Standalone Public Pricing**: Plan comparison, add-ons, ROI calculator |
| `/security` | `frontend/app/security/page.tsx` | None (Static) | None / Public | AEGIS-X Sentinel, PostgreSQL RLS, vulnerability disclosure policy |
| `/technology` | `frontend/app/technology/page.tsx` | None (Static) | None / Public | Offline PWA architecture, fast-path sync, AI gateway infrastructure |
| `/docs` | `frontend/app/docs/page.tsx` | None (Static) | None / Public | Knowledge base, getting started, roster CSV import instructions |
| `/help` | `frontend/app/help/page.tsx` | None (Static) | None / Public | Searchable FAQs, system operational status (99.98% uptime) |
| `/contact` | `frontend/app/contact/page.tsx` | Lead capture (Client state) | None / Public | Institutional demo booking and consultation inquiry form |
| `/support` | `frontend/app/support/page.tsx` | None (Static) | None / Public | Support triage guide, priority SLA matrices, contact channels |
| `/legal/privacy` | `frontend/app/legal/privacy/page.tsx` | None (Static) | None / Public | Data sovereignty, zero-monetization policy (Draft for Review) |
| `/legal/terms` | `frontend/app/legal/terms/page.tsx` | None (Static) | None / Public | Terms of service, 99.9% uptime SLA, 90-day retention (Draft for Review) |
| `/legal/refund` | `frontend/app/legal/refund/page.tsx` | None (Static) | None / Public | 14-day refund window, annual plan proration terms (Draft for Review) |
| `/legal/cancellation` | `frontend/app/legal/cancellation/page.tsx` | None (Static) | None / Public | Self-serve cancellation, data export terms (Draft for Review) |
| `/onboard` | `frontend/app/onboard/page.tsx` | Pre-registration (Client state) | None / Public | Pre-Stage 12.6 conversion intake preview (Zero early billing) |
| `/login` | `frontend/app/login/page.tsx` | `POST /api/v1/auth/login` | None / Public | Institution login portal for Admin, Teacher, Student, Guardian |

---

## 3. Authenticated Dashboard Route Integration Map

All dashboard routes run inside `frontend/app/dashboard/layout.tsx`. Every API request must pass:
1. `Authorization: Bearer <jwt_access_token>`
2. `X-Tenant-ID: <current_tenant_id>`
3. RBAC role verification via `RoleRouteGuard.tsx`

| Dashboard Route | Frontend Page File | Backend Endpoint(s) | HTTP Method | Permitted Roles | Failure / Fallback Behavior |
|:---|:---|:---|:---:|:---|:---|
| `/dashboard` | `app/dashboard/page.tsx` | `/api/v1/dashboard/metrics`<br>`/api/v1/dashboard/operational-kpi` | `GET` | Admin, Teacher, Student, Guardian | Displays partial metric skeleton if KPI fails; logs degraded status. |
| `/dashboard/students` | `app/dashboard/students/page.tsx` | `/api/v1/students`<br>`/api/v1/students/{id}` | `GET`<br>`POST`<br>`PUT` | Admin | Inline table error message; retains cached offline list if offline. |
| `/dashboard/teachers` | `app/dashboard/teachers/page.tsx` | `/api/v1/teachers`<br>`/api/v1/teachers/{id}` | `GET`<br>`POST`<br>`PUT` | Admin | Table banner error; prevents submission if required fields missing. |
| `/dashboard/attendance` | `app/dashboard/attendance/page.tsx` | `/api/v1/attendance/events`<br>`/api/v1/attendance/stats` | `GET`<br>`POST` | Admin, Teacher | Offline mutation queue (IndexedDB); syncs on reconnect with retry limit. |
| `/dashboard/exams` | `app/dashboard/exams/page.tsx` | `/api/v1/exams`<br>`/api/v1/question-papers` | `GET`<br>`POST` | Admin, Teacher | Shows error toast on failed paper creation. |
| `/dashboard/results` | `app/dashboard/results/page.tsx` | `/api/v1/results`<br>`/api/v1/results/publish` | `GET`<br>`POST` | Admin, Teacher, Student, Guardian | Read-only view for Student/Guardian (filtered to own records). |
| `/dashboard/notices` | `app/dashboard/notices/page.tsx` | `/api/v1/notices`<br>`/api/v1/notices/{id}/ack` | `GET`<br>`POST` | Admin, Teacher, Student, Guardian | Read-only broadcast for Students/Guardians; Admin compose tool. |
| `/dashboard/finance` | `app/dashboard/finance/page.tsx` | `/api/v1/finance/invoices`<br>`/api/v1/finance/payments` | `GET`<br>`POST` | Admin, Finance Officer, Accountant | **Academic Fees Only**: Ledger table, cash receipt generation. |
| `/dashboard/academic` | `app/dashboard/academic/page.tsx` | `/api/v1/academic/classes`<br>`/api/v1/academic/routines` | `GET`<br>`POST` | Admin, Teacher, Student | Class schedule matrix; read-only routine for students. |
| `/dashboard/guardians` | `app/dashboard/guardians/page.tsx` | `/api/v1/guardians`<br>`/api/v1/guardians/link` | `GET`<br>`POST` | Admin, Teacher | Directory with student linking cards. BOLA enforced on backend. |
| `/dashboard/ipemis` | `app/dashboard/ipemis/page.tsx` | `/api/v1/government/ipemis/export` | `GET` | Admin | Exports NCTB/BANBEIS compliant roster CSV. |
| `/dashboard/approvals` | `app/dashboard/approvals/page.tsx` | `/api/v1/approvals`<br>`/api/v1/approvals/{id}/action` | `GET`<br>`POST` | Admin | Action Center for result publication & fee adjustments. |
| `/dashboard/communication` | `app/dashboard/communication/page.tsx` | `/api/v1/communication/messages` | `GET`<br>`POST` | Admin, Teacher, Guardian | Two-way parent-teacher messaging. |
| `/dashboard/settings` | `app/dashboard/settings/page.tsx` | `/api/v1/institution/profile` | `GET`<br>`PATCH` | Admin | School profile, academic year, contact info, dark mode. |
| `/dashboard/batches` | `app/dashboard/batches/page.tsx` | `/api/v1/academy/batches` | `GET`<br>`POST` | Admin, Teacher | Academy/Coaching batch scheduler. |
| `/dashboard/live-exams` | `app/dashboard/live-exams/page.tsx` | `/api/v1/live-exams` | `GET`<br>`POST` | Admin, Teacher, Student | Real-time MCQ examination with negative marking. |
| `/dashboard/doubt-solver` | `app/dashboard/doubt-solver/page.tsx` | `/api/v1/ai/doubt-solver` | `POST` | Teacher, Student | AI tutor query (Rate-limited, quota-checked). |
| `/dashboard/pricing` | `app/dashboard/pricing/page.tsx` | `/api/v1/billing/status`<br>`/api/v1/billing/checkout` | `GET`<br>`POST` | Admin | **DEFECT AREA**: Being restructured into a read-only License Status card; public pricing moved to `/pricing`. |

---

## 4. Backend Router & Endpoint Inventory

The backend exposes 28 routers mounted under `/api/v1/` in `backend/app/main.py`:

```
Router Prefix                   Router Module                        Primary Domain / Function
───────────────────────────────────────────────────────────────────────────────────────────────────
/api/v1/auth                    app.api.endpoints.auth               JWT login, refresh, logout, token revocation
/api/v1/users                   app.api.endpoints.users              User accounts, password resets, role assignment
/api/v1/institution             app.api.endpoints.institution        School profile, EIIN, contact details
/api/v1/campus                  app.api.endpoints.campus             Multi-campus branches & physical venues
/api/v1/workspaces              app.api.endpoints.workspaces         Unified workspace context (School / Academy)
/api/v1/students                app.api.endpoints.students           Student roster, enrollment, guardian links
/api/v1/admissions              app.api.endpoints.admissions         Applicant intake, enrollment wizard, CSV import
/api/v1/teachers                app.api.endpoints.teachers           Faculty directory, subject allocations
/api/v1/attendance              app.api.endpoints.attendance         Daily attendance events, stats, offline sync
/api/v1/academic                app.api.endpoints.academic           Classes, sections, routines, subject syllabus
/api/v1/exams                   app.api.endpoints.exams              Exam scheduling, grading terms, question papers
/api/v1/results                 app.api.endpoints.results            Marks entry, GPA-5 calculation, publication
/api/v1/notices                 app.api.endpoints.notices            Broadcast bulletins, receipts, acknowledgements
/api/v1/finance                 app.api.endpoints.finance            Academic fees, student invoices, receipts
/api/v1/billing                 app.api.endpoints.billing            SaaS Subscription, plans, invoices, quotas
/api/v1/approvals               app.api.endpoints.approvals          Admin action center, publication review
/api/v1/guardians               app.api.endpoints.guardians          Parent portal, child linking, emergency contacts
/api/v1/communication           app.api.endpoints.communication      SMS dispatch, parent messaging, bulletins
/api/v1/dashboard               app.api.endpoints.dashboard          Overview counters & operational KPI benchmarks
/api/v1/ai                      app.api.endpoints.ai                 Question generator, NCTB curriculum assistant
/api/v1/ai_tutor                app.api.endpoints.ai_tutor           Socratic doubt solver, student tutoring
/api/v1/academy                 app.api.endpoints.academy            Batches, course fees, model tests
/api/v1/government              app.api.endpoints.government         IPEMIS & BANBEIS data compliance exports
/api/v1/audit                   app.api.endpoints.audit              Append-only audit log inspection
/api/v1/tenants                 app.api.endpoints.tenants            Tenant provisioning (Superadmin only)
```

---

## 5. Security & Isolation Validation on Endpoint Invocations

1. **Authentication Token Extraction:** Every protected endpoint invokes `get_current_user` in `backend/app/api/deps.py`, which validates:
   - JWT signature against `settings.SECRET_KEY`.
   - Token expiration (`exp`).
   - Token revocation status against `revoked_token_records` table (persisting across restarts).
2. **Tenant ID Injection:**
   - Multi-tenant endpoints extract `tenant_id` from the authenticated user claims or `X-Tenant-ID` header.
   - If the user is not superadmin, the user's assigned `tenant_id` **overrides any client-provided value**, completely preventing Broken Object Level Authorization (BOLA/IDOR).
3. **Database RLS Context:**
   - On native PostgreSQL, every request executes:
     ```sql
     SET LOCAL app.current_tenant_id = '<validated_tenant_id>';
     ```
   - Restrictive RLS policies guarantee zero cross-tenant query leakage at the database engine level.

