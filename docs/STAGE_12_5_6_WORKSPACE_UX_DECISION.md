# EDUCATIONOS — STAGE 12.5.6 WORKSPACE SELECTOR & CONTEXT REDESIGN
**Domain:** Multi-Tenancy & Workspace UX  
**Status:** IMPLEMENTED AND VERIFIED  
**Author:** Principal Software Architect & Product UX Lead  
**Verification Date:** 9 November 2026

---

## 1. Context & Identified Usability Flaw

In Stage 12.5.1, `X-Tenant-ID` (the institutional entity) and `X-Workspace-ID` (the branch/campus within that tenant) were decoupled at the network layer.

However, in the user interface, `WorkspaceSwitcher.tsx` unconditionally rendered an interactive dropdown selector with a chevron arrow, even under the following conditions:
1. **Single-Campus School Tenants**: Schools such as *Kids Shine School* operate a single primary campus. Displaying a dropdown switcher that contains only 1 selectable item caused user confusion ("Why is there a dropdown that does nothing?").
2. **Student & Guardian Personas**: Students and parents are enrolled in a specific institutional campus. Presenting a workspace switching affordance exposed internal operational mechanics and created navigation friction.

---

## 2. Architectural Decision & Redesign

The component `frontend/components/WorkspaceSwitcher.tsx` has been redesigned according to three clear rules:

### Rule 1: Role-Based Suppression
- **Condition**: `userRole === "student" || userRole === "guardian"`
- **Behavior**: The interactive dropdown is completely suppressed. Instead, a clean, compact institutional badge is displayed:
  ```tsx
  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/80 dark:bg-white/[0.02] text-xs font-semibold text-gray-700 dark:text-neutral-300">
    <School size={14} className="text-blue-600 dark:text-purple-400" />
    <span className="max-w-[160px] truncate">{currentWorkspace.name}</span>
  </div>
  ```

### Rule 2: Single-Workspace Static Badge
- **Condition**: `availableWorkspaces.length <= 1` (for staff / admin)
- **Behavior**: The chevron down icon and dropdown menu state are suppressed. The badge shows the school name and current mode (`school` or `academy`), but is non-interactive:
  ```tsx
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.03] text-xs font-semibold text-gray-800 dark:text-neutral-200">
    <Building2 size={14} className="text-emerald-600 dark:text-emerald-400" />
    <span className="max-w-[160px] truncate">{currentWorkspace.name}</span>
    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-neutral-400">
      {currentWorkspace.type}
    </span>
  </div>
  ```

### Rule 3: Multi-Workspace Context Switcher
- **Condition**: `availableWorkspaces.length > 1` (for staff / admin)
- **Behavior**:
  - Displays the active workspace with animated dropdown chevron.
  - Clicking opens the list of available campuses/branches.
  - Selecting a different workspace updates `active_workspace_id` in `localStorage`, changes the active workspace in `WorkspaceContext`, dispatches `workspace-changed` event, and invalidates cached tenant queries.

---

## 3. Verification & Evidence

- **Frontend Unit Tests**: Verified in `frontend/tests/test_stage12_5_6_attendance_and_portals.test.ts` (Suite 1: Workspace Switcher Adaptability).
- **TypeScript Compilation**: 47/47 static routes pass compilation with zero errors.

