"use client";

import { useState } from "react";
import { useWorkspace } from "@/lib/workspaceContext";
import { Building2, ChevronDown, Check } from "lucide-react";

export default function WorkspaceSwitcher() {
  const { currentWorkspace, switchWorkspace, availableWorkspaces } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all text-xs font-semibold text-gray-800 dark:text-neutral-200"
      >
        <Building2 size={14} className="text-emerald-600 dark:text-emerald-400" />
        <span className="max-w-[150px] truncate">{currentWorkspace.name}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400">
          {currentWorkspace.type}
        </span>
        <ChevronDown size={13} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl z-50 p-1.5 space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Available Workspaces
          </div>
          {availableWorkspaces.map((ws) => (
            <button
              key={ws.orgId}
              onClick={() => {
                switchWorkspace(ws.orgId);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all ${
                currentWorkspace.orgId === ws.orgId
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 font-bold"
                  : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-neutral-300"
              }`}
            >
              <div>
                <div className="font-semibold">{ws.name}</div>
                <div className="text-[10px] text-gray-400 uppercase font-mono">{ws.type} Mode</div>
              </div>
              {currentWorkspace.orgId === ws.orgId && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}