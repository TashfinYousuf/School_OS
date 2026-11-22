# EDUCATIONOS — STAGE 12.5.1 IMPLEMENTATION REPORT
## Pilot-Critical Stabilization: Header Decoupling, Academic Endpoints & Localization

**Project:** EducationOS / SchoolOS Enterprise  
**Target Milestone:** Kids Shine School Pilot (15 November 2026)  
**Stage:** 12.5.1 (P0 Pilot Stabilization)  
**Status:** IMPLEMENTED & VERIFIED  
**Date:** 9 November 2026  

---

## 1. Executive Summary

Stage 12.5.1 resolves four high-severity architecture and runtime blockers identified during preflight audit and pilot-readiness validation:

1. **Header Decoupling (`X-Tenant-ID` vs `X-Workspace-ID`)**:
   - **Pre-existing Flaw:** `frontend/lib/api-client.ts`'s `getActiveTenantId()` read `active_workspace_id` prior to `tenant_id`, overwriting the root institution's tenant ID with sub-campus UUIDs in outbound `X-Tenant-ID` HTTP headers.
   - **Resolution:** Fully decoupled `getActiveTenantId()` (reads authoritative root institutional `tenant_id`) from `getActiveWorkspaceId()` (reads scoped campus/academy `active_workspace_id`). Updated `fetchWithTenant()` to inject `X-Tenant-ID` and `X-Workspace-ID` independently.
   - **Backend Hardening:** Implemented `get_current_workspace_id` in `backend/app/api/deps.py` with multi-tenant verification: validates that the requested workspace belongs strictly to the authenticated tenant, is active, and verifies explicit workspace membership for non-admin roles (failing closed with 403 Forbidden).

2. **Academic Grades Routing & NCTB Provisioning**:
   - **Pre-existing Flaw:** `GET /api/v1/academic/grades` failed with HTTP 405 Method Not Allowed due to Starlette route conflict with the parameterized route `DELETE /api/v1/academic/{slot_id}`.
   - **Resolution:** Positioned explicit `/grades` route handler before parameterized slot endpoints in `backend/app/api/endpoints/academic.py`. Implemented deterministic auto-seeding of standard NCTB curriculum grade levels (Class 1 through Class 10) for newly provisioned schools.

3. **Multi-Dialect Database & Test Harness Compatibility**:
   - Resolved SQLite dialect compilation failure on bare `JSONB` column definitions in `Workspace.enabled_modules` by employing `Column(JSON().with_variant(JSONB, "postgresql"), ...)`.
   - Identified and resolved SQLite numeric affinity float-truncation bug where UUIDs without hex alpha characters (`10000000000000000000000000000001` vs `10000000000000000000000000000002`) evaluated identically to `1e+31`.

4. **Dynamic Context & Bangladesh Localization (BDT `৳` & `Intl.DateTimeFormat`)**:
   - Verified dynamic institution and workspace name rendering in `WorkspaceSwitcher` and dashboard shell.
   - Standardized canonical `formatBDT(amount: number)` and `formatDate(date, language)` using browser/Node `Intl.DateTimeFormat` across English and Bengali (`bn-BD`).

---

## 2. Component Modification Inventory

| File Path | Nature of Change | Purpose |
|:---|:---|:---|
| `frontend/lib/api-client.ts` | Modified | Decouple `getActiveTenantId()` and `getActiveWorkspaceId()`; inject distinct headers in `fetchWithTenant()`. |
| `frontend/app/login/page.tsx` | Modified | Add `active_workspace_id`, `school_name`, and `institution_name` to session lifecycle and cleanup. |
| `frontend/lib/i18n.ts` | Modified | Export canonical `formatBDT` and `formatDate` utilities using `Intl.DateTimeFormat`. |
| `frontend/tests/test_stage07_frontend.test.ts` | Modified | Update Stage 07 test suite to assert decoupled `X-Tenant-ID` and `X-Workspace-ID` contract. |
| `frontend/tests/test_stage12_5_1_headers.test.ts` | Created | Comprehensive 7-test suite for frontend header injection, switching, and session clearing. |
| `frontend/tests/test_stage12_5_public_website.test.ts` | Modified | Added regression assertions for `formatBDT` and `formatDate`. |
| `backend/app/api/deps.py` | Modified | Add `get_current_workspace_id` dependency with cross-tenant validation and membership checking; removed duplicate legacy stub. |
| `backend/app/api/endpoints/academic.py` | Modified | Add `GET /grades` and `POST /grades` endpoints before parameterized routes; provision NCTB Class 1–10 defaults. |
| `backend/app/api/endpoints/auth.py` | Modified | Return `active_workspace_id` in staff authentication payload based on explicit user membership or default active workspace. |
| `backend/app/models/workspace.py` | Modified | Update `Workspace.enabled_modules` to use cross-dialect `JSON().with_variant(JSONB, "postgresql")`. |
| `backend/app/core/database.py` | Modified | Configure SQLite in-memory engine flags (`check_same_thread=False`, `StaticPool`) when in SQLite mode. |
| `backend/tests/test_stage12_5_1_tenant_workspace.py` | Created | 10-scenario hermetic test suite verifying tenant/workspace isolation, membership guards, and malformed header rejection. |
| `backend/tests/test_stage09_institution_operations.py` | Modified | Added test coverage for `GET /api/v1/academic/grades` auto-seeding and `POST /api/v1/academic/grades`. |

---

## 3. Detailed Technical Architecture

### 3.1 Tenant vs Workspace Decoupling

EducationOS distinguishes between two administrative scopes:
1. **Root Institutional Tenant (`tenant_id`)**: The overarching legal and administrative institution (e.g., Kids Shine Education Trust). All database schemas, RLS isolation policies, user tables, and financial ledgers partition by `tenant_id`.
2. **Campus / Academy Workspace (`active_workspace_id`)**: A operational sub-branch or operational modality (e.g., Kids Shine Primary Campus vs Kids Shine Academic Coaching).

```
+-----------------------------------------------------------------------------------+
|                           Root Tenant: Kids Shine Trust                           |
|                        (X-Tenant-ID: 11111111-1111-1111-1111-111111111111)        |
+-----------------------------------------------------------------------------------+
                               |                                    |
                               v                                    v
            +----------------------------------+ +----------------------------------+
            |  Workspace: Kids Shine Primary   | |  Workspace: Kids Shine Academy   |
            |  Type: SCHOOL (NCTB K-12)        | |  Type: ACADEMY (Coaching Care)   |
            |  (X-Workspace-ID: 1a000000-...)  | |  (X-Workspace-ID: 2b000000-...)  |
            +----------------------------------+ +----------------------------------+
```

### 3.2 Security Guard Invariants in `get_current_workspace_id`

When an incoming request presents an `X-Workspace-ID` header:
1. **Format Validation**: Parses string to `uuid.UUID`. If malformed, terminates immediately with `HTTP 400 Bad Request`.
2. **Tenant Ownership**: Executes `SELECT 1 FROM workspaces WHERE id = :ws_id AND tenant_id = :claims_tenant_id AND is_active = TRUE`. If no match, terminates with `HTTP 403 Forbidden` ("Cross-tenant access violation: Workspace does not belong to your tenant or is inactive").
3. **Role & Membership Enforcement**:
   - `admin` and `superadmin` have tenant-wide authority over all campuses under their tenant.
   - For `teacher`, `student`, and `guardian` roles, queries `WorkspaceMembership` for `user_id = :claims_user_id AND workspace_id = :ws_id AND is_active = TRUE`. If missing, terminates with `HTTP 403 Forbidden` ("Unauthorized workspace: User has no active membership in this workspace").

---

## 4. Verification & Gate Confirmation

- **Backend Workspace Isolation Matrix**: 10/10 tests passed (`backend/tests/test_stage12_5_1_tenant_workspace.py`).
- **Backend Academic Operations Suite**: 15/15 tests passed (`backend/tests/test_stage09_institution_operations.py`).
- **Frontend Unit & Integration Suites**: 70/70 tests passed (`npm test` in `frontend/`).
- **Live Database Route Smoke Test**: `GET /api/v1/academic/grades` against live Supabase PostgreSQL returned `HTTP 200 OK` with 10 NCTB curriculum grades.

