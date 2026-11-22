# ROLE & PERMISSION GAP MATRIX (RBAC / IAM)

**Document Reference:** `docs/ROLE_AND_PERMISSION_GAP_MATRIX.md`  
**Release Track:** EducationOS RC3 — Academic & Experience Transformation  
**Auditor:** IAM & Application Security Engineer  
**Date:** 2026-11-14

---

## 1. Executive Summary & Forensic Baseline

A secure multi-tenant school SaaS requires strict separation of privileges across five primary user roles:
1. **Superadmin / Platform Operator**
2. **School Administrator (`admin`)**
3. **Teacher / Educator (`teacher`)**
4. **Student (`student`)**
5. **Guardian / Parent (`guardian`)**

Forensic analysis of the current navigation, layout, route guards, and backend API decorators reveals several critical privilege leakage and gap areas:
- **Voice Diary Feature Leakage:** The Voice Diary copilot button was mounted in the global top header of `frontend/app/dashboard/layout.tsx:383-390` without any role gate, making it visible and clickable for Admins, Guardians, and Students. In `backend/app/api/endpoints/teacher_diary.py:22`, the sync endpoint also allowed `["admin", "teacher"]`. By pedagogical design, Voice Diary is strictly a teacher classroom recording tool.
- **Student Profile Editing Privilege Gap:** The `Student` model updates in `backend/app/api/endpoints/students.py:248-266` were locked exclusively to `admin`. Students had zero self-service editing ability for permitted personal fields (such as contact details, address, profile photo), while administrators had no granular audit trail recording previous/new values.
- **Teacher Assignment Self-Modification Risk:** In `backend/app/api/endpoints/teachers.py`, teachers lacked a dedicated self-service profile endpoint, while administrative updates did not separate official employment parameters from teacher bio/qualification updates.

---

## 2. Canonical Feature-to-Role Authorization Matrix

| Dashboard Route / Feature | Allowed Roles | Navigation Visibility | API Endpoint & Decorator | Data Scoping Rule |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard Overview (`/dashboard`)** | Admin, Teacher, Student, Guardian | All Roles (Role-Specific View) | `GET /api/v1/dashboard/metrics`<br>`GET /api/v1/students/me/dashboard` | Tenant-scoped; Student/Guardian see own child records only |
| **Voice Diary AI (`VoiceLessonModal`)** | **Teacher Only** | **Teacher Only** (`userRole === 'teacher'`) | `POST /api/v1/teacher-diary/voice-diary-sync`<br>`require_roles(["teacher"])` | Teacher must belong to active tenant |
| **Students Base & Registry (`/dashboard/students`)** | Admin | Admin Only | `GET /api/v1/students/`<br>`require_roles(["admin"])` | Tenant-scoped directory |
| **Student 360 Full Profile (`/dashboard/students/[id]`)** | Admin, Teacher, Student (Own), Guardian (Own) | Admin: Registry<br>Student: My Profile<br>Guardian: Child Card | `GET /api/v1/students/{id}/profile-360` | Strict BOLA check: student must be self or verified ward of guardian |
| **Student Profile Edit (Administrative)** | Admin | Admin Only | `PATCH /api/v1/students/{id}`<br>`require_roles(["admin"])` | Logs full `AuditLog` diff (old vs new) |
| **Student Profile Edit (Self-Service)** | Student | Student Only (`/dashboard/profile`) | `PATCH /api/v1/students/me/profile`<br>`require_roles(["student"])` | Restricted to: phone, address, blood group, photo. Blocked: class, marks, roll, admission no. |
| **Teacher Command Center (`/dashboard/teachers`)** | Admin | Admin Only | `GET/POST /api/v1/teachers/`<br>`require_roles(["admin"])` | Tenant-scoped staff roster |
| **Teacher Profile & Qualifications Edit** | Admin, Teacher (Own) | Admin: Roster<br>Teacher: My Profile | `PATCH /api/v1/teachers/{id}` | Teacher can edit qualifications, bio, contact; Admin controls designation, salary, status |
| **Daily Attendance (`/dashboard/attendance`)** | Admin, Teacher, Student (Own), Guardian (Own) | Admin, Teacher: Full Sheet<br>Student, Guardian: My Attendance | `GET /api/v1/attendance/sheet`<br>`POST /api/v1/attendance/bulk` | Student/Guardian restricted to verified self/ward via `verify_student_scope` |
| **Class Timetable & Routine (`/dashboard/academic`)** | Admin, Teacher, Student, Guardian | All Roles | `GET /api/v1/academic/routine`<br>`POST /api/v1/academic/routine` (Admin only) | Read: all roles; Mutate: admin only |
| **Curriculum Knowledge Base Upload** | Admin, Teacher | Admin, Teacher | `POST /api/v1/ai/curriculum/upload`<br>`require_roles(["admin", "teacher"])` | Scoped to active tenant |
| **Exam & Question Papers (`/dashboard/exams`)** | Admin, Teacher | Admin, Teacher | `POST /api/v1/ai/generate-question-paper` | Tenant-scoped generation |
| **Fee Ledger & Payments (`/dashboard/finance`)** | Admin, Finance Officer, Student (Own Receipts), Guardian (Own Receipts) | Admin: Full Ledger<br>Student/Guardian: My Invoices | `GET /api/v1/finance/ledger`<br>`POST /api/v1/finance/collect`<br>`GET /api/v1/finance/receipts/{id}` | Read-only invoice/receipt views for student/guardian; Collect/Refund for Admin/Finance Officer |
| **Guardian Hub & Directory (`/dashboard/guardians`)** | Admin, Teacher | Admin, Teacher | `GET /api/v1/guardians/`<br>`require_roles(["admin", "teacher"])` | Directory of verified guardians |
| **Notice Composer (`/dashboard/notices`)** | Admin, Teacher, Student, Guardian | Read: All<br>Create: Admin, Teacher | `GET /api/v1/notices/`<br>`POST /api/v1/notices/` | Read: tenant notices; Post: staff only |
| **Action Center & Approvals (`/dashboard/approvals`)** | Admin | Admin Only | `GET /api/v1/approvals/`<br>`require_roles(["admin"])` | Tenant administrative tasks |
| **System Settings Modal** | Admin | Admin Only | `GET/PATCH /api/v1/institution/profile` | Restricted to tenant administrator |

---

## 3. Privilege Escalation & Defect Matrix

### DEF-RBAC-01 (Severity: HIGH)
- **Defect:** Global Header mounts `VoiceLessonModal` and `Voice Diary AI` button for all roles.
- **Affected Code:** `frontend/app/dashboard/layout.tsx:383-390, 424-427`
- **Exploit / UX Issue:** Students and Guardians see a microphone button labeled "Voice Diary AI". Clicking it opens the teacher diary modal, allowing students/guardians to attempt syncing class notes.
- **Remediation:**
  1. In `layout.tsx`, wrap the `Voice Diary AI` button in a strict role check: `{userRole === "teacher" && ( ... )}`.
  2. Guard `VoiceLessonModal` mounting to render only when `userRole === "teacher"`.
  3. In `backend/app/api/endpoints/teacher_diary.py:22`, tighten dependencies from `require_roles(["admin", "teacher"])` to `require_roles(["teacher"])`.

---

### DEF-RBAC-02 (Severity: HIGH)
- **Defect:** Incomplete Student 360 Editing & Lack of Student Self-Service Permissions.
- **Affected Code:** `backend/app/api/endpoints/students.py:248-266`, `frontend/app/dashboard/students/page.tsx:538-650`
- **Exploit / UX Issue:** Administrators cannot edit missing fields (e.g., Bengali names, emergency contact, shift, group, blood group), while students have no authorized endpoint to update contact information or photo.
- **Remediation:**
  1. Implement comprehensive `PATCH /api/v1/students/{student_id}` for administrators with `AuditLog` recording before-and-after diffs.
  2. Implement `PATCH /api/v1/students/me/profile` for students to edit whitelisted self-service fields only.
  3. Reject student attempts to edit immutable academic fields (admission number, roll, class, status) with HTTP `403`.

---

### DEF-RBAC-03 (Severity: MEDIUM)
- **Defect:** Unrestricted Teacher Self-Assignment.
- **Affected Code:** `backend/app/api/endpoints/teachers.py:119-141`
- **Exploit / UX Issue:** If a teacher obtained access to update endpoints, they could self-assign classes or promote their status.
- **Remediation:** Ensure `PATCH /api/v1/teachers/{teacher_id}` requires `admin` role for official attributes (`assigned_class`, `status`, `designation`), and provide a separate `PATCH /api/v1/teachers/me/profile` for biographical/qualification details.
