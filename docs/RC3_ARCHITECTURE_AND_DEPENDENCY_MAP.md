# RC3 Architecture and Dependency Map

**Generated:** Phase 0 Baseline  
**Canonical Backend Entry:** `backend/app/main.py`  
**Canonical Frontend Entry:** `frontend/app/` (Next.js App Router)

---

## 1. Backend Mounted Router & Service Architecture (`backend/app/main.py`)

### Mounted API Surface (`/api/v1/*`)
- **Identity & Tenancy:**
  - `auth.py` (`/api/v1/auth/*`): staff/student/guardian login, account activation, tenant registration, refresh, logout, profile. Depends on `identity_service.py`, `security.py`, `RevokedTokenRecord`, `User`, `Student`, `Guardian`, `Tenant`.
  - `users.py` (`/api/v1/users/*`): role catalog, staff creation, role updates, `/me`.
  - `institution.py` (`/api/v1/institution/*`): profile GET/PATCH, `/import-students-csv`. Depends on `app/services/institution.py`.
- **Academic & Student/Guardian Domain:**
  - `students.py` (`/api/v1/students/*`): CRUD, admit, bulk import, `/me/dashboard`, `/360`, student detail. Uses `GuardianStudentLink` (`student_guardians`) and legacy `guardian_students` backfill target.
  - `guardians.py` (`/api/v1/guardians/*`): guardian CRUD, link/verify requests, `/me/children`, child progress/attendance/fees.
  - `attendance.py` (`/api/v1/attendance/*`): sheet, bulk submit, sync offline, student history, absent list, export.
  - `results.py` (`/api/v1/results/*`): NCTB Decimal grading, progress card (`student` & `guardian` BOLA surface).
  - `academic.py` (`/api/v1/academic/*`): NCTB grades, class routine CRUD.
  - `academy.py` (`/api/v1/academy/*`): leaderboard, `assert_student_and_exam_scope`, offline OMR scan, result SMS dispatch.
  - `admissions.py` (`/api/v1/admissions/*`): online `/apply`, review, approve, reject, enroll.
  - `teachers.py` (`/api/v1/teachers/*`): teacher CRUD.
- **Learning Studio & AI:**
  - `learning_studio.py`: **Mounted at `/api/v1/learning-os`** (NOT `/api/v1/learning-studio`). Routes: `/socratic-solve`, `/tutor/chat`, `/study-room/session`, `/study-room/sessions`, `/flashcards/generate`, `/flashcards`, `/practice/generate-quiz`, `/practice/submit`, `/analytics`.
  - `ai.py` + `app/services/ai_gateway.py` (`GeminiProvider`, `GroqProvider`, `MultiModelAIGateway`) + `app/core/ai_client.py`.
- **Finance, Commercial Billing & Payments:**
  - `finance.py` (`/api/v1/finance/*`): fee summary, ledger/payments, `/collect`, `/webhook/{provider_name}`, invoices, receipts, reversals. Depends on `payment_providers.py`.
  - `billing.py` (`/api/v1/billing/*`): **Authoritative mounted SaaS billing router** (`/calculate-quote`, `/catalogue`, `/plans`, `/status`, `/checkout`, `/verify-payment`, `/payments/{ref}`, `/webhook/payment-callback`, `/admin/reconcile-payment`, `/entitlements`, `/invoices`, `/simulate-lifecycle`).
  - `subscriptions.py`: **UNMOUNTED stale duplicate router** containing diverging `PRICING_PLANS` — candidate for deprecation/alignment.
  - `app/services/pricing_engine.py`: Dynamic tiered pricing calculator (`IS_OWNER_APPROVED = False`, currently uses `float`).
  - `app/services/entitlement.py`: `PLAN_FEATURES`, `READ_ONLY_FALLBACK_FEATURES`, `EntitlementService`, `require_entitlement`.
  - `app/services/payment_providers.py`: `CashDeskProvider`, `BankTransferProvider`, `BKashMerchantProvider`, `NagadProvider`, `SSLCommerzProvider`, `PaymentProviderFactory`.
- **Operations & Messaging:**
  - `dashboard.py` (`/api/v1/dashboard/*`): `/metrics`, `/operational-kpi`.
  - `communication.py` (`/api/v1/communication/*`): WhatsApp webhook verify/inbound, inbox, reply.
  - `notifications.py` (`/api/v1/notifications/*`): `/subscribe`, `/dispatch-reminder`.

---

## 2. Database & Session Dependency Chain

- `backend/app/core/database.py`:
  - `after_begin` sets PostgreSQL GUC `set_config('app.current_tenant_id', ..., true)`.
  - **Dependency Defect:** Connection string uses role `postgres` (`rolbypassrls = True`), and neither `after_begin` nor `get_tenant_db()` drops privileges via `SET LOCAL ROLE authenticated`.
- Alembic Migration Chain (observed live):
  - `f6a7b8c9d0e1` -> `b2c3d4e5f6a7` -> `c3d4e5f6a7b8` (`stage12_subscription_billing`) -> `c4d5e6f7a8b9` (`fix_rls_permissive_policies`) -> `d5e6f7a8b9c0` (`student_guardian_iam_and_learning_studio`, current head).
- Relationship Tables:
  - Canonical link model: `student_guardians` (`GuardianStudentLink`).
  - Legacy table: `guardian_students` (still holds 1 orphan row `Taki Hussain -> Talha Hussain` missing from `student_guardians`).

---

## 3. Frontend Route, Auth & API Client Map (`frontend/`)

- **API Clients:** `frontend/lib/api-client.ts` (defines `clearSession`, `NEXT_PUBLIC_API_URL` handling) and `frontend/lib/apiClient.ts`.
- **RBAC & Navigation:**
  - `frontend/lib/permissions.ts`
  - `frontend/components/RoleRouteGuard.tsx` (controls route access; currently missing `/dashboard/learning`, `/dashboard/attendance`, `/dashboard/profile` for student/guardian).
  - `frontend/app/dashboard/layout.tsx` (sidebar navigation per role).
  - `frontend/lib/institution.tsx` (`useInstitution()` context for dynamic tenant branding).
- **Key Routes Inspected:**
  - Public & Onboarding: `/login` (`app/login/page.tsx`), `/activate` (`app/activate/page.tsx`), `/pricing` (`app/pricing/page.tsx`), `/onboard` (`app/onboard/page.tsx`), `DynamicPricingCalculator.tsx`, `lib/plans.ts`.
  - Authenticated Dashboard: `/dashboard` (`dashboard/page.tsx`), `/dashboard/learning` (`dashboard/learning/page.tsx`), `/dashboard/results` (`dashboard/results/page.tsx`), `/dashboard/attendance` (`dashboard/attendance/page.tsx`), `/dashboard/guardians` (`dashboard/guardians/page.tsx`), `/dashboard/finance` (`dashboard/finance/page.tsx`), `/dashboard/profile` (`dashboard/profile/page.tsx`), `/dashboard/pricing` (`dashboard/pricing/page.tsx`), `/dashboard/live-exams` (`dashboard/live-exams/page.tsx`), `/dashboard/doubt-solver` (`dashboard/doubt-solver/page.tsx`).

---

## 4. High-Risk Cross-Layer Couplings

1. **Auth Claims (`auth.py`) -> BOLA Guards (`security_guard.py`, `guardians.py`, `results.py`, `attendance.py`, `students.py`, `finance.py`) -> DB Identity (`User.id` vs `Student.id` / `Guardian.id`)**: `results.py` and `auth.py:refresh_token_endpoint` currently conflate `User.id` with `Student.id` / `Guardian.id`.
2. **Learning Studio API Prefix (`main.py` `/api/v1/learning-os`) <-> `frontend/app/dashboard/learning/page.tsx` (`/api/v1/learning-studio`)**: Complete path & schema mismatch causing UI breakdown.
3. **Pricing SSOT (`pricing_engine.py` vs `billing.py` vs `subscriptions.py` vs `DynamicPricingCalculator.tsx` / `onboard/page.tsx`)**: Unsynchronized pricing plans and client-side math divergence.

