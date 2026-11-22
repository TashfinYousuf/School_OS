// frontend/lib/permissions.ts
/**
 * Canonical Role-Based Access Control (RBAC) & Permission System for EducationOS Frontend.
 * Aligns 1:1 with backend/app/core/rbac.py
 */

export const Permission = {
  // Student Operations
  STUDENTS_READ: "students.read",
  STUDENTS_CREATE: "students.create",
  STUDENTS_UPDATE: "students.update",
  STUDENTS_DELETE: "students.delete",
  STUDENTS_READ_OWN: "students.read.own",

  // Guardian Operations
  GUARDIANS_READ: "guardians.read",
  GUARDIANS_MANAGE: "guardians.manage",

  // Teacher Operations
  TEACHERS_READ: "teachers.read",
  TEACHERS_MANAGE: "teachers.manage",

  // Attendance Operations
  ATTENDANCE_READ: "attendance.read",
  ATTENDANCE_MARK: "attendance.mark",
  ATTENDANCE_UPDATE: "attendance.update",
  ATTENDANCE_READ_OWN: "attendance.read.own",

  // Academic & Timetable Operations
  ACADEMIC_READ: "academic.read",
  ACADEMIC_MANAGE: "academic.manage",

  // Examination & Assessment
  EXAMS_READ: "exams.read",
  EXAMS_MANAGE: "exams.manage",
  RESULTS_READ: "results.read",
  RESULTS_PUBLISH: "results.publish",
  RESULTS_READ_OWN: "results.read.own",

  // Notice & Institutional Communications
  NOTICES_READ: "notices.read",
  NOTICES_CREATE: "notices.create",
  NOTICES_DELETE: "notices.delete",
  COMMUNICATION_SEND: "communication.send",

  // Finance & Payment Operations
  FINANCE_SUMMARY_READ: "finance.summary.read",
  FINANCE_INVOICES_READ: "finance.invoices.read",
  FINANCE_INVOICES_CREATE: "finance.invoices.create",
  FINANCE_INVOICES_UPDATE: "finance.invoices.update",
  FINANCE_PAYMENTS_READ: "finance.payments.read",
  FINANCE_PAYMENTS_RECORD: "finance.payments.record",
  FINANCE_REFUNDS_INITIATE: "finance.refunds.initiate",
  FINANCE_REFUNDS_APPROVE: "finance.refunds.approve",
  FINANCE_REPORTS_READ: "finance.reports.read",
  FINANCE_INVOICES_READ_OWN: "finance.invoices.read.own",

  // Task & Approval Workflows
  APPROVALS_READ: "approvals.read",
  APPROVALS_MANAGE: "approvals.manage",

  // User, Role & Identity Administration
  USERS_READ: "users.read",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  WORKSPACES_MANAGE: "workspaces.manage",
  AUDIT_READ: "audit.read",

  // Platform Administration (Superadmin only)
  PLATFORM_MANAGE: "platform.manage",
} as const;

export type PermissionKey = typeof Permission[keyof typeof Permission];

export const RoleEnum = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  FINANCE_OFFICER: "finance_officer",
  ACCOUNTANT: "accountant",
  TEACHER: "teacher",
  GUARDIAN: "guardian",
  STUDENT: "student",
} as const;

export type RoleType = typeof RoleEnum[keyof typeof RoleEnum];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [RoleEnum.SUPERADMIN]: [
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
  ],
  [RoleEnum.ADMIN]: [
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
  ],
  [RoleEnum.FINANCE_OFFICER]: [
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
  ],
  [RoleEnum.ACCOUNTANT]: [
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
  ],
  [RoleEnum.TEACHER]: [
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
  ],
  [RoleEnum.GUARDIAN]: [
    Permission.STUDENTS_READ_OWN,
    Permission.ATTENDANCE_READ_OWN,
    Permission.RESULTS_READ_OWN,
    Permission.NOTICES_READ,
    Permission.FINANCE_INVOICES_READ_OWN,
  ],
  [RoleEnum.STUDENT]: [
    Permission.STUDENTS_READ_OWN,
    Permission.ATTENDANCE_READ_OWN,
    Permission.RESULTS_READ_OWN,
    Permission.NOTICES_READ,
    Permission.EXAMS_READ,
  ],
};

export function normalizeRole(role?: string | null): string {
  if (!role) return "";
  const cleaned = role.trim().toLowerCase();
  if (cleaned === "school_admin" || cleaned === "principal" || cleaned === "headmaster") {
    return RoleEnum.ADMIN;
  }
  return cleaned;
}

export function getRolePermissions(role?: string | null, customPermissions?: string[]): Set<string> {
  const normalized = normalizeRole(role);
  const base = new Set<string>(ROLE_PERMISSIONS[normalized] || []);
  if (Array.isArray(customPermissions)) {
    customPermissions.forEach((p) => base.add(p));
  }
  return base;
}

export function hasPermission(
  role?: string | null,
  permission?: string,
  customPermissions?: string[]
): boolean {
  if (!role || !permission) return false;
  const perms = getRolePermissions(role, customPermissions);
  return perms.has(permission);
}

export function hasAnyPermission(
  role?: string | null,
  permissions: string[] = [],
  customPermissions?: string[]
): boolean {
  if (!role || permissions.length === 0) return false;
  const perms = getRolePermissions(role, customPermissions);
  return permissions.some((p) => perms.has(p));
}

export function hasAllPermissions(
  role?: string | null,
  permissions: string[] = [],
  customPermissions?: string[]
): boolean {
  if (!role || permissions.length === 0) return false;
  const perms = getRolePermissions(role, customPermissions);
  return permissions.every((p) => perms.has(p));
}

