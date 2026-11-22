# RC3 Release Blockers Register

Every blocker below **PREVENTS** a `Production Ready` or `Commercially Ready` signoff until resolved or explicitly mitigated/approved.

| Blocker ID | Severity | Description | Resolution Path / Owner |
|---|---|---|---|
| BLK-01 | P0 (Code/Security) | Runtime `NameError` (`func` undefined in `guardians.py:564`) & silent Ruff bypass in `check.sh` | Fixed in Phase 1 & Phase 11 (`guardians.py`, `check.sh`). |
| BLK-02 | P0 (Code/Security) | Privilege escalation: `User.role` defaults to `"admin"` (`tenant.py:59`) and `create_guardian` omits role; **3 live Supabase accounts (`student1@kidsshine.com`, `father@kidsshine.com`, `student2@kidsshine.com`) have `role='admin'`** | Code fixed in Phase 1. **Requires explicit Owner authorization** before mutating live Supabase `users` rows (`role='student'` / `role='guardian'`). |
| BLK-03 | P0 (DB Isolation) | Live runtime DB role `postgres` has `rolbypassrls=True`; `get_tenant_db` never drops role; 35/58 public tables lack permissive RLS policies | Phase 1/7 Alembic migration + `SET LOCAL ROLE authenticated` evaluation in `database.py` + verified negative RLS tests. |
| BLK-04 | P0 (IAM/BOLA) | Default-allow `verify_student_scope` (`security_guard.py:101`), broken `results.py` ID comparisons, unverified link access & phone fallback across 6 endpoints, broken student refresh token | Fixed & verified with 12-scenario BOLA/IDOR test suite in Phase 1 & Phase 2. |
| BLK-05 | P0 (Feature/AI) | Learning Studio frontend/backend URL & schema mismatch (`/api/v1/learning-studio` vs `/api/v1/learning-os`), `RoleRouteGuard` blocking students, AI calls bypassing `MultiModelAIGateway` | Fixed & E2E verified in Phase 3. |
| BLK-06 | P0 (Security/Integrity) | Hardcoded payment webhook secret fallbacks (`finance.py`, `payment_providers.py`), fake `"DISPATCHED"` responses (`notifications.py`, `academy.py`), simulated OMR fallback | Hardened in Phase 1, 5 & 6 (fail-closed 503 on missing webhook secrets; honest queued/unconfigured states). |
| BLK-07 | P1 (Governance) | Tenant `"admin"` self-approval on `/api/v1/billing/admin/reconcile-payment` + fragmented pricing tables (`IS_OWNER_APPROVED = False` in `pricing_engine.py`) | Dual-custody / `superadmin` fix + `Decimal` backend SSOT in Phase 4 & 5. **Commercial pricing rates require explicit Business Owner sign-off (`IS_OWNER_APPROVED`).** |
| BLK-08 | P1 (External Infra) | Zero bKash, Nagad, SSLCommerz, SMS, SMTP, or VAPID credentials configured in `.env`; no local PostgreSQL server or Docker for isolated offline DB replay | Disclosed honestly: **Commercial live payments/SMS remain `BLOCKED` / `NOT LIVE`** until merchant credentials are supplied by owner. |
| BLK-09 | P1 (DB Hygiene & Quality) | Live Supabase holds 6 orphan `'Reconstruction Test Academy'` tenants + 1 orphan row in `guardian_students`; Frontend ESLint fails with 178 errors / 177 warnings | ESLint errors resolved in Phase 11; orphan cleanup script prepared for **Owner-authorized execution**. |

