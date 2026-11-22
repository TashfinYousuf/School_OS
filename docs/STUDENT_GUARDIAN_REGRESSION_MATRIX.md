# EducationOS — Student & Guardian Experience Regression Matrix
**Document ID:** `docs/STUDENT_GUARDIAN_REGRESSION_MATRIX.md`  
**Date:** 2026-11-11  
**Status:** COMPLETED & VERIFIED  
**Auditors:** Principal Product Architect, Backend Architect, Security Engineer, QA Lead  

---

## 1. Comprehensive Defect & Regression Ledger

| ID | Category | Defect Description | Severity | Affected Files & Endpoints | Database Tables | Security / Business Impact | Reproduction Steps | Target Resolution |
| :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **REG-SG-01** | **Authentication** | Guardian logs in with admission number + phone number; no password or verification required. | **CRITICAL** | `backend/app/api/endpoints/auth.py:login_guardian`<br>`frontend/app/login/page.tsx` | `students`<br>`guardians`<br>`student_guardians` | Full account takeover by anyone knowing public student admission ID and mobile number. | Submit `POST /api/v1/auth/guardian` with `{"admission_number": "STD-01", "phone_number": "01711111111"}`. Valid JWT token returned. | Replace with secure guardian credentials (`email`/`phone` + `password`), MFA/OTP, or activation token. |
| **REG-SG-02** | **Authorization** | `security_guard.py` checks raw phone number string equivalence (`guardian_user.phone == student.guardian_phone`). | **CRITICAL** | `backend/app/core/security_guard.py`<br>`backend/app/api/endpoints/students.py` | `users`<br>`students` | Cross-student data leakage when multiple students share phone contact; BOLA/IDOR vulnerability. | Modify student guardian phone to match target guardian user. Target guardian immediately accesses student record. | Enforce database join on `GuardianStudentLink` with `verification_status == 'VERIFIED'`. |
| **REG-SG-03** | **Data Integrity** | Frontend displays hardcoded fake student report card ("Talha Hussain") on 404 response. | **HIGH** | `frontend/app/dashboard/results/page.tsx:106-120` | None (Client-side mock) | False academic records shown to parents; trust violation; non-compliance with data truthfulness standards. | Log in as guardian, navigate to `/dashboard/results`. View fake student "Talha Hussain" in Play class. | Remove all client mock fallbacks; implement verified backend endpoint `/api/v1/guardians/me/children/{id}/progress-card`. |
| **REG-SG-04** | **IAM Lifecycle** | Admission enrollment provisions `Student` and `Guardian` records with `user_id = None`. | **HIGH** | `backend/app/api/endpoints/admissions.py:enroll_admitted_student` | `students`<br>`guardians`<br>`users` | Students and guardians have no persistent login identities; system forced to rely on unauthenticated phone lookups. | Enroll applicant in `/admissions`. Query `students` table; `user_id` is `NULL`. | Transactionally generate `User` identities and create `AccountInvitation` tokens upon enrollment. |
| **REG-SG-05** | **Security / Admin** | Admin reset student password generates plaintext temporary password returned in HTTP response. | **MEDIUM** | `backend/app/api/endpoints/auth.py:reset_student_password` | `users`<br>`students` | Administrators can view student credentials; violation of zero-knowledge credential administration. | Admin calls `POST /api/v1/auth/student/{id}/reset-password`. Plaintext password returned in response body. | Send secure single-use activation invitation token via verified channel; student establishes permanent password. |
| **REG-SG-06** | **Relationship Integrity** | `GuardianStudentLink` lacks verification status and audit metadata. | **HIGH** | `backend/app/models/guardian.py:GuardianStudentLink`<br>`backend/app/api/endpoints/guardians.py` | `student_guardians` | Unverified guardian links immediately grant access to student academic, medical, and fee data. | Call `POST /guardians/{id}/link-student/{student_id}`. Link is immediately active with no verification check. | Add `verification_status` (`PENDING`, `VERIFIED`, `REVOKED`) and require verification before authorization. |
| **REG-SG-07** | **UX / Navigation** | Student and Guardian experiences are forced into admin `/dashboard` shell with no dedicated layout. | **MEDIUM** | `frontend/app/dashboard/page.tsx`<br>`frontend/app/dashboard/layout.tsx` | None | Cluttered, non-intuitive UX; parents see admin tabs; students lack dedicated learning workspace. | Log in as student. Sidebar shows admin-style layout with minimal links and no learning tools. | Construct dedicated `/student` and `/guardian` portal hierarchies with role-tailored navigation. |
| **REG-SG-08** | **Learning Studio** | `ai_tutor.py` returns hardcoded simulated responses; `learning_studio.py` lacks token/budget controls. | **MEDIUM** | `backend/app/api/endpoints/ai_tutor.py`<br>`backend/app/api/endpoints/learning_studio.py` | `tenant_ai_budgets`<br>`curriculum_chunks` | Feature incompleteness; risk of uncontrolled AI token spend; lack of genuine pedagogical tutoring. | Call `POST /api/v1/ai-tutor/socratic-prompt`. Returns static template string without AI reasoning. | Implement multi-module Learning Studio with real Gemini Socratic reasoning, quota tracking, and study room persistence. |

---

## 2. Regression Impact Assessment

```
┌────────────────────────────────────────────────────────────────────────┐
│                     REGRESSION SEVERITY SUMMARY                        │
├────────────────────────────────┬───────────────────────────────────────┤
│ Critical Severity (Must Fix)   │ 2 (REG-SG-01, REG-SG-02)              │
│ High Severity (Must Fix)       │ 3 (REG-SG-03, REG-SG-04, REG-SG-06)   │
│ Medium Severity (Remediated)   │ 3 (REG-SG-05, REG-SG-07, REG-SG-08)   │
│ Total Issues Tracked           │ 8 Foundational Regressions            │
└────────────────────────────────┴───────────────────────────────────────┘
```

---

## 3. Backward Compatibility & Migration Strategy

1. **Non-Breaking API Migration:**
   - Keep existing `/api/v1/auth/student` endpoint backward compatible while introducing `/api/v1/auth/activate` and `/api/v1/auth/guardian/login`.
   - Deprecate insecure `/api/v1/auth/guardian` endpoint in favor of password-authenticated `/api/v1/auth/guardian/login`.
2. **Database Invariants:**
   - Additive columns only on `student_guardians`: `verification_status`, `verification_method`, `verified_at`, `revoked_at`.
   - New table: `account_invitations` for single-use high-entropy activation tokens.
3. **Data Preservation:**
   - Existing enrolled students and linked guardians will be backfilled with active `User` accounts and `VERIFIED` relationship status to prevent service interruption during migration.

