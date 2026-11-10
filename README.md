EducationOS — GitHub Developer
Documentation
Official Documentation • Version 1.0
EducationOS — Developer Documentation
Baseline: 9 November 2026 | Status: working product / pilot preparation; verify current repository before
release.

1. Product boundaries
• EducationOS Core: identity, organizations, workspaces, memberships, entitlements, billing, audit, storage,
notifications, AI orchestration and shared infrastructure.
• SchoolOS: admissions, students, classes/sections, attendance, timetable, fees, notices, school assessments,
grading and report cards.
• AcademyOS: independent coaching/academic-care operations: campuses, programs, batches, subject
bundles, question bank, competitive exams, timed attempts, negative marking, merit and learner analytics.
A School and an Academy are separate workspace types. An Academy is not required to be a child of a School. A
customer may operate either one independently or multiple workspaces under one organization. Shared
infrastructure must not collapse separate business rules, navigation, API routes or authorization policies.

2. Reported technology baseline
• Frontend: Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui.
• Backend: Python, FastAPI.
• Database: PostgreSQL via Supabase; Alembic migrations.
• AI: Gemini 2.5 Flash reported for selected workflows.
• WhatsApp Cloud API inbound handling and offline attendance synchronization are reported.
• JWT-based authentication is reported; confirm exact identity provider, token lifecycle and refresh strategy
from source.
• Multi-provider fallback, production topology, exact versions and native app status must be verified before
being described as shipped.

EducationOS | Documentation v1.0 | Draft for review Page 2
FastAPI
├─ Identity & memberships
├─ Organization/workspace/entitlements
├─ School domain
├─ Academy domain
├─ Assessment & exam services
├─ AI orchestration/verification
├─ Notifications/billing
└─ Audit/analytics
|
PostgreSQL + object storage + optional vector index
|
AI / messaging / payment providers
4. Recommended domain and API boundaries
/api/v1/auth/*
/api/v1/organizations/*
/api/v1/workspaces/*
/api/v1/memberships/*
/api/v1/school/*
/api/v1/academy/*
/api/v1/assessment/*
/api/v1/question-bank/*
/api/v1/ai/*
/api/v1/notifications/*
/api/v1/billing/*
/api/v1/audit/*
Examples: POST /api/v1/school/assessments, POST /api/v1/academy/exams, POST
/api/v1/academy/exams/{id}/attempts, POST /api/v1/academy/attempts/{id}/submit.
Use explicit schemas, stable error codes, correlation IDs, pagination conventions and idempotency keys for
attendance, payment confirmation and exam submission. Do not let a frontend toggle silently change a generic
endpoint's domain semantics.
5. Tenancy, identity and authorization
Recommended entities: users, organizations, workspaces, memberships, role_permissions, resource_scopes,
workspace_entitlements.
Use RBAC for role defaults and ABAC/resource scopes for assigned classes, branches, batches and records.
Resolve workspace membership server-side; never trust a client-supplied tenant_id. Enforce PostgreSQL RLS
using the real application DB role. Add tenant/workspace-consistent foreign-key constraints. Client route guards
are UX only, never authorization.
Guardian access must require verified identity and an explicit child relationship. Disabled memberships and
revoked sessions must stop accessing protected resources.
6. Exam domain separation
School assessment: academic session, class, section, subject, term, marks, moderation, grading policy,
GPA/report card and controlled publication.
Academy exam: program, campus, batch, candidate eligibility, timer, randomized questions, negative
marking, attempt lifecycle, submission lock, rank/percentile and performance analytics.
Share low-level primitives only when invariants match. Snapshot exam rules at publication so later edits cannot
mutate active or completed exams. Make submission idempotent and resilient to network retries.
7. AI generation and model fallback
EducationOS | Documentation v1.0 | Draft for review Page 3
Never display preset/demo/Banglish questions when model generation fails. Use a fail-closed pipeline:
– Authorize request and check quota.
– Retrieve approved curriculum/source material.
– Build a versioned question blueprint.
– Route to a model using task-specific policy.
– Parse strict structured output.
– Validate subject, chapter, language, options, answer references and difficulty.
– Apply deterministic checks where possible (math/symbolic/unit checks).
– Check duplicates and near-duplicates within authorized scope.
– Apply verifier/rule-based review.
– Store as DRAFT, NEEDS_REVIEW, VERIFIED or REJECTED.
– Require educator approval before official use.
Fallback improves availability, not truth. A second LLM is not proof of correctness. Persist model/provider,
prompt version, source IDs, validation results, retry chain and reviewer decision. Minimize PII in prompts.
Question importance, novelty, difficulty and exposure must be separate signals. Revisit important concepts with
new verified variants rather than repeating exact wording. Similarity thresholds require a labelled evaluation
set; no universal threshold guarantees uniqueness.

8. AI governance
• L0 Read: authorized, minimized data.
• L1 Recommend: no state mutation.
• L2 Draft: reviewable draft.
• L3 Execute only after authorized human approval.
• L4 Human-only: employment termination, final disciplinary decisions and other consequential decisions.
AI tools must be narrowly scoped. Never give an agent unrestricted database credentials.

9. Frontend and accessibility
Mobile-first at 360px, 390px, tablet and desktop. Keep one design system. Separate School/Academy
navigation. Every page needs loading, empty, error, denied and offline states. Use accessible labels, keyboard
focus and adequate contrast. Use a server-state query/cache layer; validate on both client and server.

10. Database and release engineering
Alembic migrations are the schema source of truth. Test migrations against disposable PostgreSQL. Preserve
financial and academic history using versioning/reversals. Define retention and deletion for student records,
messages, recordings and AI artifacts.
CI gates: lint/type checks, unit/integration, API contract, migration, RLS, tenant isolation, RBAC/ABAC, domain
separation, idempotency, exam reconnect/submission, AI evaluation, E2E, load/failure tests, backup restore and
deployment smoke test.
EducationOS | Documentation v1.0 | Draft for review Page 4
Block release on tenant leakage, unauthorized access, incorrect grades/financial calculations, lost exam
submissions, unauthorized publication or corrupted migrations.

11. Local development (illustrative; confirm repository scripts)
npm install
npm run dev
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
Never commit .env, service keys, provider keys or production data. Use synthetic fixtures.

12. Release vocabulary
• IMPLEMENTED_REPORTED: implementation reported by project owner; not independently audited.
• TESTED: specified tests passed in a named environment.
• PILOT_VALIDATED: real users completed defined acceptance criteria.
• PRODUCTION_READY: security, reliability, operations, support and rollback gates passed.
• ROADMAP: planned, not available.

13. Operational runbooks
Maintain runbooks for migration/recovery, backup restore, AI outage/quota, failed notifications, payment
reconciliation, exam incidents, tenant exposure, credential rotation and workspace module changes.

14. Contribution workflow
Issue with acceptance criteria → inspect existing code → plan affected domains → implement with tests → run
regression/security checks → update API/user docs → PR with evidence. Local success alone is not production
readiness.
15. Contacts
Product owner: [Name] · Engineering: [Email] · Security: [security@your-domain] · Website: [Domain] ·
Repository: [GitHub URL].
