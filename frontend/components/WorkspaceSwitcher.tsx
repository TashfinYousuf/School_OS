"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/lib/workspaceContext";
import { useInstitution } from "@/lib/institution";
import { Building2, ChevronDown, Check, School } from "lucide-react";

export default function WorkspaceSwitcher() {
  const { currentWorkspace, switchWorkspace, availableWorkspaces } = useWorkspace();
  const { name: institutionName } = useInstitution();
  const [isOpen, setIsOpen] = useState(false);
  const [userRole, setUserRole] = useState<string>("admin");

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "").toLowerCase();
    setUserRole(role);
  }, []);

  const rawName = currentWorkspace?.name || "";
  const displayName = 
    (!rawName || rawName === "Your School" || rawName === "Institutional Workspace")
      ? (institutionName || "School")
      : rawName;

  // For students and guardians: fixed enrolled institution badge (no switcher dropdown)
  if (userRole === "student" || userRole === "guardian") {
    return (
      <div 
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] text-xs font-semibold text-gray-700 dark:text-neutral-300"
        title={displayName}
      >
        <School size={14} className="text-blue-600 dark:text-purple-400 shrink-0" />
        <span className="max-w-[200px] sm:max-w-[280px] md:max-w-[360px] truncate">{displayName}</span>
      </div>
    );
  }

  // Single-workspace tenant: show clean static badge without dropdown affordance
  if (!availableWorkspaces || availableWorkspaces.length <= 1) {
    return (
      <div 
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] text-xs font-semibold text-gray-800 dark:text-neutral-200"
        title={displayName}
      >
        <Building2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="max-w-[200px] sm:max-w-[280px] md:max-w-[360px] truncate">{displayName}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400 shrink-0">
          {currentWorkspace.type}
        </span>
      </div>
    );
  }

  // Multi-workspace tenant: interactive context switcher
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title={displayName}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all text-xs font-semibold text-gray-800 dark:text-neutral-200"
      >
        <Building2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="max-w-[180px] sm:max-w-[260px] md:max-w-[340px] truncate">{displayName}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400 shrink-0">
          {currentWorkspace.type}
        </span>
        <ChevronDown size={13} className={`text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-72 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Switch Campus / Workspace
          </div>
          {availableWorkspaces.map((ws) => (
            <button
              key={ws.orgId}
              onClick={() => {
                switchWorkspace(ws.orgId);
                setIsOpen(false);
              }}
              title={ws.name}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all ${
                currentWorkspace.orgId === ws.orgId
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold"
                  : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-neutral-300"
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="font-semibold truncate">{ws.name}</div>
                <div className="text-[10px] text-gray-400 uppercase font-mono">{ws.type} Mode</div>
              </div>
              {currentWorkspace.orgId === ws.orgId && <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
