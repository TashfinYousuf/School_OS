# EducationOS — Authentication Journey Acceptance Report
## Real Role-Based End-to-End IAM Verification & Security Acceptance

**Pilot Institution:** Kids Shine International School (KSIS)  
**Verification Date:** November 2026  
**Test Environment:** Full Multi-Tenant Stack (FastAPI Backend + Next.js Frontend + Supabase PostgreSQL)  
**Target Roles Verified:** `admin`, `student`, `guardian`  
**Status:** FULLY VERIFIED & ACCEPTED

---

## 1. Executive Summary

This document records the forensic end-to-end browser and API verification of the completed Student and Guardian authentication workflows. The tests confirm that:
1. Administrators can provision and manage student credentials directly from `/dashboard/students`.
2. Administrators can onboard guardians, link siblings, and generate activation links from `/dashboard/guardians`.
3. Account activation enforces single-use token consumption, strong password validation, and role-aware redirect to `/login?tab=student` or `/login?tab=guardian`.
4. Role-based session isolation and BOLA (Broken Object Level Authorization) controls strictly block cross-family and unauthorized access.

---

## 2. Journey A: Student Portal Provisioning, Activation & Student Login

### Step-by-Step Execution:
```mermaid
sequenceDiagram
    autonumber
    actor Admin as School Administrator
    participant UI as EducationOS Admin UI (/dashboard/students)
    participant API as FastAPI Backend (/api/v1/students)
    actor Student as KSIS Student
    participant ActUI as Activation Portal (/activate)
    participant LoginUI as Student Login (/login?tab=student)
    participant Dash as Student Learning Studio

    Admin->>UI: Navigate to /dashboard/students
    UI->>Admin: Displays Portal Access badge: "Not Provisioned"
    Admin->>UI: Clicks "Enable" on student row
    UI->>API: POST /api/v1/students/{id}/portal/provision
    API-->>UI: 200 OK (activation_token, expires_at: 7 days, username)
    UI-->>Admin: Displays modal with Single-Use Link & WhatsApp share button
    Admin->>Student: Dispatches activation link via WhatsApp / SMS
    Student->>ActUI: Opens /activate?token=xyz...
    ActUI->>API: GET /api/v1/auth/invitation-status?token=xyz...
    API-->>ActUI: 200 OK (valid: true, role: "student", identifier: "ADM-001")
    ActUI-->>Student: Displays "Valid Invitation" badge & student name
    Student->>ActUI: Enters new password (8+ chars) & confirms
    ActUI->>API: POST /api/v1/auth/activate (token, password)
    API-->>ActUI: 200 OK (Account activated, token marked consumed)
    ActUI->>LoginUI: Redirects to /login?tab=student with success banner
    Student->>LoginUI: Enters Student ID & new password
    LoginUI->>API: POST /api/v1/auth/token (username, password)
    API-->>LoginUI: 200 OK (JWT access_token with role: "student")
    LoginUI->>Dash: Lands on Student Learning Studio Dashboard
    Dash-->>Student: Renders Daily Timetable, Attendance (100%), and Circulars
```

### Verified Acceptance Evidence (Journey A):
- **API Endpoint:** `POST /api/v1/students/{student_id}/portal/provision` -> Returns `HTTP 200 OK` with `activation_token` and `activation_url`.
- **Database Status Transition:** Student user transitioned from unprovisioned -> `INVITED` -> `ACTIVE` on password submission.
- **Login Authentication:** Authenticated with `HTTP 200 OK`, returning valid JWT access token and claims `{"role": "student", "tenant_id": "1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31"}`.
- **Dashboard RBAC Isolation:** Student account attempting to access `/api/v1/finance/payments` received `403 Forbidden` (inaccessible to student role).

---

## 3. Journey B: Guardian Onboarding, Family Linking, Activation & BOLA Guard

### Step-by-Step Execution:
```mermaid
sequenceDiagram
    autonumber
    actor Admin as School Administrator
    participant GHub as Guardian Hub (/dashboard/guardians)
    participant API as FastAPI Backend (/api/v1/guardians)
    actor Guardian as KSIS Parent / Guardian
    participant ActUI as Activation Portal (/activate)
    participant LoginUI as Guardian Login (/login?tab=guardian)
    participant GDash as Family Portal Dashboard

    Admin->>GHub: Open "Portal Accounts & Family Links" tab
    Admin->>GHub: Clicks "Invite New Guardian"
    Admin->>GHub: Enters Name: "Md. Faruq", Phone: "01711998877", selects Student A
    GHub->>API: POST /api/v1/guardians/onboard
    API-->>GHub: 201 Created (guardian_id, raw_token, activation_url)
    GHub-->>Admin: Displays Activation Modal with Copy Link & WhatsApp buttons
    Admin->>Guardian: Shares link via WhatsApp
    Guardian->>ActUI: Opens /activate?token=abc...
    ActUI->>API: GET /api/v1/auth/invitation-status?token=abc...
    API-->>ActUI: 200 OK (valid: true, role: "guardian", identifier: "01711998877")
    Guardian->>ActUI: Sets password & submits
    ActUI->>API: POST /api/v1/auth/activate (token, password)
    API-->>ActUI: 200 OK (Token marked consumed in DB)
    ActUI->>LoginUI: Redirects to /login?tab=guardian
    Guardian->>LoginUI: Signs in using Phone "01711998877" and password
    LoginUI->>API: POST /api/v1/auth/token
    API-->>LoginUI: 200 OK (JWT access_token with role: "guardian")
    LoginUI->>GDash: Lands on Guardian Family Portal
    GDash-->>Guardian: Displays Student A attendance, report card, and fee dues
```

### Security & Invariant Tests (Journey B):
1. **Broken Object Level Authorization (BOLA / IDOR) Test:**
   - Guardian A attempts to query the 360 profile of an unlinked student (Student B) via `/api/v1/students/{student_b_id}/profile-360`.
   - **Result:** `403 Forbidden: Access denied: You are not authorized to view this student's profile`.
   - Verified in test suite: `backend/tests/test_stage05_rbac.py::test_student_profile_idor_bola_protection` -> **PASSED**.
2. **Single-Use Token Replay Protection:**
   - Attempted re-submitting the consumed invitation token to `/api/v1/auth/activate`.
   - **Result:** `400 Bad Request: Invitation token has already been consumed or is invalid`.
3. **Suspension & Session Revocation:**
   - Admin triggers `POST /api/v1/guardians/{guardian_id}/portal/suspend`.
   - User `is_active` set to `False`; existing JWT tokens blacklisted.
   - Guardian attempts subsequent request with prior JWT -> `401 Unauthorized: Session revoked`.
   - Guardian attempts new login -> `403 Forbidden: User account is inactive`.
   - Admin triggers `POST /api/v1/guardians/{guardian_id}/portal/reactivate`.
   - Guardian logs in -> **SUCCESS** (`200 OK`).

---

## 4. Summary Table of Verified Test Evidence

| Verification Target | Test Case / Route | Protocol / Method | HTTP Code | Status |
|---|---|---|---|---|
| Student List Portal Status | `GET /api/v1/students` | Batch Pre-fetch | 200 OK | **VERIFIED** |
| Student Portal Provision | `POST /api/v1/students/{id}/portal/provision` | IdentityService | 200 OK | **VERIFIED** |
| Student Password Reset | `POST /api/v1/students/{id}/portal/reset-password` | Single-use Token | 200 OK | **VERIFIED** |
| Student Portal Suspend | `POST /api/v1/students/{id}/portal/suspend` | Session Revocation | 200 OK | **VERIFIED** |
| Student Portal Reactivate | `POST /api/v1/students/{id}/portal/reactivate` | Activation | 200 OK | **VERIFIED** |
| Guardian Directory Status | `GET /api/v1/guardians/directory` | Directory Query | 200 OK | **VERIFIED** |
| Guardian Admin List | `GET /api/v1/guardians/admin/all` | Family Directory | 200 OK | **VERIFIED** |
| Guardian Onboard & Link | `POST /api/v1/guardians/onboard` | IdentityService | 201 Created | **VERIFIED** |
| Sibling Linking | `POST /api/v1/guardians/{id}/link-student/{sid}` | Family Linkage | 200 OK | **VERIFIED** |
| Sibling Unlinking | `POST /api/v1/guardians/{id}/unlink-student/{sid}` | Link Removal | 200 OK | **VERIFIED** |
| Guardian Portal Suspend | `POST /api/v1/guardians/{id}/portal/suspend` | Session Revocation | 200 OK | **VERIFIED** |
| Guardian Portal Reactivate | `POST /api/v1/guardians/{id}/portal/reactivate` | Activation | 200 OK | **VERIFIED** |
| Invitation Status Inspection | `GET /api/v1/auth/invitation-status` | Token Audit | 200 OK | **VERIFIED** |
| Token Activation | `POST /api/v1/auth/activate` | Cryptographic SHA-256 | 200 OK | **VERIFIED** |
| BOLA Protection Guard | `GET /api/v1/students/{sid}/profile-360` | Cross-Family Access | 403 Forbidden | **VERIFIED** |
