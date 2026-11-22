// frontend/lib/workspaceContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { safeFetch, apiClient } from "./api-client";

export type InstitutionType = "school" | "academy" | "college";

export interface WorkspaceInfo {
  orgId: string;
  name: string;
  type: InstitutionType;
  role: string;
  code?: string;
  enabledModules: Record<string, boolean>;
}

export interface WorkspaceContextType {
  currentWorkspace: WorkspaceInfo;
  switchWorkspace: (orgId: string) => void;
  availableWorkspaces: WorkspaceInfo[];
  refreshWorkspaces: () => Promise<void>;
  enableAcademyModule: (name: string, code?: string) => Promise<boolean>;
  loading: boolean;
}

export const WorkspaceContext = createContext<WorkspaceContextType>({
  currentWorkspace: {
    orgId: "default",
    name: "",
    type: "school",
    role: "admin",
    enabledModules: { attendance: true, finance: true, exams: true }
  },
  switchWorkspace: () => {},
  availableWorkspaces: [],
  refreshWorkspaces: async () => {},
  enableAcademyModule: async () => false,
  loading: false
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceInfo>(() => {
    const storedSchoolName = typeof window !== "undefined" 
      ? localStorage.getItem("school_name") || localStorage.getItem("institution_name") || "Your School"
      : "Your School";
    const storedOrgId = typeof window !== "undefined"
      ? localStorage.getItem("active_workspace_id") || "active-tenant"
      : "active-tenant";

    return {
      orgId: storedOrgId,
      name: storedSchoolName,
      type: "school",
      role: "admin",
      enabledModules: { attendance: true, finance: true, exams: true }
    };
  });

  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceInfo[]>([currentWorkspace]);
  const [loading, setLoading] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      setLoading(true);
      const token = typeof window !== "undefined" ? (localStorage.getItem("access_token") || localStorage.getItem("token")) : null;
      if (!token) {
        setLoading(false);
        return;
      }

      const { data } = await safeFetch<any[]>("/api/v1/workspaces/my-workspaces");

      if (data && Array.isArray(data) && data.length > 0) {
        const mappedWorkspaces: WorkspaceInfo[] = data.map((item) => ({
          orgId: String(item.id),
          name: item.name,
          type: (item.workspace_type || "school").toLowerCase() as InstitutionType,
          role: item.role || "admin",
          code: item.code,
          enabledModules: item.enabled_modules || { attendance: true, finance: true, exams: true }
        }));

        setAvailableWorkspaces(mappedWorkspaces);

        // Retain currently active workspace if stored, otherwise default to first
        const storedActiveId = typeof window !== "undefined" ? localStorage.getItem("active_workspace_id") : null;
        const matched = mappedWorkspaces.find((w) => w.orgId === storedActiveId) || mappedWorkspaces[0];
        setCurrentWorkspace(matched);
      }
    } catch {
      // Retain stored fallback state
    } finally {
      setLoading(false);
    }
  }, []);

  const switchWorkspace = useCallback((orgId: string) => {
    const target = availableWorkspaces.find((w) => w.orgId === orgId);
    if (target) {
      setCurrentWorkspace(target);
      if (typeof window !== "undefined") {
        localStorage.setItem("active_workspace_id", target.orgId);
        localStorage.setItem("school_name", target.name);
        window.dispatchEvent(new Event("workspace-changed"));
      }
    }
  }, [availableWorkspaces]);

  const enableAcademyModule = useCallback(async (name: string, code?: string): Promise<boolean> => {
    try {
      const res = await apiClient.post<any>("/api/v1/workspaces/", {
        name,
        workspace_type: "academy",
        code: code || "ACAD"
      });

      if (res.ok && res.data) {
        const newWs: WorkspaceInfo = {
          orgId: String(res.data.id),
          name: res.data.name,
          type: "academy",
          role: "admin",
          code: res.data.code,
          enabledModules: { batches: true, live_exams: true, question_bank: true, finance: true }
        };

        setAvailableWorkspaces((prev) => [...prev, newWs]);
        switchWorkspace(newWs.orgId);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [switchWorkspace]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        switchWorkspace,
        availableWorkspaces,
        refreshWorkspaces: fetchWorkspaces,
        enableAcademyModule,
        loading
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
