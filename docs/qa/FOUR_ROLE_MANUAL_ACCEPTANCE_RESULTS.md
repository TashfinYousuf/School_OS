# Four-Role Manual Login and Authorization Acceptance Results

**Repository:** `/Users/tashfinyousuf/Python/SCHOOL_OS`  
**Target Release:** RC3 — Academic & Experience Transformation  
**Auditor:** Independent Principal Software Auditor & Security Lead  
**Audit Mode:** AUDIT ONLY  
**Date:** November 14, 2026  
**Reference Code:** [auth.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/auth.py), [security.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/core/security.py), [RoleRouteGuard.tsx](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/components/RoleRouteGuard.tsx), [login/page.tsx](file:///Users/tashfinyousuf/Python/SCHOOL_OS/frontend/app/login/page.tsx)

---

## 1. Authentication Architecture & Protocol Summary

EducationOS RC3 implements a centralized, multi-tenant role-based authentication system supporting 4 distinct user personas:
1. **Admin** (`role: admin` / `superadmin`)
2. **Teacher** (`role: teacher`)
3. **Guardian** (`role: guardian`)
4. **Student** (`role: student`)

### Endpoints & Session Management
- **Local Application Login URL**: `http://localhost:3000/login`
- **Staff Auth Route (Admin/Teacher)**: `POST /api/v1/auth/staff`
- **Guardian Auth Route**: `POST /api/v1/auth/guardian/login` (and `/guardian`)
- **Student Auth Route**: `POST /api/v1/auth/student`
- **Token Invalidation (Logout)**: `POST /api/v1/auth/logout`
- **Token Refresh**: `POST /api/v1/auth/refresh`
- **Account Activation**: `POST /api/v1/auth/activate`

Tokens are signed JWTs with explicit `token_type: access` (expiry: 60 minutes) and `token_type: refresh` (expiry: 7 days). Revoked tokens are persisted in `revoked_tokens` and rejected immediately.

---

## 2. Role-by-Role Acceptance Results

### A. Role: School Administrator (Admin)
- **Account Provisioning**: Created upon tenant onboarding (`POST /api/v1/auth/register-school`) or by Superadmin.
- **Login Credentials**: Institutional email + password.
- **Tenant Mapping**: Bound via `User.tenant_id` and embedded `tenant_id` JWT claim.
- **Session Expiry**: 60-minute access token, rotated via refresh token.
- **Authorized Capabilities (Verified)**:
  - Full access to `/dashboard`, executive KPI cards, Sunday–Saturday weekly metrics, and Month-End Preview modal.
  - School settings configuration and workspace administration (`/dashboard/settings`).
  - Student admission wizard with automated UID generation (`POST /api/v1/students/admit`).
  - Teacher hiring, profile management, and class/period assignment (`/dashboard/teachers`).
  - Institutional fee collection, invoice creation, and monthly printable financial archive (`/dashboard/finance`).
  - Multi-channel AI notice composer and broadcasting (`/dashboard/notices`).
  - Curriculum document PDF upload, semantic chunking, and index management (`/dashboard/academic`).
- **Explicitly Denied Capabilities (Verified)**:
  - Cross-tenant record access (Enforced by `TenantGuard` and database RLS).
  - Hard deletion of financial payment records (HTTP 405 Method Not Allowed).
- **Audit Verdict**: **PASS**

---

### B. Role: Educator / Teacher
- **Account Provisioning**: Provisioned by Admin during faculty onboarding (`POST /api/v1/teachers/`). Links `Teacher` record to underlying `User` record with role `teacher`.
- **Login Credentials**: Teacher email + password.
- **Tenant Mapping**: Inherits `User.tenant_id`.
- **Session Expiry**: 60 minutes.
- **Authorized Capabilities (Verified)**:
  - Personal workload and timetable dashboard (`GET /api/v1/teachers/me/workload`).
  - Daily schedule filtered by current day of the week in `Asia/Dhaka` timezone.
  - Classroom student directory and live daily attendance marking (`POST /api/v1/attendance/events/bulk`).
  - Curriculum RAG access and Socratic teaching aids.
  - Teacher Voice Diary ingestion (`POST /api/v1/teacher-os/voice-diary-sync`).
  - Notice creation with target audience `TEACHERS`, `STUDENTS`, or `ALL`.
- **Explicitly Denied Capabilities (Verified)**:
  - Access to financial fee collection (`POST /api/v1/finance/collect` returns 403 Forbidden).
  - Access to school workspace settings and tenant provisioning.
  - Unassigned class attendance tampering.
- **Audit Verdict**: **PASS**

---

### C. Role: Guardian / Parent
- **Account Provisioning**: Created during student admission or invited by Admin (`POST /api/v1/auth/guardian/{guardian_id}/invite`). An invitation token is generated with a secure expiry.
- **Activation Procedure**: Guardian opens `http://localhost:3000/activate?token=...`, sets a secure password, and transitions account status to `ACTIVE`.
- **Login Credentials**: Verified mobile phone number (`017XXXXXXXX`) + password.
- **Security Invariant (VULN-SG-01 Regression Guard)**: Phone number alone is strictly rejected with HTTP 401. Password authentication is mandatory.
- **Tenant & Relationship Mapping**: Mapped via `GuardianStudentLink` where `verification_status == 'VERIFIED'`.
- **Authorized Capabilities (Verified)**:
  - Guardian portal access (`/dashboard/guardians` or student profile).
  - Multi-child toggle: seamless switching between enrolled siblings.
  - Linked student attendance records, daily status, and percentage metrics.
  - Published institutional notices targeted to `ALL` or `PARENTS`.
  - Student academic results and report cards.
- **Explicitly Denied Capabilities (Verified)**:
  - Access to unrelated students in the same tenant (Verified in [students.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/students.py#L630-L650)).
  - Financial fee collection or invoice modification.
  - Staff or Teacher dashboard routes.
- **Identified Gap / Finding**:
  - `GET /api/v1/finance/students/{student_id}/history` allows any authenticated guardian to view unlinked student fee ledgers if `student_id` is supplied (Logged as `SEC-AUDIT-IDOR-01`).
- **Audit Verdict**: **CONDITIONALLY ACCEPTED** (Pending resolution of `SEC-AUDIT-IDOR-01`).

---

### D. Role: Student
- **Account Provisioning**: Admin issues invitation/activation token via `POST /api/v1/auth/student/{student_id}/invite`.
- **Activation Procedure**: Student accesses `/activate?token=...` and sets their initial password.
- **Login Credentials**: Unique Student Admission ID (`STU-YYYY-XXXX`) + password.
- **Authorized Capabilities (Verified)**:
  - Student personal workspace (`GET /api/v1/students/me/dashboard`).
  - Personal class routine, period schedules, and assigned teachers.
  - Daily attendance history for own record.
  - Published examination marks and term results.
  - Interactive Socratic Doubt Solver & Learning Studio.
  - Notice acknowledgement (`POST /api/v1/notices/{id}/acknowledge`).
- **Explicitly Denied Capabilities (Verified)**:
  - Viewing other students' 360 dossiers (Rejected with HTTP 403 in `get_student_360_profile`).
  - Access to administrative, teacher, or finance configuration panels.
  - Modifying grades, attendance, or routine data.
- **Audit Verdict**: **PASS**

---

## 3. Synthetic QA Account Relationship Map

```
Tenant: Reconstruction Test Academy (ID: e4a1...9c1)
 │
 ├── [Admin] Principal Admin (admin@recon.edu.bd)
 │     └── Full Administrative & Financial Custody
 │
 ├── [Teacher] Kaynat Farzana (teacher@recon.edu.bd)
 │     ├── Assigned Class: Class 5-A
 │     └── Subjects: Mathematics, General Science
 │
 ├── [Student 1] Rafiq Ahmed (STU-2026-0001)
 │     ├── Enrolled: Class 5-A, Roll: 01
 │     └── Linked Guardian: Farid Ahmed (Father)
 │
 ├── [Student 2] Nusrat Jahan (STU-2026-0002)
 │     ├── Enrolled: Class 7-B, Roll: 05
 │     └── Linked Guardian: Kamal Hossain (Father)
 │
 └── [Guardian] Farid Ahmed (01712345678)
       ├── VERIFIED Link: Rafiq Ahmed (STU-2026-0001)
       └── UNLINKED: Nusrat Jahan (STU-2026-0002) -> Access Rejected with 403
```

