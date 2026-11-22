# GLOBAL UX & DESIGN SYSTEM FORENSIC AUDIT

**Document Reference:** `docs/GLOBAL_UX_AND_DESIGN_SYSTEM_AUDIT.md`  
**Release Track:** EducationOS RC3 — Academic & Experience Transformation  
**Auditor:** UX Design Systems Engineer & Senior Frontend Architect  
**Date:** 2026-11-14

---

## 1. Executive Summary & Design System Baseline

The frontend design system uses Tailwind CSS, Lucide React icons, and `next-themes` (`ThemeProvider` configured in `frontend/components/providers.tsx`). However, forensic examination reveals significant UX fragmentation across core dashboard workflows:

1. **Native Browser Dropdowns vs Custom Design System:** Instead of reusable, theme-aware combobox or select primitives, dashboard screens rely heavily on raw HTML `<select>` elements styled with basic border/background classes. On macOS, Windows, and Chromium/WebKit browsers, `<option>` elements render with operating-system native black/grey styling that ignores application dark/light design tokens and breaks visual immersion.
2. **Missing UI Primitives:** The `frontend/components/ui/` directory contained only `button.tsx`, `command.tsx`, `dialog.tsx`, `input-group.tsx`, `input.tsx`, and `textarea.tsx`. There were no standardized implementations for `Select`, `Combobox`, `SearchableSelect`, `DropdownMenu`, `Tabs`, `Badge`, or `Toast`.
3. **Theme & Appearance Controls Missing from Topbar:** While `next-themes` was initialized in `providers.tsx`, the authenticated dashboard header (`frontend/app/dashboard/layout.tsx:364-413`) included only a language toggle button. There was no visible theme toggle icon (Sun / Moon / System) in the topbar, forcing users to navigate to settings or leaving dark mode inaccessible from primary workflows.
4. **Unscalable Dropdown Data Binding (Finance & Admissions):** In `frontend/app/dashboard/finance/page.tsx:579-583`, student selection inside the Fee Collection modal mapped an entire unpaginated array of student objects directly into a native `<select>`. For schools with 1,000–10,000 students, this causes massive DOM inflation, UI freezing, and an unusable selection experience.
5. **Tenant Branding Divergence:** `frontend/components/WorkspaceSwitcher.tsx` displayed `currentWorkspace.name` from `workspaceContext.tsx` (which fell back to `localStorage.getItem("school_name")` or `"Your School"`), completely ignoring the canonical `useInstitution()` profile context (`frontend/lib/institution.tsx`).

---

## 2. Granular Forensic Findings

### Finding UX-F01 (Severity: HIGH)
- **Title:** Native HTML Select Inconsistencies & Dark Mode Option Clipping
- **Affected Files:**
  - `frontend/app/dashboard/academic/page.tsx:44-55`
  - `frontend/app/dashboard/attendance/page.tsx:80-95`
  - `frontend/app/dashboard/finance/page.tsx:574-584`
  - `frontend/app/dashboard/doubt-solver/page.tsx:79-89`
  - `frontend/app/dashboard/students/page.tsx:42-55`
  - `frontend/app/dashboard/teachers/page.tsx:33-43`
- **Root Cause:** Absence of a standardized `SearchableSelect` and `CustomSelect` component in `frontend/components/ui/`. Raw `<select>` elements render unstyled OS-level popups that cannot be styled with Tailwind CSS dark-mode classes.
- **Impact:** In dark mode, users experience glaring light-grey/white native popups or black text on dark backgrounds depending on browser/OS defaults, violating UI polish and enterprise SaaS standards.
- **Implementation Plan:**
  1. Build a unified, accessible `SearchableSelect` component supporting search filtering, keyboard navigation, clear action, empty state, and dark/light theme tokens.
  2. Build a standard `CustomSelect` component with chevron indicator, custom dropdown panel, and keyboard accessibility.
  3. Replace raw `<select>` elements across all dashboard pages.
- **Verification Test:** Visual and keyboard navigation verification in both dark and light modes; responsive placement testing on mobile viewports.

---

### Finding UX-F02 (Severity: HIGH)
- **Title:** Missing Topbar Theme Switcher Control (Sun / Moon / System)
- **Affected Files:**
  - `frontend/app/dashboard/layout.tsx:380-413`
  - `frontend/components/providers.tsx`
- **Root Cause:** `frontend/app/dashboard/layout.tsx` omitted theme controls in the header, offering only `toggleLanguage`. Users had no convenient way to switch between Light, Dark, and System appearance.
- **Impact:** Users on devices defaulting to light or dark mode cannot easily switch themes without navigating away to deep settings.
- **Implementation Plan:**
  1. Create a `ThemeToggle` component in `frontend/components/ThemeToggle.tsx` using `useTheme()` from `next-themes`.
  2. Implement a cycling or dropdown toggle icon (Sun for Light, Moon for Dark, Laptop/Monitor for System) with tooltip.
  3. Mount the `ThemeToggle` alongside the Language Toggle in `frontend/app/dashboard/layout.tsx`.
- **Verification Test:** Verify clicking the theme icon switches document class between `light`, `dark`, and persists in `localStorage` across page reloads.

---

### Finding UX-F03 (Severity: HIGH)
- **Title:** Unscalable Student Dropdown in Fee Collection (DOM Collapse at High Scale)
- **Affected Files:**
  - `frontend/app/dashboard/finance/page.tsx:230-260, 574-584`
  - `backend/app/api/endpoints/students.py:86-135`
- **Root Cause:** `frontend/app/dashboard/finance/page.tsx` called `fetchStudents()` (`GET /api/v1/students/`) without pagination or search limits, loading all student records in memory and rendering `<option>` elements for every student.
- **Impact:** Unacceptable latency, browser memory spikes, and unusable scrolling for schools with 500 to 10,000+ students.
- **Implementation Plan:**
  1. Provide a server-side debounced search endpoint in `students.py` (`GET /api/v1/students/search?q=...&limit=20`).
  2. Replace the static select in `finance/page.tsx` with an interactive, debounced search combobox displaying student name, Bengali name, admission number, class, section, and roll number.
  3. Add quick-search chips for class/section filtering.
- **Verification Test:** Benchmark query response time and test rendering with synthetic search results matching 50, 500, and 5,000 students.

---

### Finding UX-F04 (Severity: MEDIUM)
- **Title:** Tenant Branding Disconnect Between WorkspaceContext and InstitutionProvider
- **Affected Files:**
  - `frontend/components/WorkspaceSwitcher.tsx:22, 32, 48`
  - `frontend/lib/workspaceContext.tsx:43-58`
  - `frontend/lib/institution.tsx:27-48`
  - `frontend/app/login/page.tsx:94-107`
- **Root Cause:** Two competing sources of truth for school branding existed:
  - `InstitutionProvider` (`frontend/lib/institution.tsx`) fetched `/api/v1/institution/profile` and cached by tenant ID.
  - `WorkspaceContext` (`frontend/lib/workspaceContext.tsx`) initialized from `localStorage.getItem("school_name")` with fallback to `"Your School"`.
  `WorkspaceSwitcher.tsx` read `currentWorkspace.name` from `WorkspaceContext`, leading to stale or default names appearing in the top navigation bar even when `useInstitution()` had the correct name.
- **Impact:** Users saw generic `"Your School"` or old test academy labels instead of the actual institution profile.
- **Implementation Plan:**
  1. Synchronize `WorkspaceContext` and `InstitutionProvider` by prioritizing `useInstitution().name` when resolving active workspace title.
  2. Clean up stale `localStorage` keys during authentication and tenant switching.
  3. Update `WorkspaceSwitcher.tsx` to read the canonical institution name.
- **Verification Test:** Log in as different tenant users and verify that the exact institution name matches `/api/v1/institution/profile` immediately upon load.

---

### Finding UX-F05 (Severity: MEDIUM)
- **Title:** Incomplete Bengali Localization Across Dashboard Screens
- **Affected Files:**
  - `frontend/lib/i18n.ts`
  - `frontend/app/dashboard/students/page.tsx`
  - `frontend/app/dashboard/teachers/page.tsx`
  - `frontend/app/dashboard/academic/page.tsx`
  - `frontend/app/dashboard/finance/page.tsx`
- **Root Cause:** Multiple UI strings, table headers, form placeholders, and status labels were hardcoded in English inside component TSX files without translation keys in `frontend/lib/i18n.ts`.
- **Impact:** Switching to বাংলা left critical sections (e.g., student editing, fee ledger, class routines, and modal dialogs) half-English and half-Bengali.
- **Implementation Plan:**
  1. Expand `frontend/lib/i18n.ts` with comprehensive translation keys covering academic management, student 360, teacher onboarding, and fee workflows.
  2. Wrap hardcoded strings in `t("key")` or conditional bilingual expressions (`language === "EN" ? ... : ...`).
- **Verification Test:** Automated string audit verifying 100% of primary UI labels resolve in both English and Bengali dictionaries.

---

## 3. Design System Standards & Color Tokens

| UI Element | Light Mode Token | Dark Mode Token | Border / Ring | Focus State |
| :--- | :--- | :--- | :--- | :--- |
| **Surface Card** | `bg-white` | `dark:bg-[#0f0f11]` | `border-gray-200 dark:border-white/10` | N/A |
| **Input / Select Box** | `bg-gray-50 text-gray-900` | `dark:bg-black/40 dark:text-white` | `border-gray-200 dark:border-white/10` | `focus:border-blue-500 dark:focus:border-purple-500` |
| **Dropdown Popover** | `bg-white shadow-xl` | `dark:bg-[#141417] dark:shadow-2xl` | `border-gray-200 dark:border-white/10` | `ring-1 ring-black/5` |
| **Item Hover State** | `hover:bg-gray-100` | `dark:hover:bg-white/[0.06]` | N/A | `text-gray-900 dark:text-white` |
| **Active / Selected** | `bg-blue-50 text-blue-700` | `dark:bg-purple-500/15 dark:text-purple-300` | `border-blue-200 dark:border-purple-500/30` | `font-semibold` |
| **Action Primary** | `bg-blue-600 hover:bg-blue-700 text-white` | `dark:bg-purple-600 dark:hover:bg-purple-500 text-white` | N/A | `shadow-sm hover:shadow` |
| **Action Subtle** | `bg-gray-100 hover:bg-gray-200 text-gray-700` | `dark:bg-white/5 dark:hover:bg-white/10 dark:text-gray-400` | `border-transparent` | `transition-colors` |
