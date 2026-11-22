# backend/app/core/rbac.py
"""
Central Role-Based Access Control (RBAC) & Permission Architecture for EducationOS.
Defines:
- Granular permission constants
- Role definitions and hierarchy
- Role-to-permission mappings
- Scope boundaries (Platform, Tenant, Workspace)
- Privilege escalation guards
"""
import enum
from typing import List, Set, Optional, Dict
from fastapi import HTTPException, status


class Permission:
    """Stable, canonical permission identifiers."""
    # Student Operations
    STUDENTS_READ = "students.read"
    STUDENTS_CREATE = "students.create"
    STUDENTS_UPDATE = "students.update"
    STUDENTS_DELETE = "students.delete"
    STUDENTS_READ_OWN = "students.read.own"

    # Guardian Operations
    GUARDIANS_READ = "guardians.read"
    GUARDIANS_MANAGE = "guardians.manage"

    # Teacher Operations
    TEACHERS_READ = "teachers.read"
    TEACHERS_MANAGE = "teachers.manage"

    # Attendance Operations
    ATTENDANCE_READ = "attendance.read"
    ATTENDANCE_MARK = "attendance.mark"
    ATTENDANCE_UPDATE = "attendance.update"
    ATTENDANCE_READ_OWN = "attendance.read.own"

    # Academic & Timetable Operations
    ACADEMIC_READ = "academic.read"
    ACADEMIC_MANAGE = "academic.manage"

    # Examination & Assessment
    EXAMS_READ = "exams.read"
    EXAMS_MANAGE = "exams.manage"
    RESULTS_READ = "results.read"
    RESULTS_PUBLISH = "results.publish"
    RESULTS_READ_OWN = "results.read.own"

    # Notice & Institutional Communications
    NOTICES_READ = "notices.read"
    NOTICES_CREATE = "notices.create"
    NOTICES_DELETE = "notices.delete"
    COMMUNICATION_SEND = "communication.send"

    # Finance & Payment Operations
    FINANCE_SUMMARY_READ = "finance.summary.read"
    FINANCE_INVOICES_READ = "finance.invoices.read"
    FINANCE_INVOICES_CREATE = "finance.invoices.create"
    FINANCE_INVOICES_UPDATE = "finance.invoices.update"
    FINANCE_PAYMENTS_READ = "finance.payments.read"
    FINANCE_PAYMENTS_RECORD = "finance.payments.record"
    FINANCE_REFUNDS_INITIATE = "finance.refunds.initiate"
    FINANCE_REFUNDS_APPROVE = "finance.refunds.approve"
    FINANCE_REPORTS_READ = "finance.reports.read"
    FINANCE_INVOICES_READ_OWN = "finance.invoices.read.own"

    # Task & Approval Workflows
    APPROVALS_READ = "approvals.read"
    APPROVALS_MANAGE = "approvals.manage"

    # User, Role & Identity Administration
    USERS_READ = "users.read"
    USERS_MANAGE = "users.manage"
    ROLES_MANAGE = "roles.manage"
    WORKSPACES_MANAGE = "workspaces.manage"
    AUDIT_READ = "audit.read"

    # Platform Administration (Superadmin only)
    PLATFORM_MANAGE = "platform.manage"


class RoleEnum(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    FINANCE_OFFICER = "finance_officer"
    ACCOUNTANT = "accountant"
    TEACHER = "teacher"
    GUARDIAN = "guardian"
    STUDENT = "student"


# Role-to-Permissions Canonical Matrix
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    RoleEnum.SUPERADMIN.value: {
        # Superadmin possesses platform administration and tenant visibility
        Permission.PLATFORM_MANAGE,
        Permission.AUDIT_READ,
        Permission.ROLES_MANAGE,
        Permission.USERS_READ,
        Permission.USERS_MANAGE,
        Permission.WORKSPACES_MANAGE,
        Permission.STUDENTS_READ,
        Permission.TEACHERS_READ,
        Permission.GUARDIANS_READ,
        Permission.FINANCE_SUMMARY_READ,
        Permission.FINANCE_REPORTS_READ,
        Permission.NOTICES_READ,
    },
    RoleEnum.ADMIN.value: {
        # Institution Admin possesses full operational authority within tenant
        Permission.STUDENTS_READ,
        Permission.STUDENTS_CREATE,
        Permission.STUDENTS_UPDATE,
        Permission.STUDENTS_DELETE,
        Permission.GUARDIANS_READ,
        Permission.GUARDIANS_MANAGE,
        Permission.TEACHERS_READ,
        Permission.TEACHERS_MANAGE,
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_MARK,
        Permission.ATTENDANCE_UPDATE,
        Permission.ACADEMIC_READ,
        Permission.ACADEMIC_MANAGE,
        Permission.EXAMS_READ,
        Permission.EXAMS_MANAGE,
        Permission.RESULTS_READ,
        Permission.RESULTS_PUBLISH,
        Permission.NOTICES_READ,
        Permission.NOTICES_CREATE,
        Permission.NOTICES_DELETE,
        Permission.COMMUNICATION_SEND,
        Permission.FINANCE_SUMMARY_READ,
        Permission.FINANCE_INVOICES_READ,
        Permission.FINANCE_INVOICES_CREATE,
        Permission.FINANCE_INVOICES_UPDATE,
        Permission.FINANCE_PAYMENTS_READ,
        Permission.FINANCE_PAYMENTS_RECORD,
        Permission.FINANCE_REFUNDS_INITIATE,
        Permission.FINANCE_REFUNDS_APPROVE,
        Permission.FINANCE_REPORTS_READ,
        Permission.APPROVALS_READ,
        Permission.APPROVALS_MANAGE,
        Permission.USERS_READ,
        Permission.USERS_MANAGE,
        Permission.ROLES_MANAGE,
        Permission.WORKSPACES_MANAGE,
        Permission.AUDIT_READ,
    },
    RoleEnum.FINANCE_OFFICER.value: {
        # Financial ledger, collection, invoices, reports, and initiation
        Permission.STUDENTS_READ,
        Permission.GUARDIANS_READ,
        Permission.FINANCE_SUMMARY_READ,
        Permission.FINANCE_INVOICES_READ,
        Permission.FINANCE_INVOICES_CREATE,
        Permission.FINANCE_INVOICES_UPDATE,
        Permission.FINANCE_PAYMENTS_READ,
        Permission.FINANCE_PAYMENTS_RECORD,
        Permission.FINANCE_REFUNDS_INITIATE,
        # Note: FINANCE_REFUNDS_APPROVE is intentionally withheld (separation of duties)
        Permission.FINANCE_REPORTS_READ,
        Permission.NOTICES_READ,
        Permission.AUDIT_READ,
    },
    RoleEnum.ACCOUNTANT.value: {
        # Alias for finance_officer with identical permissions
        Permission.STUDENTS_READ,
        Permission.GUARDIANS_READ,
        Permission.FINANCE_SUMMARY_READ,
        Permission.FINANCE_INVOICES_READ,
        Permission.FINANCE_INVOICES_CREATE,
        Permission.FINANCE_INVOICES_UPDATE,
        Permission.FINANCE_PAYMENTS_READ,
        Permission.FINANCE_PAYMENTS_RECORD,
        Permission.FINANCE_REFUNDS_INITIATE,
        Permission.FINANCE_REPORTS_READ,
        Permission.NOTICES_READ,
        Permission.AUDIT_READ,
    },
    RoleEnum.TEACHER.value: {
        # Academic, classroom, attendance, notices, results, communications
        Permission.STUDENTS_READ,
        Permission.GUARDIANS_READ,
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_MARK,
        Permission.ATTENDANCE_UPDATE,
        Permission.ACADEMIC_READ,
        Permission.ACADEMIC_MANAGE,
        Permission.EXAMS_READ,
        Permission.EXAMS_MANAGE,
        Permission.RESULTS_READ,
        Permission.RESULTS_PUBLISH,
        Permission.NOTICES_READ,
        Permission.NOTICES_CREATE,
        Permission.COMMUNICATION_SEND,
        # Teachers cannot access general finance or user management
    },
    RoleEnum.GUARDIAN.value: {
        # Strictly scoped to their linked student(s)
        Permission.STUDENTS_READ_OWN,
        Permission.ATTENDANCE_READ_OWN,
        Permission.RESULTS_READ_OWN,
        Permission.NOTICES_READ,
        Permission.FINANCE_INVOICES_READ_OWN,
    },
    RoleEnum.STUDENT.value: {
        # Strictly scoped to their own academic profile
        Permission.STUDENTS_READ_OWN,
        Permission.ATTENDANCE_READ_OWN,
        Permission.RESULTS_READ_OWN,
        Permission.NOTICES_READ,
        Permission.EXAMS_READ,
    },
}


def normalize_role(role: str) -> str:
    """Normalizes role strings (case-insensitive, strip whitespace)."""
    if not role:
        return ""
    clean = role.strip().lower()
    if clean == "accountant":
        return RoleEnum.FINANCE_OFFICER.value
    return clean


def get_role_permissions(role: str) -> Set[str]:
    """Retrieves the default set of permissions for a normalized role."""
    clean_role = normalize_role(role)
    return set(ROLE_PERMISSIONS.get(clean_role, set()))


def has_permission(
    user_role: str,
    required_permission: str,
    custom_permissions: Optional[List[str]] = None
) -> bool:
    """
    Checks if a user's role or explicit permission list grants the required permission.
    """
    clean_role = normalize_role(user_role)
    perms = get_role_permissions(clean_role)
    if custom_permissions:
        perms.update(custom_permissions)
    return required_permission in perms


def has_all_permissions(
    user_role: str,
    required_permissions: List[str],
    custom_permissions: Optional[List[str]] = None
) -> bool:
    """Verifies that all specified permissions are satisfied."""
    clean_role = normalize_role(user_role)
    perms = get_role_permissions(clean_role)
    if custom_permissions:
        perms.update(custom_permissions)
    return all(p in perms for p in required_permissions)


def has_any_permission(
    user_role: str,
    required_permissions: List[str],
    custom_permissions: Optional[List[str]] = None
) -> bool:
    """Verifies that at least one of the specified permissions is satisfied."""
    clean_role = normalize_role(user_role)
    perms = get_role_permissions(clean_role)
    if custom_permissions:
        perms.update(custom_permissions)
    return any(p in perms for p in required_permissions)


# ----------------------------------------------------------------------------------------
# Privilege Escalation & Role Assignment Policy Guard
# ----------------------------------------------------------------------------------------
ALLOWED_TENANT_ASSIGNABLE_ROLES = {
    RoleEnum.ADMIN.value,
    RoleEnum.FINANCE_OFFICER.value,
    RoleEnum.ACCOUNTANT.value,
    RoleEnum.TEACHER.value,
    RoleEnum.GUARDIAN.value,
    RoleEnum.STUDENT.value,
}


def validate_role_assignment(
    actor_role: str,
    target_role: str,
    actor_user_id: str,
    target_user_id: str
) -> None:
    """
    Strict server-side validation preventing privilege escalation during role assignment:
    1. An actor cannot change their own role (self-escalation / self-demotion lockout).
    2. A tenant administrator cannot assign the platform-level 'superadmin' role.
    3. Actors without 'users.manage' or 'roles.manage' permissions cannot assign roles.
    4. Only superadmins can assign or modify the 'superadmin' role.
    """
    clean_actor = normalize_role(actor_role)
    clean_target = normalize_role(target_role)

    # 1. Prevent self-escalation
    if str(actor_user_id).strip() == str(target_user_id).strip():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Policy Violation: Self-modification of administrative roles is forbidden."
        )

    # 2. Check actor authority
    if not has_permission(clean_actor, Permission.USERS_MANAGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Policy Violation: Insufficient permissions to assign roles."
        )

    # 3. Prevent non-superadmins from granting platform-level privileges
    if clean_target == RoleEnum.SUPERADMIN.value and clean_actor != RoleEnum.SUPERADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Security Policy Violation: Tenant administrators cannot assign platform superadmin privileges."
        )

    # 4. Target role must be recognized
    if clean_target not in ALLOWED_TENANT_ASSIGNABLE_ROLES and clean_target != RoleEnum.SUPERADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target role: '{target_role}'."
        )

