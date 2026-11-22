// frontend/lib/api-client.ts
/**
 * Unified, Enterprise-Grade API Client for EducationOS
 * Features:
 * - Centralized Base URL (process.env.NEXT_PUBLIC_API_URL)
 * - Automatic Authorization & X-Tenant-ID Header Injection
 * - Concurrency-Safe Silent Token Refresh with Promise Queueing
 * - Tenant-Scoped & Workspace-Scoped Offline Caching (Zero Cross-Tenant Leakage)
 * - Typed Helper Methods (GET, POST, PUT, PATCH, DELETE, safeFetch)
 */

const API_BASE_URL = (
  typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8000"
).replace(/\/$/, "");

import { offlineDB } from "./offline/db.ts";

export interface ApiResponse<T = any> {
  data: T | null;
  status: number;
  ok: boolean;
  error?: string;
  isOffline?: boolean;
}

// Concurrency control for token refreshing
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function onRefreshFailed() {
  refreshSubscribers = [];
}

/**
 * Get the current auth token from storage
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token") || localStorage.getItem("token");
}

/**
 * Get current refresh token from storage
 */
export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

/**
 * Get current tenant ID from storage (Authoritative Institution Tenant)
 */
export function getActiveTenantId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("tenant_id");
}

/**
 * Get current workspace ID from storage (Scoped Sub-Campus / Academy Workspace)
 */
export function getActiveWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("active_workspace_id");
}

/**
 * Perform silent token refresh against backend /api/v1/auth/refresh
 */
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    if (newAccessToken && typeof window !== "undefined") {
      localStorage.setItem("access_token", newAccessToken);
      localStorage.setItem("token", newAccessToken);
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }
      return newAccessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clear all authentication session tokens
 */
export function clearSession() {
  if (typeof window === "undefined") return;
  const currentTenantId = localStorage.getItem("tenant_id") || "";
  const currentUserId = localStorage.getItem("user_id") || "";
  if (currentTenantId && currentUserId) {
    offlineDB.purgeUserData(currentTenantId, currentUserId).catch(() => {});
  }
  const keysToRemove = [
    "token",
    "access_token",
    "refresh_token",
    "user_role",
    "user_name",
    "tenant_id",
    "user_id",
    "active_workspace_id",
    "student_id",
    "school_name",
    "institution_name",
    "school_code",
  ];
  keysToRemove.forEach((key) => localStorage.removeItem(key));
  Object.keys(localStorage)
    .filter((k) => k.startsWith("institution:") || k.startsWith("EducationOS_cache_"))
    .forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event("auth-changed"));
}

/**
 * Perform complete server-side and client-side logout.
 * 1. Calls backend /api/v1/auth/logout to revoke the active session.
 * 2. Purges sensitive client tokens and local database caches via clearSession().
 * 3. Deterministically redirects user to the public homepage ('/').
 */
export async function performLogout(): Promise<void> {
  const token = getAccessToken();
  const refreshToken = getRefreshToken();
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Best-effort network logout; proceed with local cache purge
    }
  }
  clearSession();
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}

/**
 * Canonical fetch with automatic headers and refresh handling
 */
export async function fetchWithTenant(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const fullUrl = endpoint.startsWith("http://") || endpoint.startsWith("https://")
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const token = getAccessToken();
  const activeTenantId = getActiveTenantId();
  const activeWorkspaceId = getActiveWorkspaceId();

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (activeTenantId && !headers.has("X-Tenant-ID")) {
    headers.set("X-Tenant-ID", activeTenantId);
  }

  if (activeWorkspaceId && !headers.has("X-Workspace-ID")) {
    headers.set("X-Workspace-ID", activeWorkspaceId);
  }

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      ...options,
      headers,
    });
  } catch (netErr) {
    throw netErr;
  }

  // Handle 401 Unauthorized with token refresh rotation
  if (response.status === 401 && !endpoint.includes("/auth/login") && !endpoint.includes("/auth/refresh")) {
    const refreshToken = getRefreshToken();

    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAccessToken();
        isRefreshing = false;

        if (newToken) {
          onRefreshed(newToken);
          headers.set("Authorization", `Bearer ${newToken}`);
          return fetch(fullUrl, { ...options, headers });
        } else {
          onRefreshFailed();
          clearSession();
          if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
          return response;
        }
      } else {
        // Wait for active refresh to complete
        return new Promise<Response>((resolve, reject) => {
          subscribeTokenRefresh(async (newToken: string) => {
            try {
              headers.set("Authorization", `Bearer ${newToken}`);
              const retryRes = await fetch(fullUrl, { ...options, headers });
              resolve(retryRes);
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    } else {
      clearSession();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
  }

  return response;
}

/**
 * Tenant-Safe Cached Fetch (eliminates DEF-P0-09 cross-tenant cache pollution)
 */
export async function safeFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T | null; isOffline: boolean }> {
  const tenantId = (typeof window !== "undefined" ? (localStorage.getItem("tenant_id") || "global") : "global");
  const workspaceId = (typeof window !== "undefined" ? (localStorage.getItem("active_workspace_id") || "default") : "default");
  const userId = (typeof window !== "undefined" ? localStorage.getItem("user_id") : null);
  
  // Scoped cache key guaranteed not to collide across different tenants, workspaces, or users
  const sanitizedPath = url.replace(/https?:\/\/[^/]+/, "");
  const cacheKey = userId
    ? `EducationOS_cache_${tenantId}_${workspaceId}_${userId}_${sanitizedPath}`
    : `EducationOS_cache_${tenantId}_${workspaceId}_${sanitizedPath}`;

  // Sensitive operational paths must not be persisted into browser localStorage
  const isSensitive = /\/(finance|guardians|audit|settings|approvals)\b/i.test(sanitizedPath);

  try {
    const res = await fetchWithTenant(url, {
      ...options,
      cache: "no-store",
    });

    if (res.ok) {
      const freshData = await res.json();
      if ((!options.method || options.method.toUpperCase() === "GET") && !isSensitive) {
        try {
          if (typeof window !== "undefined") {
            localStorage.setItem(cacheKey, JSON.stringify(freshData));
          }
        } catch {
          // Ignore quota errors
        }
      }
      return { data: freshData as T, isOffline: false };
    }

    throw new Error(`HTTP_${res.status}`);
  } catch (err) {
    const isPhysicallyOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    if (typeof window !== "undefined" && !isSensitive) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return { data: JSON.parse(cached) as T, isOffline: isPhysicallyOffline };
        } catch {
          // Parsing error fallback
        }
      }
    }
    return { data: null, isOffline: isPhysicallyOffline };
  }
}

/**
 * Typed API Client Object
 */
export const apiClient = {
  get: async <T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    try {
      const res = await fetchWithTenant(endpoint, { ...options, method: "GET" });
      const data = res.ok ? await res.json() : null;
      return { data, status: res.status, ok: res.ok };
    } catch (e: any) {
      return { data: null, status: 0, ok: false, error: e?.message || "Network error" };
    }
  },

  post: async <T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    try {
      const isFormData = body instanceof FormData;
      const res = await fetchWithTenant(endpoint, {
        ...options,
        method: "POST",
        body: isFormData ? body : JSON.stringify(body),
      });
      const data = res.ok ? await res.json() : null;
      return { data, status: res.status, ok: res.ok };
    } catch (e: any) {
      return { data: null, status: 0, ok: false, error: e?.message || "Network error" };
    }
  },

  put: async <T>(endpoint: string, body?: any, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    try {
      const res = await fetchWithTenant(endpoint, {
        ...options,
        method: "PUT",
        body: JSON.stringify(body),
      });
      const data = res.ok ? await res.json() : null;
      return { data, status: res.status, ok: res.ok };
    } catch (e: any) {
      return { data: null, status: 0, ok: false, error: e?.message || "Network error" };
    }
  },

  delete: async <T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    try {
      const res = await fetchWithTenant(endpoint, { ...options, method: "DELETE" });
      const data = res.ok ? await res.json() : null;
      return { data, status: res.status, ok: res.ok };
    } catch (e: any) {
      return { data: null, status: 0, ok: false, error: e?.message || "Network error" };
    }
  },

  safeFetch,
};

export default apiClient;