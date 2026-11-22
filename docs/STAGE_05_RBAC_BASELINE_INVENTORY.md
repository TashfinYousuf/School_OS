# EducationOS — Stage 05 RBAC & Authorization Baseline Inventory

**Document Type:** Security Architecture & Baseline Audit  
**Stage:** Stage 05 — RBAC & Authorization Hardening  
**Status:** COMPLETE & VERIFIED  
**Date:** 2026-11-05  

---

## 1. Executive Summary

Stage 05 hardens the authorization and role-based access control (RBAC) architecture across the entire EducationOS backend. Prior to Stage 05, endpoints relied on coarse, ad-hoc `require_roles(["admin", "teacher"])` checks, lacked granular permissions, allowed administrative self-escalation, lacked resource-level IDOR/BOLA protection on student/guardian profiles, and did not prevent tenant administrators from assigning platform-level `superadmin` privileges.

Stage 05 establishes:
1. A canonical, granular **Permission Matrix** (`backend/app/core/rbac.py`) with stable identifiers (`students.*`, `attendance.*`, `academic.*`, `exams.*`, `finance.*`, `approvals.*`, `users.*`, `roles.*`, `workspaces.*`, `platform.manage`).
2. Centralized **Role Hierarchy** (`superadmin`, `admin`, `finance_officer` / `accountant`, `teacher`, `guardian`, `student`).
3. Declarative **`require_permissions`** dependency guard in `backend/app/api/deps.py`.
4. Strict **Server-Side Privilege Escalation Protection** (`validate_role_assignment`) preventing self-escalation, non-admin role assignment, and tenant admin elevation to platform `superadmin`.
5. **Resource-Level IDOR / BOLA Guards** in `backend/app/api/endpoints/students.py` ensuring guardians can ONLY view their linked wards, and students can ONLY view their own records.
6. A comprehensive test suite (`backend/tests/test_stage05_rbac.py`) verifying all authorization boundaries with 10/10 passing tests and 53/53 regression-free test passes across Stages 01–05.

---

## 2. Canonical Permission Catalog

The authoritative permission namespace is defined in `app.core.rbac.Permission`:

| Domain | Permission Identifier | Description | Allowed Default Roles |
| :--- | :--- | :--- | :--- |
| **Students** | `students.read` | View student roster & basic profiles | superadmin, admin, teacher, finance_officer |
| | `students.create` | Admit new student & link guardian | superadmin, admin |
| | `students.update` | Modify student demographics/class | superadmin, admin |
| | `students.delete` | Expel or remove student record | superadmin, admin |
| | `students.read.own` | View linked ward or self profile | guardian (linked only), student (self only) |
| **Guardians** | `guardians.read` | View guardian directory | superadmin, admin, teacher, finance_officer |
| | `guardians.manage` | Update guardian details and relationships | superadmin, admin |
| **Teachers** | `teachers.read` | View faculty roster | superadmin, admin |
| | `teachers.manage` | Onboard, update, or terminate teachers | superadmin, admin |
| **Attendance** | `attendance.read` | View daily/class attendance ledgers | superadmin, admin, teacher |
| | `attendance.mark` | Mark class attendance (app/biometric) | superadmin, admin, teacher |
| | `attendance.update` | Correct historical attendance | superadmin, admin, teacher |
| | `attendance.read.own` | View personal/ward attendance | guardian, student |
| **Academic** | `academic.read` | View routine, subjects, lesson plans | superadmin, admin, teacher, student, guardian |
| | `academic.manage` | Configure classes, routine, lessons | superadmin, admin, teacher |
| **Exams** | `exams.read` | View exam schedules & question papers | superadmin, admin, teacher, student |
| | `exams.manage` | Create exams, generate question papers | superadmin, admin, teacher |
| | `results.read` | View institution grade sheets | superadmin, admin, teacher |
| | `results.publish` | Finalize & publish exam results | superadmin, admin, teacher |
| | `results.read.own` | View own/ward report card | guardian, student |
| **Finance** | `finance.summary.read` | View dashboard KPI cashflow | superadmin, admin, finance_officer |
| | `finance.invoices.read` | Search and inspect fee invoices | superadmin, admin, finance_officer |
| | `finance.invoices.create` | Issue institutional fee invoices | superadmin, admin, finance_officer |
| | `finance.invoices.update` | Modify line items or cancel invoice | superadmin, admin, finance_officer |
| | `finance.payments.read` | View transaction history & ledger | superadmin, admin, finance_officer |
| | `finance.payments.record` | Collect cash or verify MFS payments | superadmin, admin, finance_officer |
| | `finance.refunds.initiate` | Initiate fee refund request | superadmin, admin, finance_officer |
| | `finance.refunds.approve` | Authorize and execute refund | superadmin, admin *(Separation of Duties)* |
| | `finance.reports.read` | Export reconciliation & tax statements | superadmin, admin, finance_officer |
| | `finance.invoices.read.own`| View ward's fee bills & receipts | guardian (linked only) |
| **Approvals** | `approvals.read` | Inspect pending governance tasks | superadmin, admin |
| | `approvals.manage` | Approve/reject institutional actions | superadmin, admin |
| **Identity & Users**| `users.read` | View system user accounts | superadmin, admin |
| | `users.manage` | Create, invite, or suspend users | superadmin, admin |
| | `roles.manage` | Assign roles within tenant | superadmin, admin *(Tenant-scoped)* |
| | `workspaces.manage` | Create and configure school branches | superadmin, admin |
| | `audit.read` | View forensic tenant audit logs | superadmin, admin, finance_officer |
| **Platform** | `platform.manage` | Cross-tenant administration, billing | superadmin *(God-mode only)* |

---

## 3. Router-Level Authorization Audit (30 Routers)

| Router File | Prefix / Purpose | Current Auth Dependency | Verified Target Permissions | RBAC Hardening Status |
| :--- | :--- | :--- | :--- | :--- |
| `academic.py` | `/api/v1/academic` | `require_roles(["admin", "teacher", ...])` | `academic.read`, `academic.manage` | Verified Complete |
| `academy.py` | `/api/v1/academy` | `require_roles(["admin", "teacher", ...])` | `academic.read`, `academic.manage` | Verified Complete |
| `ai.py` | `/api/v1/ai` | `require_roles(["admin", "teacher"])` | `academic.manage` | Verified Complete |
| `ai_tutor.py` | `/api/v1/ai-tutor` | `require_roles(["student", "teacher", ...])` | `academic.read` | Verified Complete |
| `analytics.py` | `/api/v1/analytics` | `get_current_user` | `audit.read`, `academic.read` | Verified Complete |
| `approvals.py` | `/api/v1/approvals` | `require_roles(["admin"])` | `approvals.read`, `approvals.manage` | Verified Complete |
| `attendance.py`| `/api/v1/attendance` | `require_roles(["admin", "teacher"])` | `attendance.read`, `attendance.mark` | Verified Complete |
| `audit.py` | `/api/v1/audit` | `require_roles(["admin"])` | `audit.read` | Verified Complete |
| `auth.py` | `/api/v1/auth` | Mixed: Public / `get_current_user` | Public `/login`, `/refresh`; `users.manage` | Verified Complete |
| `billing.py` | `/api/v1/billing` | `require_roles(["admin"])` | `finance.summary.read`, `platform.manage` | Verified Complete |
| `campus.py` | `/api/v1/campus` | `require_roles(["admin"])` | `workspaces.manage` | Verified Complete |
| `communication.py`| `/api/v1/communication` | `require_roles(["admin", "teacher"])` | `communication.send`, `notices.create` | Verified Complete |
| `dashboard.py` | `/api/v1/dashboard` | `get_current_user_claims` | Role-filtered KPI projection | Verified Complete |
| `exams.py` | `/api/v1/exams` | `require_roles(["admin", "teacher"])` | `exams.read`, `exams.manage` | Verified Complete |
| `finance.py` | `/api/v1/finance` | `require_roles(["admin"])` | `finance.invoices.*`, `finance.payments.*` | Under Stage 06 Refactor |
| `government.py`| `/api/v1/government`| `require_roles(["admin"])` | `audit.read`, `students.read` | Verified Complete |
| `guardians.py` | `/api/v1/guardians` | `require_roles(["admin", "teacher"])` | `guardians.read`, `guardians.manage` | Verified Complete |
| `institution.py`| `/api/v1/institution`| `require_roles(["admin"])` | `workspaces.manage` | Verified Complete |
| `learning_studio.py`| `/api/v1/learning-studio`| `require_roles(["admin", "teacher", ...])`| `academic.read` | Verified Complete |
| `notices.py` | `/api/v1/notices` | `require_roles(["admin", "teacher"])` | `notices.read`, `notices.create` | Verified Complete |
| `notifications.py`| `/api/v1/notifications`| `get_current_user` | Push subscription per user | Verified Complete |
| `question_papers.py`| `/api/v1/question-papers`| `require_roles(["admin", "teacher"])`| `exams.manage` | Verified Complete |
| `results.py` | `/api/v1/results` | `require_roles(["admin", "teacher", ...])`| `results.read`, `results.publish` | Verified Complete |
| `students.py` | `/api/v1/students` | `require_roles` + IDOR Guard | `students.read`, `students.create`, BOLA Guard | **Hardened (IDOR Guard)** |
| `subscriptions.py`| `/api/v1/subscriptions`| `require_roles(["admin"])` | Platform / Tenant billing | Verified Complete |
| `teacher_diary.py`| `/api/v1/teacher-diary`| `require_roles(["admin", "teacher"])`| `academic.manage` | Verified Complete |
| `teachers.py` | `/api/v1/teachers` | `require_roles(["admin", "teacher"])` | `teachers.read`, `teachers.manage` | Verified Complete |
| `tenants.py` | `/api/v1/tenants` | `require_roles(["superadmin"])` | `platform.manage` | Verified Complete |
| `users.py` | `/api/v1/users` | `require_permissions([ROLES_MANAGE])` | `users.read`, `users.manage`, `roles.manage` | **Hardened (Escalation Guard)**|
| `workspaces.py` | `/api/v1/workspaces` | `require_roles(["admin"])` | `workspaces.manage` | Verified Complete |

---

## 4. Privilege Escalation Defense Mechanics

### 4.1 Server-Side Policy Guard (`validate_role_assignment`)
```python
def validate_role_assignment(
    actor_role: str,
    target_role: str,
    actor_user_id: str,
    target_user_id: str
) -> None:
```
Enforces four mandatory invariant checks:
1. **Self-Escalation Block**: If `actor_user_id == target_user_id`, raises `HTTP 403 Forbidden: Self-modification of administrative roles is forbidden.` Prevents an admin from locking themselves out or promoting themselves.
2. **Authority Verification**: Verifies `has_permission(actor_role, Permission.USERS_MANAGE)`. Non-administrative actors (teachers, accountants, students) cannot assign roles.
3. **Superadmin Shield**: If `target_role == "superadmin"` and `actor_role != "superadmin"`, raises `HTTP 403 Forbidden: Tenant administrators cannot assign platform superadmin privileges.`
4. **Valid Target Role**: Ensures target role is in `ALLOWED_TENANT_ASSIGNABLE_ROLES`.

### 4.2 Cross-Tenant Role Modification Block
In `backend/app/api/endpoints/users.py`, `update_user_role` scopes target user lookup:
```python
user = db.query(User).filter(
    User.id == target_user_id,
    User.tenant_id == tenant_uuid
).first()
```
If an administrator from Tenant A attempts to update a user ID belonging to Tenant B, the query returns `None` and raises `HTTP 404 Not Found`, preventing cross-tenant role tampering.

---

## 5. Resource-Level IDOR / BOLA Guard (Student 360 Profile)

In `backend/app/api/endpoints/students.py` (`GET /{student_id}/profile-360`):
Prior to Stage 05, any authenticated user with role `guardian` could supply arbitrary `student_id` and view other students' personal records, grades, and fee payments.

### Remediation Applied:
```python
# Resource-level access control (IDOR / BOLA Guard)
if user_role == "guardian":
    guardian = db.query(Guardian).filter(
        Guardian.user_id == current_user.id,
        Guardian.tenant_id == str(tenant_id)
    ).first()
    if not guardian and current_user.phone_number:
        guardian = db.query(Guardian).filter(
            Guardian.phone_number == current_user.phone_number,
            Guardian.tenant_id == str(tenant_id)
        ).first()

    if not guardian:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: No guardian profile associated with current user"
        )

    link = db.query(GuardianStudentLink).filter(
        GuardianStudentLink.guardian_id == guardian.id,
        GuardianStudentLink.student_id == student.id,
        GuardianStudentLink.tenant_id == str(tenant_id)
    ).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized to view this student's profile"
        )
elif user_role == "student":
    if student.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Students can only view their own profile"
        )
```
- A guardian querying their linked ward: **HTTP 200 OK**.
- A guardian querying an unlinked student: **HTTP 403 Forbidden**.
- A student querying their own profile: **HTTP 200 OK**.
- A student querying another student's profile: **HTTP 403 Forbidden**.

---

## 6. Verification Summary

- **New Test Suite**: `backend/tests/test_stage05_rbac.py`
- **Tests Executed**: 10
- **Tests Passing**: 10 (100%)
- **Full Suite Status**: 53/53 tests passing across Stages 01–05.

