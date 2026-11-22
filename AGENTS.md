# SchoolOS / EducationOS: rules for coding agents

Multi-tenant school SaaS. Backend: FastAPI + SQLAlchemy 2 + Alembic + Supabase Postgres (pooler).
Frontend: Next.js (app router, TypeScript). Existing working behavior matters more than new code.
A change is NOT done until every gate in section 5 is green.

## 0. Before editing
- Read the files you will change AND every caller. `git grep -n` every symbol, route path, response field,
  DB column and localStorage key you touch. List the hits in your plan.
- Search for an existing helper before writing a new one. Reuse: `app/core/db_utils.py` (optional_query,
  optional_count, count_rows), `app/core/ai_client.py` (the single Gemini client),
  `app/services/institution.py` + `frontend/lib/institution.tsx` (school name/address/phone),
  `frontend/lib/api-client.ts` (`clearSession`, token handling). Never create a second copy of anything.
- Smallest possible diff. No drive-by refactors, renames, reformatting or dependency bumps.
  Do not touch files unrelated to the task.

## 1. Never break existing behavior
- API changes are additive only: add optional fields/params. Never remove or rename a route, response key,
  request field or enum value. If a break is unavoidable, stop and ask.
- When a request/response shape changes, update every consumer in the same change.
- Do not change auth, tenant scoping, money (fees/billing) or exam grading logic unless the task is about it.
  These are RISKY: stop and ask first.

## 2. Database and models (schema drift is our #1 recurring bug)
- Model change == migration in the SAME change: `alembic revision --autogenerate`, then READ the file.
  Delete any `drop_*` and any UUID<->String `alter_column`. New NOT NULL column on a table with rows:
  add nullable -> backfill -> set NOT NULL. Then `alembic upgrade head`; `alembic check` must be clean.
- Never call `Base.metadata.create_all()` outside `scripts/bootstrap_db.py`. Never use
  `extend_existing=True` to silence a duplicate table: one table = one model in one file.
- Every query on a tenant table filters `tenant_id`. IDs from request bodies/paths are untrusted:
  look them up together with tenant_id.
- Count with `count_rows`/`optional_count` (SELECT count(*)), not `db.query(Model).count()`.
- Dates are Asia/Dhaka. Filter timestamps by range, not `func.date()`.
- Write paths: unique constraint or row lock, never check-then-insert.

## 3. Errors
- No `except Exception: pass`, and no swallowed error without a log line.
  Optional read-only sections use `optional_query` and are reported in a `degraded` list.
  After any DB error call `db.rollback()` before reusing the session.
- Fan-out endpoints (dashboard, student 360, reports): each section fails independently.

## 4. Frontend
- No hardcoded school name/address/phone/logo. Use `useInstitution()`. The product name (EducationOS) is static.
- Session keys live in one place (`clearSession`). Do not duplicate lists of localStorage keys.
- API base comes from `NEXT_PUBLIC_API_URL`, never a `127.0.0.1` literal. FastAPI 422 `detail` is an array:
  format it, never `new Error(detail)`.
- `npx tsc --noEmit` must be clean.

## 5. Gates (run all, paste the last lines of each output)
1. `bash backend/scripts/check.sh`
2. `cd backend && pytest -q`   (smoke of every GET route, route uniqueness, 2-tenant isolation)
3. `python backend/scripts/openapi_contract.py`   (a breaking API change fails; additions need `--update` and a shown diff)
4. `bash scripts/check_hardcoded_tenant.sh`
If a gate fails, fix the cause. Never edit, skip, disable or loosen a check or test to make it pass.
If you think a check is wrong, say so and stop.

## 6. Final message must contain
Files changed (and why each), callers you updated, migrations added, gate outputs, what you did NOT verify
(for example no real browser test), and any RISKY item you deferred.