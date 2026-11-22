# EducationOS RC3 — Independent Known Issues & Defect Register

**Repository:** `/Users/tashfinyousuf/Python/SCHOOL_OS`  
**Target Release:** RC3 — Academic & Experience Transformation  
**Auditor:** Independent Principal Software Auditor & QA Architect  
**Audit Mode:** AUDIT ONLY  
**Date:** November 14, 2026  

---

## 1. Overview

This document serves as the canonical register of all open defects, security findings, verification gaps, and infrastructure constraints identified during the independent RC3 production acceptance audit.

---

## 2. Categorized Defect & Issue Register

### A. Security & Authorization Issues

| Issue ID | Title & Summary | Severity | Affected Component | Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-AUDIT-IDOR-01** | **BOLA / IDOR on Student Fee Ledger** | **HIGH** | [finance.py:424](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/finance.py#L424)<br>`GET /api/v1/finance/students/{id}/history` | Authenticated students or guardians can view any student's complete fee history within the same tenant by supplying their `student_id`. | Inject `current_user_claims` and call `security_guard.verify_student_scope` before returning data. |

---

### B. Infrastructure & Test Suite Coupling

| Issue ID | Title & Summary | Severity | Affected Component | Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-AUDIT-INFRA-01** | **Integration Tests Couple to Cloud Supabase DB** | **MEDIUM** | `test_owasp_top10_audit.py`<br>`test_student_guardian_reconstruction.py`<br>`test_production_blueprint.py` | Tests attempt direct connection to `aws-1-ap-south-1.pooler.supabase.com:6543`, failing in sandboxed, air-gapped, or offline environments. | Refactor these suites to use the SQLite in-memory fixture pattern used by `test_stage01-12` and `test_rc3_defect_remediation.py`. |
| **ENV-AUDIT-01** | **Live PostgreSQL RLS Cluster Inaccessible in Sandbox** | **MEDIUM** | Database / Sandbox Network | Native PostgreSQL RLS under the `authenticated` role could only be verified via offline DDL SQL generation, not live execution on the Supabase cluster. | Execute live validation on staging PostgreSQL instance outside sandbox boundary. |

---

### C. Static Code Quality & Linter Issues

| Issue ID | Title & Summary | Severity | Affected Component | Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-AUDIT-ESLINT-01** | **Frontend ESLint Violations (139 Errors)** | **LOW** | `frontend/` (Next.js ESLint) | `npm run lint` reports 139 errors (mostly `@typescript-eslint/no-explicit-any`, unused variables). `tsc --noEmit` is clean (0 errors). | Run `npm run lint -- --fix` and replace `any` types with explicit TypeScript interfaces. |
| **REPO-AUDIT-01** | **Gate 3 `openapi_contract.py` Script Missing** | **LOW** | `backend/scripts/` | `AGENTS.md` gate 3 references `python backend/scripts/openapi_contract.py`, but the script is not committed in the repository. | Either implement `backend/scripts/openapi_contract.py` to compare OpenAPI specs, or update `AGENTS.md` documentation. |

---

### D. Manual & Browser E2E Environment Verification Gaps

| Issue ID | Title & Summary | Severity | Affected Component | Impact | Recommended Fix |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **QA-GAP-01** | **Headful Browser Session Not Run in CLI Sandbox** | **LOW** | Headful Chrome Browser | Interactions were verified via component unit tests, DOM inspection, and CSS responsive query analysis; real human eye inspection in headful Chrome was not run. | Run owner UAT checklist across the 6 responsive viewports (360x800 to 1440x900). |

