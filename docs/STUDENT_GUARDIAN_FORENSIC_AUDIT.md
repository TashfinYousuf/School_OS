# EducationOS — Student & Guardian Experience Forensic Audit
**Document ID:** `docs/STUDENT_GUARDIAN_FORENSIC_AUDIT.md`  
**Date:** 2026-11-11  
**Status:** COMPLETED & VERIFIED  
**Audit Scope:** Full Stack (Frontend routes, Backend endpoints, ORM Models, Database Schema, IAM Lifecycle, Security Policies)  
**Auditors:** Principal Product Architect, Identity & Access Management Engineer, Database Security Engineer, UX Lead  

---

## 1. Executive Summary & Critical Vulnerability Summary

A thorough, code-level forensic audit of the existing Student and Guardian implementations in EducationOS was conducted across all backend services, database models, frontend routes, and security middleware. 

### Critical Vulnerabilities Identified:

1. **VULN-SG-01: Insecure Direct Authentication via Admission Number + Phone Number (CWE-287 / CWE-306)**
   - **Endpoint:** `POST /api/v1/auth/guardian` in `backend/app/api/endpoints/auth.py` (lines 387–428).
   - **Mechanism:** The endpoint accepts a student's `admission_number` and a `phone_number`. It queries the student, matches the phone against linked guardians, and **immediately issues full JWT Bearer access and refresh tokens without requiring a password, PIN, OTP, or secret**.
   - **Impact:** Any individual who knows or enumerates a student admission ID and a 11-digit mobile number can immediately hijack the guardian's account, accessing student attendance, grades, and invoices.

2. **VULN-SG-02: Identity Model Conflation & Ambiguous JWT Subject (CWE-639 / BOLA)**
   - **Root Cause:** When creating guardian tokens, `sub` is set to `str(guardian.id)`. However, across standard endpoints and middleware (e.g., `deps.py`, `security_guard.py`), `user_id` / `sub` is queried against the `users` table (`User.id == current_user_id`).
   - **Impact:** Guardian accounts frequently trigger runtime null pointer exceptions, causing fallback logic in `students.py` and `guardians.py` to match records by raw string phone numbers (`Guardian.phone_number == phone`).

3. **VULN-SG-03: Security Guard Relies on Unverified Phone Number String Matching (CWE-285)**
   - **Location:** `backend/app/core/security_guard.py` (lines 77–86).
   - **Flaw:** Guardian authorization verifies `guardian_user.phone == student.guardian_phone`.
   - **Impact:** If multiple students share a contact phone (e.g., cousins, community contacts, or typos), guardians gain unauthorized cross-student data access.

4. **VULN-SG-04: Non-Existent API Endpoint Leading to Fabricated Mock Data in Production (CWE-1188)**
   - **Location:** `frontend/app/dashboard/results/page.tsx` (lines 99–120).
   - **Flaw:** Frontend calls `safeFetch("/api/v1/results/progress-card/my-child")`, which returns HTTP 404 because the backend only provides `/api/v1/results/progress-card/{student_id}`.
   - **Impact:** The frontend catches the 404 and displays hardcoded mock data for a fictitious student ("Talha Hussain", Class "Play", GPA 5.0, 388 marks) to every real guardian in every school.

5. **VULN-SG-05: Missing Student Account Activation & Plaintext Password Exposure (CWE-256 / CWE-522)**
   - **Location:** `backend/app/api/endpoints/auth.py:reset_student_password` (lines 471–520).
   - **Flaw:** Administrators invoke password resets that generate temporary passwords returned in plaintext JSON directly to the administrator.
   - **Impact:** Administrators can view student passwords; there is no student invitation, activation token, or self-service password establishment flow.

6. **VULN-SG-06: Guardian–Student Relationship Model Lacks Verification State Machine (CWE-284)**
   - **Model:** `GuardianStudentLink` in `backend/app/models/guardian.py`.
   - **Flaw:** Contains only `guardian_id`, `student_id`, and `relationship_type`. Lacks verification status (`PENDING_VERIFICATION`, `VERIFIED`, `REVOKED`), verification timestamps, and authorized audit metadata.

7. **VULN-SG-07: Incomplete Student Portal Experience & Simulated Learning Studio (CWE-1007)**
   - **Location:** `frontend/app/dashboard/layout.tsx` and `backend/app/api/endpoints/ai_tutor.py`.
   - **Flaw:** The student portal has no dedicated learning workspace routes (`/student/learning/...`). `ai_tutor.py` returns hardcoded static strings ("Let's break this down. In Math, what is the first principle...").

---

## 2. Forensic Breakdown by System Layer

### 2.1 Backend Models & Schema Forensics

| Model / Table | File Location | Forensic State & Critical Gaps |
| :--- | :--- | :--- |
| `User` (`users`) | `backend/app/models/tenant.py` | Contains `id`, `email`, `password_hash`, `tenant_id`, `role`, `is_active`. Does not support institution-scoped usernames (e.g. `KSS-STD-001`) without overloading `email`. Lacks activation status and must-change-password flags. |
| `Student` (`students`) | `backend/app/models/student.py` | Contains `user_id` as an unconstrained UUID without foreign key constraint to `users.id`. Enrolled students created via admissions have `user_id = None`. |
| `Guardian` (`guardians`) | `backend/app/models/guardian.py` | Foreign key `user_id` to `users.id` exists but is often `None` because admissions enrollment does not create a `User` account. Relies on `phone_number` as fallback identity. |
| `GuardianStudentLink` (`student_guardians`) | `backend/app/models/guardian.py` | Joining table between `guardians` and `students`. Missing `verification_status`, `verification_method`, `verified_by`, `revoked_at`, and `effective_date`. Any row inserted is blindly trusted. |
| `RefreshTokenSession` (`refresh_token_sessions`) | `backend/app/models/auth.py` | Supports session tracking, but records `sub` inconsistently (sometimes `guardian.id`, sometimes `student.id`, sometimes `user.id`). |
| **Missing Model: `AccountInvitation`** | *Non-existent* | No database table exists to store cryptographically secure activation tokens, invitation hashes, expiration timestamps, or delivery channels. |

### 2.2 Backend API Endpoint Forensics

| Endpoint Path | File & Lines | Current Behavior & Defect |
| :--- | :--- | :--- |
| `POST /api/v1/auth/guardian` | `auth.py:387-428` | **CRITICAL DEFECT:** Authenticates guardian with `admission_number` + `phone_number` with zero password verification. Generates token with `sub=guardian.id`. |
| `POST /api/v1/auth/student` | `auth.py:433-469` | Accepts `admission_number` + `password`. Generates token with `sub=student.id`. Requires `student.user_id` to exist, but admissions does not provision user accounts. |
| `POST /api/v1/auth/student/{id}/reset-password` | `auth.py:471-520` | Generates `temp_password` and returns it in plain text to admin. Creates synthetic email (`@students.invalid`). No student activation workflow. |
| `GET /api/v1/guardians/me/children` | `guardians.py:179-301` | Resolves guardian by `(Guardian.id == user_uuid) | (Guardian.user_id == user_uuid)` with fallback to phone number. Iterates linked students without checking verification status. |
| `GET /api/v1/results/progress-card/{student_id}` | `results.py:158-210` | Expects `claims["user_id"]` to match `GuardianStudentLink.guardian_id`. Since `user_id` is ambiguous, access checks fail. |
| `POST /api/v1/admissions/{id}/enroll` | `admissions.py:290-413` | Enrolls student and creates `Student` and `Guardian` records, but leaves `student.user_id = None` and `guardian.user_id = None`. No account activation invitation is generated. |
| `POST /api/v1/learning-os/socratic-solve` | `learning_studio.py:18-52` | Raw Gemini call without tenant budget checks, student quota tracking, or prompt-injection hardening. |
| `POST /api/v1/ai-tutor/socratic-prompt` | `ai_tutor.py:16-48` | Returns static simulated string with no real pedagogical engine or student history. |

### 2.3 Frontend Route & UX Forensics

| Route / View | File Location | Forensic State & Gaps |
| :--- | :--- | :--- |
| `/login` | `frontend/app/login/page.tsx` | "Parent" tab presents `Student Admission ID` + `Guardian Phone Number` form. "Student" tab requires password with no activation link or password reset option. |
| `/dashboard` | `frontend/app/dashboard/page.tsx` | Monolithic file (467 lines) multiplexing teacher, student, and guardian UIs with conditional JSX blocks. Lacks dedicated student/guardian layouts. |
| `/dashboard/attendance` | `attendance/page.tsx` | Conditionally renders child picker for guardians, but lacks deep daily punctuality breakdown and exportable absence history. |
| `/dashboard/results` | `results/page.tsx` | Calls non-existent `/api/v1/results/progress-card/my-child`, causing fallback to hardcoded mock data ("Talha Hussain"). |
| `/dashboard/layout.tsx` | `layout.tsx` | Guardian and student sidebars are stripped-down copies of admin sidebar instead of role-tailored digital workspaces. |
| `/student/*` & `/guardian/*` | *Non-existent* | No clean, isolated route hierarchy exists for student or guardian roles. |

---

## 3. Root Cause Analysis Matrix

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                             ROOT CAUSE ANALYSIS                                         │
├──────────────────────────┬───────────────────────────────────────────────────────────────┤
│ Issue                    │ Root Cause                                                    │
├──────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Insecure Guardian Login  │ Architectural shortcut treating academic contact records as   │
│                          │ authentication credentials instead of creating true User IAM. │
├──────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Cross-Student Leaks     │ Authorization checks comparing string phone numbers in        │
│                          │ security_guard.py instead of verified relational entities.    │
├──────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Mock Data in Production  │ Frontend route mismatch (/my-child vs /{student_id}) paired   │
│                          │ with an irresponsible fallback mock payload.                  │
├──────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Admin Plaintext Password │ Absence of an asynchronous activation invitation token system │
│ Exposure                 │ and password establishment workflow.                          │
├──────────────────────────┼───────────────────────────────────────────────────────────────┤
│ Identity Token Confusion │ Setting JWT `sub` to guardian.id / student.id instead of     │
│                          │ canonical users.id, breaking standard user-based RBAC.       │
└──────────────────────────┴───────────────────────────────────────────────────────────────┘
```

---

## 4. Conclusion & Required Action Plan

The existing student and guardian implementations require a foundational reconstruction:
1. Establish a canonical IAM model where every Student and Guardian account is a first-class `User` record with secure credentials.
2. Replace admission number + phone number login with secure credentialed authentication.
3. Introduce an `AccountInvitation` entity with single-use, cryptographically secure activation tokens.
4. Elevate `GuardianStudentLink` to a stateful, verified entity with server-side authorization enforcement.
5. Build dedicated `/student` and `/guardian` portals with real, verified academic data, genuine Learning Studio tools, and zero hardcoded mock fallbacks.

