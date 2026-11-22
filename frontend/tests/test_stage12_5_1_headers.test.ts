import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveTenantId,
  getActiveWorkspaceId,
  fetchWithTenant,
  clearSession,
} from "../lib/api-client.ts";

describe("Stage 12.5.1: Tenant vs Workspace Header Decoupling Suite", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = String(value);
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
      get length() {
        return Object.keys(mockStorage).length;
      },
      key: (i: number) => Object.keys(mockStorage)[i] || null,
    };
    (globalThis as any).window = {
      dispatchEvent: () => {},
    };
  });

  it("1. getActiveTenantId strictly returns tenant_id and ignores active_workspace_id", () => {
    mockStorage["tenant_id"] = "11111111-1111-1111-1111-111111111111";
    mockStorage["active_workspace_id"] = "1a000000-0000-0000-0000-000000000001";

    assert.equal(getActiveTenantId(), "11111111-1111-1111-1111-111111111111");
  });

  it("2. getActiveTenantId returns null if tenant_id is absent, even if active_workspace_id is present", () => {
    mockStorage["active_workspace_id"] = "1a000000-0000-0000-0000-000000000001";

    assert.equal(getActiveTenantId(), null);
  });

  it("3. getActiveWorkspaceId strictly returns active_workspace_id", () => {
    mockStorage["active_workspace_id"] = "1a000000-0000-0000-0000-000000000001";
    assert.equal(getActiveWorkspaceId(), "1a000000-0000-0000-0000-000000000001");
  });

  it("4. fetchWithTenant sends both X-Tenant-ID and X-Workspace-ID when both exist", async () => {
    mockStorage["access_token"] = "valid_jwt_token";
    mockStorage["tenant_id"] = "tenant-institution-root";
    mockStorage["active_workspace_id"] = "workspace-campus-primary";

    let capturedHeaders: Record<string, string> = {};
    (globalThis as any).fetch = async (_url: string, init: any) => {
      const headers = init.headers;
      if (headers instanceof Headers) {
        headers.forEach((v, k) => {
          capturedHeaders[k.toLowerCase()] = v;
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await fetchWithTenant("/api/v1/academic/grades");
    assert.equal(capturedHeaders["authorization"], "Bearer valid_jwt_token");
    assert.equal(capturedHeaders["x-tenant-id"], "tenant-institution-root");
    assert.equal(capturedHeaders["x-workspace-id"], "workspace-campus-primary");
  });

  it("5. fetchWithTenant sends only X-Tenant-ID when active_workspace_id is unset", async () => {
    mockStorage["access_token"] = "valid_jwt_token";
    mockStorage["tenant_id"] = "tenant-institution-root";

    let capturedHeaders: Record<string, string> = {};
    (globalThis as any).fetch = async (_url: string, init: any) => {
      const headers = init.headers;
      if (headers instanceof Headers) {
        headers.forEach((v, k) => {
          capturedHeaders[k.toLowerCase()] = v;
        });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await fetchWithTenant("/api/v1/billing/subscription");
    assert.equal(capturedHeaders["x-tenant-id"], "tenant-institution-root");
    assert.equal(capturedHeaders["x-workspace-id"], undefined);
  });

  it("6. switching workspaces updates X-Workspace-ID while keeping X-Tenant-ID constant", async () => {
    mockStorage["tenant_id"] = "tenant-institution-root";
    mockStorage["active_workspace_id"] = "workspace-campus-primary";

    let capturedHeadersList: Record<string, string>[] = [];
    (globalThis as any).fetch = async (_url: string, init: any) => {
      const hdrs: Record<string, string> = {};
      init.headers.forEach((v: string, k: string) => {
        hdrs[k.toLowerCase()] = v;
      });
      capturedHeadersList.push(hdrs);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    await fetchWithTenant("/api/v1/attendance");
    // Switch to academy workspace
    mockStorage["active_workspace_id"] = "workspace-academy-secondary";
    await fetchWithTenant("/api/v1/attendance");

    assert.equal(capturedHeadersList.length, 2);
    assert.equal(capturedHeadersList[0]["x-tenant-id"], "tenant-institution-root");
    assert.equal(capturedHeadersList[0]["x-workspace-id"], "workspace-campus-primary");
    assert.equal(capturedHeadersList[1]["x-tenant-id"], "tenant-institution-root");
    assert.equal(capturedHeadersList[1]["x-workspace-id"], "workspace-academy-secondary");
  });

  it("7. clearSession purges both tenant_id and active_workspace_id", () => {
    mockStorage["tenant_id"] = "tenant-root";
    mockStorage["active_workspace_id"] = "workspace-1";
    mockStorage["access_token"] = "tok-1";

    clearSession();

    assert.equal(mockStorage["tenant_id"], undefined);
    assert.equal(mockStorage["active_workspace_id"], undefined);
    assert.equal(mockStorage["access_token"], undefined);
  });
});

