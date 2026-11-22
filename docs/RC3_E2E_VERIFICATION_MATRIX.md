# RC3 End-to-End Verification Matrix

**Date:** 2026-11-12 | **Alembic Revision:** `cedb24c053f7 (head)`

| Check / Gate | Command | Scope & Conditions | Exit Code | Verbatim Outcome |
| :--- | :--- | :--- | :--- | :--- |
| Backend Static, Ruff, Import, Drift, FE Typecheck | `bash backend/scripts/check.sh` | Networked (`BypassSandbox: true`) for live Supabase `schema_drift.py` | `0` | `All checks passed!`, `0 issue(s). Schema mile gache.`, `ALL OK` |
| Hardcoded Tenant Check | `bash backend/scripts/check_hardcoded_tenant.sh` | Repo-local (`AGENTS.md` path `scripts/check_hardcoded_tenant.sh` missing; actual file is `backend/scripts/check_hardcoded_tenant.sh`) | `0` | `OK: no hardcoded tenant branding` |
| OpenAPI Contract Script | `python backend/scripts/openapi_contract.py` | Mentioned in `AGENTS.md` §5 | `N/A` | Missing on disk (`backend/scripts/openapi_contract.py` does not exist) |
| Full Backend Test Suite | `cd backend && PYTHONPATH=. ../venv/bin/pytest -q` | Live Supabase + SQLite test suites (`BypassSandbox: true` prior to checkpoint) | `0` | `179 passed, 5 warnings in 267.57s (0:04:27)` |
| PostgreSQL RLS & Security Isolation | `cd backend && PYTHONPATH=. ../venv/bin/pytest tests/test_rls_negative_db.py tests/test_rls_isolation.py tests/security/ -vv` | Networked (`BypassSandbox: true`) against live Supabase PostgreSQL (`ROLE authenticated`) | `0` | `7 passed, 2 warnings in 49.67s` |
| RC3 Pricing, Billing Custody & Learning E2E | `cd backend && PYTHONPATH=. ../venv/bin/pytest tests/test_rc3_pricing_and_billing.py -vv` | Networked (`BypassSandbox: true`) | `0` | `4 passed, 2 warnings in 21.05s` |
| Alembic Migration Revision | `cd backend && ../venv/bin/alembic current` | Networked (`BypassSandbox: true`) against live Supabase PostgreSQL | `0` | `cedb24c053f7 (head)` |
| Owner DB Remediation Script (Dry-Run) | `PYTHONPATH=backend venv/bin/python backend/scripts/owner_approved_db_remediation.py` | Networked (`BypassSandbox: true`), read-only | `0` | `Dry-run complete. No rows modified.` (Found 3 polluted role accounts, 6 orphan test tenants) |
| Frontend Unit Suites | `cd frontend && npm test -- --watchAll=false` | Node built-in test runner | `0` | `tests 79, suites 24, pass 79, fail 0, cancelled 0, skipped 0` |
| Frontend Standalone TypeScript Check | `cd frontend && npx tsc --noEmit` | Local workspace | `0` | 0 TypeScript errors |
| Frontend Scoped ESLint | `cd frontend && npx eslint --quiet <10 modified RC3 files>` | Scoped to RC3-modified files | `0` | 0 ESLint errors |
| Frontend Repo-Wide ESLint | `cd frontend && npm run lint` | Entire `frontend/` directory | `0` (`tail`) | `✖ 309 problems (131 errors, 178 warnings)` in pre-existing untouched files |
| Frontend Production Build | `cd frontend && npm run build` | Next.js 16.2.9 webpack build | `0` | `Compiled successfully`, `Finished TypeScript`, `Generating static pages (50/50)` |

## Explicit Non-Verified Items
1. **Browser Playwright E2E / Visual Audit Post-RC3:** Not re-executed after frontend changes.
2. **Live Payment Gateway & External Messaging Dispatch:** Zero `BKASH_*`, `NAGAD_*`, `SSLCOMMERZ_*`, `SMS_*`, `SMTP_*`, `VAPID_*`, or `WHATSAPP_VERIFY_TOKEN` credentials exist in `backend/.env`; webhook/dispatch fail-closed paths tested synthetically only.
3. **Backup Restore Execution:** Documented in [`docs/RC3_BACKUP_RESTORE_DRILL.md`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/RC3_BACKUP_RESTORE_DRILL.md); live Supabase PITR restore not triggered.
4. **Live Remediation Execution:** [`backend/scripts/owner_approved_db_remediation.py`](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/scripts/owner_approved_db_remediation.py) ran strictly in `--dry-run` mode (`Dry-run complete. No rows modified.`).

