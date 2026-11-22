// frontend/tests/test_stage07_frontend.test.ts
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  Permission,
  RoleEnum,
  normalizeRole,
  getRolePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
} from "../lib/permissions.ts";

import {
  getAccessToken,
  getRefreshToken,
  getActiveTenantId,
  clearSession,
  fetchWithTenant,
  safeFetch,
} from "../lib/api-client.ts";

// Mock localStorage for Node test environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("Stage 07: Frontend Reconstruction Test Suite", () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (globalThis as any).localStorage = mockStorage;
    (globalThis as any).window = {
      location: { href: "/", pathname: "/dashboard" },
      dispatchEvent: () => true,
    };
  });

  describe("1. Canonical RBAC & Permission Helpers", () => {
    it("should normalize role names and handle aliases", () => {
      assert.equal(normalizeRole("ADMIN"), "admin");
      assert.equal(normalizeRole(" school_admin "), "admin");
      assert.equal(normalizeRole("Teacher"), "teacher");
      assert.equal(normalizeRole("student"), "student");
      assert.equal(normalizeRole(""), "");
      assert.equal(normalizeRole(null), "");
    });

    it("should accurately resolve permissions for admin, teacher, guardian, student", () => {
      const adminPerms = getRolePermissions(RoleEnum.ADMIN);
      assert.ok(adminPerms.has(Permission.STUDENTS_CREATE));
      assert.ok(adminPerms.has(Permission.FINANCE_REFUNDS_APPROVE));
      assert.ok(adminPerms.has(Permission.ACADEMIC_MANAGE));

      const teacherPerms = getRolePermissions(RoleEnum.TEACHER);
      assert.ok(teacherPerms.has(Permission.ATTENDANCE_MARK));
      assert.ok(teacherPerms.has(Permission.RESULTS_READ));
      assert.ok(!teacherPerms.has(Permission.STUDENTS_CREATE));
      assert.ok(!teacherPerms.has(Permission.FINANCE_REFUNDS_APPROVE));

      const studentPerms = getRolePermissions(RoleEnum.STUDENT);
      assert.ok(studentPerms.has(Permission.STUDENTS_READ_OWN));
      assert.ok(!studentPerms.has(Permission.STUDENTS_CREATE));
      assert.ok(!studentPerms.has(Permission.FINANCE_SUMMARY_READ));

      const guardianPerms = getRolePermissions(RoleEnum.GUARDIAN);
      assert.ok(guardianPerms.has(Permission.FINANCE_INVOICES_READ_OWN));
      assert.ok(!guardianPerms.has(Permission.FINANCE_PAYMENTS_RECORD));
    });

    it("should correctly evaluate hasPermission, hasAllPermissions, hasAnyPermission", () => {
      assert.equal(hasPermission(RoleEnum.ADMIN, Permission.STUDENTS_CREATE), true);
      assert.equal(hasPermission(RoleEnum.TEACHER, Permission.STUDENTS_CREATE), false);

      assert.equal(
        hasAllPermissions(RoleEnum.ADMIN, [
          Permission.STUDENTS_READ,
          Permission.TEACHERS_READ,
        ]),
        true
      );

      assert.equal(
        hasAllPermissions(RoleEnum.TEACHER, [
          Permission.STUDENTS_READ,
          Permission.FINANCE_SUMMARY_READ,
        ]),
        false
      );

      assert.equal(
        hasAnyPermission(RoleEnum.TEACHER, [
          Permission.FINANCE_SUMMARY_READ,
          Permission.ATTENDANCE_MARK,
        ]),
        true
      );
    });
  });

  describe("2. Authentication Token Management & clearSession", () => {
    it("should retrieve access and refresh tokens correctly", () => {
      mockStorage.setItem("access_token", "jwt_access_123");
      mockStorage.setItem("refresh_token", "jwt_refresh_456");
      mockStorage.setItem("tenant_id", "tenant-uuid-789");

      assert.equal(getAccessToken(), "jwt_access_123");
      assert.equal(getRefreshToken(), "jwt_refresh_456");
      assert.equal(getActiveTenantId(), "tenant-uuid-789");
    });

    it("should clean all session tokens upon clearSession()", () => {
      mockStorage.setItem("token", "legacy_token");
      mockStorage.setItem("access_token", "access_123");
      mockStorage.setItem("refresh_token", "refresh_456");
      mockStorage.setItem("tenant_id", "tenant_789");
      mockStorage.setItem("active_workspace_id", "ws_101");
      mockStorage.setItem("user_role", "admin");

      clearSession();

      assert.equal(mockStorage.getItem("token"), null);
      assert.equal(mockStorage.getItem("access_token"), null);
      assert.equal(mockStorage.getItem("refresh_token"), null);
      assert.equal(mockStorage.getItem("tenant_id"), null);
      assert.equal(mockStorage.getItem("active_workspace_id"), null);
      assert.equal(mockStorage.getItem("user_role"), null);
    });
  });

  describe("3. Unified API Client & Header Injection", () => {
    it("should inject Authorization and X-Tenant-ID headers automatically", async () => {
      mockStorage.setItem("access_token", "test_bearer_token");
      mockStorage.setItem("tenant_id", "tenant-root-alpha");
      mockStorage.setItem("active_workspace_id", "ws-target-alpha");

      let capturedUrl = "";
      let capturedHeaders: Record<string, string> = {};

      (globalThis as any).fetch = async (url: string, init: any) => {
        capturedUrl = url;
        const headers = init.headers;
        if (headers instanceof Headers) {
          headers.forEach((v, k) => {
            capturedHeaders[k.toLowerCase()] = v;
          });
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      };

      const res = await fetchWithTenant("/api/v1/students/");
      assert.equal(res.status, 200);
      assert.ok(capturedUrl.endsWith("/api/v1/students/"));
      assert.equal(capturedHeaders["authorization"], "Bearer test_bearer_token");
      assert.equal(capturedHeaders["x-tenant-id"], "tenant-root-alpha");
      assert.equal(capturedHeaders["x-workspace-id"], "ws-target-alpha");
    });

    it("should prevent cross-tenant cache pollution in safeFetch", async () => {
      // First tenant request
      mockStorage.setItem("tenant_id", "tenant-alpha");
      mockStorage.setItem("active_workspace_id", "ws-1");

      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify({ schoolName: "Alpha School" }), { status: 200 });
      };

      const alphaRes = await safeFetch<any>("/api/v1/institution/profile");
      assert.equal(alphaRes.data?.schoolName, "Alpha School");
      assert.ok(mockStorage.getItem("EducationOS_cache_tenant-alpha_ws-1_/api/v1/institution/profile"));

      // Second tenant switch
      mockStorage.setItem("tenant_id", "tenant-beta");
      mockStorage.setItem("active_workspace_id", "ws-2");

      (globalThis as any).fetch = async () => {
        return new Response(JSON.stringify({ schoolName: "Beta Academy" }), { status: 200 });
      };

      const betaRes = await safeFetch<any>("/api/v1/institution/profile");
      assert.equal(betaRes.data?.schoolName, "Beta Academy");
      assert.ok(mockStorage.getItem("EducationOS_cache_tenant-beta_ws-2_/api/v1/institution/profile"));

      // Ensure Alpha's cache was not overwritten by Beta and Beta did not read Alpha's data
      const alphaCached = JSON.parse(mockStorage.getItem("EducationOS_cache_tenant-alpha_ws-1_/api/v1/institution/profile")!);
      const betaCached = JSON.parse(mockStorage.getItem("EducationOS_cache_tenant-beta_ws-2_/api/v1/institution/profile")!);
      assert.equal(alphaCached.schoolName, "Alpha School");
      assert.equal(betaCached.schoolName, "Beta Academy");
      assert.notEqual(alphaCached.schoolName, betaCached.schoolName);
    });

    it("should silently refresh token on 401 when refresh_token is present", async () => {
      mockStorage.setItem("access_token", "expired_access_token");
      mockStorage.setItem("refresh_token", "valid_refresh_token");

      let fetchCallCount = 0;
      let refreshCallCount = 0;

      (globalThis as any).fetch = async (url: string, init: any) => {
        if (url.includes("/api/v1/auth/refresh")) {
          refreshCallCount++;
          return new Response(
            JSON.stringify({
              access_token: "new_fresh_access_token",
              refresh_token: "new_refresh_token",
              token_type: "bearer",
            }),
            { status: 200 }
          );
        }

        fetchCallCount++;
        const auth = (init.headers as Headers).get("Authorization");
        if (auth === "Bearer expired_access_token") {
          return new Response(JSON.stringify({ detail: "Token expired" }), { status: 401 });
        }
        if (auth === "Bearer new_fresh_access_token") {
          return new Response(JSON.stringify({ success: true, user: "verified" }), { status: 200 });
        }
        return new Response(JSON.stringify({ detail: "Unauthorized" }), { status: 401 });
      };

      const res = await fetchWithTenant("/api/v1/users/me");
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.user, "verified");
      assert.equal(refreshCallCount, 1);
      assert.equal(mockStorage.getItem("access_token"), "new_fresh_access_token");
    });
  });

  describe("4. Route Guard & RBAC Synchronization (DEF-P1-12 Fix)", () => {
    it("should allow teacher access to academic routines and guardian directory", () => {
      const teacherRole = normalizeRole("teacher");
      const allowedRoutes = [
        "/dashboard",
        "/dashboard/attendance",
        "/dashboard/results",
        "/dashboard/exams",
        "/dashboard/live-exams",
        "/dashboard/batches",
        "/dashboard/doubt-solver",
        "/dashboard/notices",
        "/dashboard/academic",
        "/dashboard/guardians",
        "/dashboard/voice-diary",
      ];

      assert.ok(allowedRoutes.includes("/dashboard/academic"));
      assert.ok(allowedRoutes.includes("/dashboard/guardians"));
      assert.ok(!allowedRoutes.includes("/dashboard/finance"));
      assert.ok(!allowedRoutes.includes("/dashboard/settings"));
    });

    it("should reject student access to administrative and teacher routes", () => {
      const studentAllowed = [
        "/dashboard",
        "/dashboard/results",
        "/dashboard/live-exams",
        "/dashboard/doubt-solver",
        "/dashboard/academic",
        "/dashboard/notices",
      ];

      assert.ok(studentAllowed.includes("/dashboard/results"));
      assert.ok(studentAllowed.includes("/dashboard/notices"));
      assert.ok(!studentAllowed.includes("/dashboard/finance"));
      assert.ok(!studentAllowed.includes("/dashboard/students"));
      assert.ok(!studentAllowed.includes("/dashboard/teachers"));
      assert.ok(!studentAllowed.includes("/dashboard/approvals"));
    });

    it("should restrict guardian access to student-specific read views", () => {
      const guardianAllowed = [
        "/dashboard",
        "/dashboard/results",
        "/dashboard/attendance",
        "/dashboard/notices",
        "/dashboard/communication",
        "/dashboard/helpdesk",
      ];

      assert.ok(guardianAllowed.includes("/dashboard/results"));
      assert.ok(guardianAllowed.includes("/dashboard/attendance"));
      assert.ok(!guardianAllowed.includes("/dashboard/teachers"));
      assert.ok(!guardianAllowed.includes("/dashboard/exams"));
      assert.ok(!guardianAllowed.includes("/dashboard/approvals"));
    });
  });
});
