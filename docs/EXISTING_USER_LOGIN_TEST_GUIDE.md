# EducationOS — Existing User Login & Authentication Test Guide
**Release Track:** RC3 — Academic & Experience Transformation  
**Status:** Canonical Quality Assurance Guide  
**Target Roles:** Superadmin, Admin, Teacher, Accountant, Finance Officer, Guardian, Student  

---

## 1. Scope & Verification Objective

This guide provides precise, repeatable verification procedures to guarantee that existing user accounts across all institutional tiers can authenticate, renew JWT tokens, access role-scoped workspaces, and switch children (for guardians) without errors, session drops, or privilege escalation.

---

## 2. Authentication Architecture Summary

- **Token Storage**: `localStorage.getItem("access_token")`, `localStorage.getItem("refresh_token")`, `localStorage.getItem("user_role")`.
- **Session Cleanup**: Canonical helper `clearSession()` in `frontend/lib/api-client.ts`.
- **Tenant Context**: Automatically propagated via `X-Tenant-ID` header and JWT claims (`tenant_id`, `user_id`, `role`).
- **Workspace Navigation**:
  - `admin` / `superadmin`: Full dashboard suite (`/dashboard`, `/dashboard/students`, `/dashboard/finance`, `/dashboard/academic`).
  - `teacher`: Teacher 360, Daily Roll Call, and Voice Diary AI (`/dashboard/attendance`, `/dashboard/academic`).
  - `accountant` / `finance_officer`: Fee Collection & Financial Ledger (`/dashboard/finance`).
  - `guardian`: Multi-child Academic & Fee Status Portal (`/dashboard/guardian`, `/dashboard/attendance`, `/dashboard/finance`).
  - `student`: Digital Twin Identity, Homework, Exam Routine, Fee Status (`/dashboard/student`).

---

## 3. Step-by-Step Test Scenarios

### Scenario 1: Standard Administrative Login
1. Navigate to `/login`.
2. Input credentials:
   - Email: `admin@school.edu.bd`
   - Password: `[CONFIGURED_SECURE_PASSWORD]`
3. Submit login.
4. **Expected Outcome**:
   - HTTP 200 with JWT access token received.
   - Redirect to `/dashboard`.
   - Topbar displays correct institution name (via `useInstitution()`) and theme toggle.
   - Voice Diary AI button is **hidden** (strictly teacher-only).

### Scenario 2: Teacher Login & Voice Diary Gating
1. Log in with a verified teacher account:
   - Email: `teacher@school.edu.bd`
2. **Expected Outcome**:
   - Redirect to `/dashboard`.
   - Topbar displays purple **"Voice Diary AI"** button.
   - Access to `/dashboard/attendance` allows class selection and **Period selection** (DAILY through Period 8).
   - Access to `/dashboard/academic` allows viewing routines and uploading RAG curriculum documents.

### Scenario 3: Guardian Portal & Child Switching
1. Log in with a verified guardian mobile or email:
   - Identifier: `01711000000` / `guardian@domain.com`
2. **Expected Outcome**:
   - Redirect to `/dashboard/guardian` or portal view on `/dashboard/attendance` & `/dashboard/finance`.
   - Top pills list all linked students (e.g. "Tanvir (Class 9)", "Nusrat (Class 4)").
   - Clicking a child's pill instantly updates the displayed attendance percentage, working days, and fee dues.
   - Zero administrative controls or raw student editing tools visible.

### Scenario 4: Student Self-Service Portal
1. Log in with student credentials:
   - Identifier: `STU-2026-0042` / `student@school.edu.bd`
2. **Expected Outcome**:
   - Directed to `/dashboard/student`.
   - Displays digital student ID card, attendance history log, and tuition fee vouchers.
   - Read-only protection: all sensitive fields disabled.

### Scenario 5: Token Expiration & Automatic Refresh
1. Set token expiration to 5 seconds or simulate 401 response.
2. Trigger an authenticated request (e.g., browse `/dashboard/attendance`).
3. **Expected Outcome**:
   - `fetchWithTenant` captures 401, invokes `/api/v1/auth/refresh` with refresh token.
   - New access token stored in localStorage seamlessly.
   - If refresh token also expired, invokes `clearSession()` and redirects cleanly to `/login?expired=1`.

---

## 4. Automated Smoke Verification Script

Execute the backend authentication and route smoke test:
```bash
cd backend
../venv/bin/python -m pytest tests/test_stage05_rbac.py -v
```
**Acceptance Criterion:** 10/10 tests pass with zero failures or permission leaks.

