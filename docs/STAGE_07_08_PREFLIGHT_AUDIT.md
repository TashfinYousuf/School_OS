# EducationOS — Stage 07 & Stage 08 Preflight Audit Report

**Document Reference:** `PREFLIGHT-07-08`  
**Date:** 2026-11-05  
**Auditor / Security Engineer:** Principal Software Architect, Application Security Engineer & QA Lead  
**Scope:** Preflight Assessment, Roadmap Reconciliation, Baseline Inventory, and Implementation Directives for Stage 07 & Stage 08  

---

## 1. Executive Summary & Working Tree Status

Before modifying any application code, an exhaustive preflight inspection was conducted across the EducationOS repository.

### Repository Baseline:
- **Git Commit:** `3179bbf` on branch `main`
- **Working Tree State:** Preserving 44 modified files from Stages 01–06, plus verified test fixtures and documentation.
- **Backend Test Baseline:** **61 / 61 tests passing** across Stages 01–06 (`backend/tests/test_stage01_startup.py` through `test_stage06_finance.py`).
- **Database Release Gate:** **BLOCKED (Environment Boundary)**. Neither Docker, Podman, nor local PostgreSQL binaries exist on this host system. Remote Supabase access is strictly non-destructive.
- **Frontend Build Status:** **FAILED** (`TS2339: Property 'enableAcademyModule' does not exist on type 'WorkspaceContextType'`).

---

## 2. Mandatory Roadmap Reconciliation

### 2.1 Approved Master Roadmap
The authoritative project roadmap defines:
- **Stage 07: Frontend Reconstruction** (App Router, components, permissions-aware UI, centralized typed API client, auth & token lifecycle, English/Bangla localization, responsive design, tests).
- **Stage 08: Backend/API & Domain Architecture Hardening** (FastAPI routers & services, domain boundaries, Pydantic & SQLAlchemy validation consistency, Decimal precision, transaction boundaries & concurrency safety, observability & structured logging, contract tests).
- **Stage 09: Institution & Academy Operations** (Admissions, attendance, exams, results, notices, routines, operational workflows).
- **Stage 10: AI Gateway**
- **Stage 11: PWA / Offline**
- **Stage 12: Billing / Subscriptions**
- **Stage 13: Deployment / CI/CD**
- **Stage 14: Final Release Certification**

### 2.2 Discrepancy Note & Scope Demarcation
The previous Stage 06 closing summary informally referenced "Operations & Academic Management" as the next stage. **This discrepancy is formally resolved:**
- In strict adherence to the master sequence, **Stage 07 is Frontend Reconstruction** and **Stage 08 is Backend/API & Domain Architecture Hardening**.
- Operational workflows (Admissions, attendance, exams, results, notices, routines) remain **strictly deferred to Stage 09**.
- Zero Stage 09 business functionality will be implemented during Stages 07 and 08.

---

## 3. Preflight Audit Findings Across Subsystems

### 3.1 Frontend Architecture & Defects

| Defect ID | Severity | File Reference | Description | Root Cause |
| :--- | :---: | :--- | :--- | :--- |
| **DEF-P0-06** | **P0** | `components/AcademySetupWizard.tsx:9` | TypeScript compilation fails: `Property 'enableAcademyModule' does not exist on type 'WorkspaceContextType'` | `WorkspaceContextType` omitted `enableAcademyModule` declaration and implementation |
| **DEF-P0-09** | **P0** | `frontend/lib/apiClient.ts:7` | Cross-tenant cache pollution: `safeFetch` caches data with `EducationOS_cache_${url}` without tenant ID | Cache keys lack tenant/workspace scoping; switching tenants leaks previous tenant data |
| **DEF-P1-10** | **P1** | 18 dashboard subpages | Hardcoded `http://127.0.0.1:8000` in raw `fetch()` calls | Direct backend coupling bypassing `NEXT_PUBLIC_API_URL` and centralized API client |
| **DEF-P1-11** | **P1** | `frontend/app/login/page.tsx:79` | Missing refresh token storage: `persistSession` omits `refresh_token` | Silent token refresh fails; users prematurely logged out on access token expiration |
| **DEF-P1-12** | **P1** | `frontend/components/RoleRouteGuard.tsx` | RBAC route guard desynchronization with `layout.tsx` | Teachers allowed academic routine and guardians in layout, but blocked by `RoleRouteGuard` |
| **DEF-P1-13** | **P1** | `frontend/lib/api-client.ts` | Dual API clients with no 401 refresh interceptor or concurrency queue | Concurrent 401 responses trigger uncontrolled redirect loops instead of atomic token refresh |
| **DEF-P2-01** | **P2** | `frontend/` | Complete absence of automated frontend tests | No Jest, Vitest, or test runner scripts in `package.json` |

### 3.2 Backend Architecture & Security Review (Stage 01–06 Verification)

| Domain | Status | Security Property Verified |
| :--- | :---: | :--- |
| **Startup Lifespan** | **VERIFIED** | Non-blocking database probe with exponential backoff; degraded mode support |
| **Alembic Lineage** | **VERIFIED** | Single linear head `e5f6a7b8c9d0`, 12 revisions, zero dangling parents |
| **Authentication** | **VERIFIED** | Access vs refresh token type validation; persistent database token revocation |
| **Tenant Isolation** | **VERIFIED** | `get_db` injection across all routers; `tenant_guard` fail-closed enforcement |
| **RBAC Authorization** | **VERIFIED** | 37 canonical permissions, 7 roles, self-escalation blocks, BOLA/IDOR student profile checks |
| **Finance & Payments** | **VERIFIED** | **BLK-P0-08 fixed**: unverified MFS claims default to `PENDING`; HMAC-SHA256 webhook signatures; Decimal math; append-only ledger |

**Stage 01–06 Security Boundary Assessment:**
No critical defects undermine the existing Stage 01–06 security boundary. All 61 backend tests pass green.

---

## 4. Classified Remediation Plan

### 4.1 Stage 07 — Frontend Reconstruction
1. **Fix Compile Blocker (DEF-P0-06)**: Implement `enableAcademyModule` and full workspace switching in `frontend/lib/workspaceContext.tsx`.
2. **Centralize Unified API Client (`frontend/lib/api-client.ts`)**:
   - Merge `apiClient.ts` and `api-client.ts` into a single, robust, typed client.
   - Respect `process.env.NEXT_PUBLIC_API_URL` with sensible fallback.
   - Add concurrency-safe token refresh interceptor with request queueing.
   - Prevent cross-tenant cache pollution: scope cache keys to `tenant_id` and `workspace_id`.
3. **Persist Refresh Tokens (`frontend/app/login/page.tsx`)**:
   - Store `refresh_token` securely in `persistSession`.
   - Implement clean logout clearing all auth and workspace storage.
4. **Permission-Aware Frontend Architecture**:
   - Create centralized permission hook and component (`usePermissions`, `PermissionGate`).
   - Align `RoleRouteGuard.tsx` and `layout.tsx` to support teacher and student valid navigation.
   - Provide visual disabled/hidden states and unauthorized fallback states.
5. **Migrate Hardcoded URLs Across All 18 Dashboard Subpages**:
   - Replace raw `http://127.0.0.1:8000` fetch calls with the centralized `api-client.ts`.
6. **Bilingual Support (EN / BN)**:
   - Verify English and Bangla localization rendering and typography.
7. **Frontend Test Suite**:
   - Implement automated unit tests for authentication, token refresh lifecycle, permission gates, tenant cache isolation, and API error handling using Node 24 native test runner (`node --test --experimental-strip-types`).

### 4.2 Stage 08 — Backend/API & Domain Architecture Hardening
1. **Clean Service/Domain Boundaries**:
   - Decouple router layer from domain logic; standardize dependency injection.
2. **API Contract & Schema Standardization**:
   - Resolve Pydantic V2 deprecation warnings (`Field(json_schema_extra=...)`).
   - Standardize error response structure across all routers (`{"detail": "..."}`).
3. **Pessimistic Concurrency & Transaction Safety**:
   - Review transaction commit/rollback ownership across financial and academic mutations.
4. **Observability & Structured Logging**:
   - Standardize structured logging with request ID and tenant context; prevent sensitive data leakage.
5. **Automated Contract & Domain Regression Tests**:
   - Add dedicated Stage 08 domain and API contract tests.

---

## 5. Preflight Gate Verdict

- **Roadmap Reconciled**: **CONFIRMED** (Stage 07 = Frontend, Stage 08 = Backend, Stage 09 = Operations).
- **Stage 01–06 Baseline**: **VERIFIED GREEN (61/61 Tests Passing)**.
- **Preflight Evaluation**: **PASSED — AUTHORIZED TO PROCEED TO STAGE 07 IMPLEMENTATION**.

