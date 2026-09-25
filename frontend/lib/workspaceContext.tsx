"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type InstitutionType = "school" | "academy" | "college";

interface WorkspaceInfo {
  orgId: string;
  name: string;
  type: InstitutionType;
  role: string;
  enabledModules: string[];
}

interface WorkspaceContextType {
  currentWorkspace: WorkspaceInfo;
  switchWorkspace: (orgId: string) => void;
  availableWorkspaces: WorkspaceInfo[];
}

const defaultWorkspace: WorkspaceInfo = {
  orgId: "org-ksis-01",
  name: "Kids Shine International School",
  type: "school",
  role: "admin",
  enabledModules: ["attendance", "students", "finance", "exams", "notices", "routine"]
};

const academyWorkspace: WorkspaceInfo = {
  orgId: "org-academy-02",
  name: "Future Academic Care (Udvash Model)",
  type: "academy",
  role: "admin",
  enabledModules: ["programs", "batches", "live_exams", "question_bank", "doubt_solver"]
};

const WorkspaceContext = createContext<WorkspaceContextType>({
  currentWorkspace: defaultWorkspace,
  switchWorkspace: () => {},
  availableWorkspaces: [defaultWorkspace, academyWorkspace]
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceInfo>(defaultWorkspace);
  const availableWorkspaces = [defaultWorkspace, academyWorkspace];

  useEffect(() => {
    const savedOrg = localStorage.getItem("active_org_id");
    if (savedOrg) {
      const found = availableWorkspaces.find(w => w.orgId === savedOrg);
      if (found) setCurrentWorkspace(found);
    }
  }, []);

  const switchWorkspace = (orgId: string) => {
    const found = availableWorkspaces.find(w => w.orgId === orgId);
    if (found) {
      setCurrentWorkspace(found);
      localStorage.setItem("active_org_id", orgId);
      localStorage.setItem("institution_type", found.type);
      window.location.reload(); // Re-render navigation & terminology cleanly
    }
  };

  return (
    <WorkspaceContext.Provider value={{ currentWorkspace, switchWorkspace, availableWorkspaces }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);