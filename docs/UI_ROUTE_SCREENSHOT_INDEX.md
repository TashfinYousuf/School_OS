# EducationOS — UI/UX Route Screenshot Index
**Execution Date:** 9 November 2026  
**Environment:** Safe Local Development Environment (`Next.js 14.2.23` on port 3000, `FastAPI/Uvicorn` on port 8000)  
**Browser Engine:** Headless Google Chrome (`Chrome 150.0.7871.125`, CDP Automation)  
**Audited Artifacts Directory:** `docs/ui-audit/`  
**Total Route Captures:** 39 Full-Page Visual Snapshots (20 Public Desktop, 13 Authenticated Desktop, 6 Mobile Viewport)

---

## 1. Executive Summary & Verification Ledger

All 39 target routes have been executed, rendered, inspected for DOM layout hierarchy, and captured to disk without modifying any frontend UI components. Each screenshot is a genuine high-resolution full-page snapshot of the actual executing application.

| Category | Route Count | Target Viewport | Storage Directory | Capture Success Rate |
| :--- | :---: | :---: | :---: | :---: |
| **Public Website & Marketing** | 20 | 1440 × 900 (Desktop) | `docs/ui-audit/01–20_*.png` | 100% (20/20) |
| **Authentication Shell** | 1 | 1440 × 900 (Desktop) | `docs/ui-audit/21_login.png` | 100% (1/1) |
| **Authenticated Dashboard Shell** | 12 | 1440 × 900 (Desktop) | `docs/ui-audit/22–33_*.png` | 100% (12/12) |
| **Responsive Mobile Layouts** | 6 | 390 × 844 (Mobile 2x) | `docs/ui-audit/34–39_*.png` | 100% (6/6) |
| **Total Suite** | **39** | — | `docs/ui-audit/` | **100% (39/39)** |

---

## 2. Master Screenshot Catalog

### Section A — Public Website & Marketing Shell (Desktop 1440×900)

| ID | Route Path | Title | File Reference | Size | Layout Shell | Nav / Foot / Aside | Input / Tables |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| `01` | `/` | EducationOS - Institutional OS | [01_homepage_desktop.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/01_homepage_desktop.png) | 1,230 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 1, Tables: 0 |
| `02` | `/solutions` | EducationOS - Institutional OS | [02_solutions_overview.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/02_solutions_overview.png) | 330 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `03` | `/solutions/schools` | EducationOS - Institutional OS | [03_solutions_schools.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/03_solutions_schools.png) | 405 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `04` | `/solutions/colleges` | EducationOS - Institutional OS | [04_solutions_colleges.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/04_solutions_colleges.png) | 251 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `05` | `/solutions/academies` | EducationOS - Institutional OS | [05_solutions_academies.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/05_solutions_academies.png) | 268 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `06` | `/features` | Features Catalog | [06_features_catalog.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/06_features_catalog.png) | 533 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 1, Tables: 0 |
| `07` | `/pricing` | EducationOS - Institutional OS | [07_pricing_standalone.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/07_pricing_standalone.png) | 701 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 2, Tables: 0 |
| `08` | `/about` | EducationOS - Institutional OS | [08_about.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/08_about.png) | 301 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `09` | `/mission` | EducationOS - Institutional OS | [09_mission.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/09_mission.png) | 254 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `10` | `/security` | EducationOS - Institutional OS | [10_security.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/10_security.png) | 290 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `11` | `/technology` | EducationOS - Institutional OS | [11_technology.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/11_technology.png) | 256 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `12` | `/docs` | EducationOS - Institutional OS | [12_docs.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/12_docs.png) | 290 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 1, Tables: 0 |
| `13` | `/help` | EducationOS - Institutional OS | [13_help.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/13_help.png) | 242 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 1, Tables: 0 |
| `14` | `/support` | EducationOS - Institutional OS | [14_support.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/14_support.png) | 223 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `15` | `/contact` | EducationOS - Institutional OS | [15_contact.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/15_contact.png) | 245 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 5, Tables: 0 |
| `16` | `/onboard` | EducationOS - Institutional OS | [16_onboard.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/16_onboard.png) | 195 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `17` | `/legal/privacy` | EducationOS - Institutional OS | [17_legal_privacy.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/17_legal_privacy.png) | 321 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `18` | `/legal/terms` | EducationOS - Institutional OS | [18_legal_terms.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/18_legal_terms.png) | 279 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `19` | `/legal/refund` | EducationOS - Institutional OS | [19_legal_refund.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/19_legal_refund.png) | 233 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |
| `20` | `/legal/cancellation` | EducationOS - Institutional OS | [20_legal_cancellation.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/20_legal_cancellation.png) | 225 KB | Public Marketing | Header: Yes, Footer: Yes, Aside: No | Inputs: 0, Tables: 0 |

---

### Section B — Authentication Shell (Desktop 1440×900)

| ID | Route Path | Title | File Reference | Size | Layout Shell | Nav / Foot / Aside | Input / Tables |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| `21` | `/login` | EducationOS - Institutional OS | [21_login.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/21_login.png) | 80 KB | Minimal Auth Card Shell | Header: No, Footer: No, Aside: No | Inputs: 3, Tables: 0 |

---

### Section C — Authenticated Dashboard Shell (Desktop 1440×900)
*Session context: Role `admin`, School `Kids Shine International School`, Tenant ID `1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31`.*

| ID | Route Path | Title | File Reference | Size | Layout Shell | Nav / Foot / Aside | Input / Tables |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| `22` | `/dashboard` | EducationOS - Institutional OS | [22_dashboard_overview.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/22_dashboard_overview.png) | 134 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 0, Tables: 0 |
| `23` | `/dashboard/students` | EducationOS - Institutional OS | [23_dashboard_students.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/23_dashboard_students.png) | 122 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 4, Tables: 1 |
| `24` | `/dashboard/teachers` | EducationOS - Institutional OS | [24_dashboard_teachers.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/24_dashboard_teachers.png) | 117 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 2, Tables: 1 |
| `25` | `/dashboard/attendance` | EducationOS - Institutional OS | [25_dashboard_attendance.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/25_dashboard_attendance.png) | 133 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 3, Tables: 1 |
| `26` | `/dashboard/exams` | EducationOS - Institutional OS | [26_dashboard_exams.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/26_dashboard_exams.png) | 162 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 4, Tables: 1 |
| `27` | `/dashboard/results` | EducationOS - Institutional OS | [27_dashboard_results.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/27_dashboard_results.png) | 124 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 3, Tables: 1 |
| `28` | `/dashboard/finance` | EducationOS - Institutional OS | [28_dashboard_finance.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/28_dashboard_finance.png) | 126 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 3, Tables: 1 |
| `29` | `/dashboard/academic` | EducationOS - Institutional OS | [29_dashboard_academic.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/29_dashboard_academic.png) | 135 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 2, Tables: 1 |
| `30` | `/dashboard/guardians` | EducationOS - Institutional OS | [30_dashboard_guardians.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/30_dashboard_guardians.png) | 112 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 2, Tables: 1 |
| `31` | `/dashboard/notices` | EducationOS - Institutional OS | [31_dashboard_notices.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/31_dashboard_notices.png) | 110 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 3, Tables: 0 |
| `32` | `/dashboard/settings` | EducationOS - Institutional OS | [32_dashboard_settings.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/32_dashboard_settings.png) | 115 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 8, Tables: 0 |
| `33` | `/dashboard/approvals` | EducationOS - Institutional OS | [33_dashboard_approvals.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/33_dashboard_approvals.png) | 124 KB | Authenticated Shell | Header: Yes, Footer: No, Aside: Yes | Inputs: 1, Tables: 1 |

---

### Section D — Responsive Mobile Layout Audits (Viewport 390×844 @ 2x DPI)

| ID | Route Path | Title | File Reference | Size | Target Persona & State | Mobile Header / Drawer | Inputs / Action State |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| `34` | `/` | EducationOS - Institutional OS | [34_homepage_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/34_homepage_mobile.png) | 2,721 KB | Public Visitor (Mobile) | Fixed Nav with Hamburger Toggle | Full Scrollable Hero, Stacked Grid |
| `35` | `/pricing` | EducationOS - Institutional OS | [35_pricing_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/35_pricing_mobile.png) | 1,671 KB | Public School Founder (Mobile) | Clean Mobile Header | Vertical Tier Stack, Currency Pill |
| `36` | `/solutions/schools` | EducationOS - Institutional OS | [36_solutions_schools_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/36_solutions_schools_mobile.png) | 841 KB | Public Principal (Mobile) | Header + Stacked Solution Pillars | Full Vertical Feature Flow |
| `37` | `/login` | EducationOS - Institutional OS | [37_login_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/37_login_mobile.png) | 124 KB | Staff / Parent Login (Mobile) | Minimal Single-Column Card | 4-Tab Segmented Control, Full-Width Form |
| `38` | `/dashboard` | EducationOS - Institutional OS | [38_dashboard_overview_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/38_dashboard_overview_mobile.png) | 179 KB | Admin Dashboard (Mobile) | Mobile Topbar, Collapsible Drawer | Stacked Metrics Cards, Action FAB |
| `39` | `/dashboard/attendance` | EducationOS - Institutional OS | [39_dashboard_attendance_mobile.png](file:///Users/tashfinyousuf/Python/SCHOOL_OS/docs/ui-audit/39_dashboard_attendance_mobile.png) | 178 KB | Class Teacher (Mobile Roll Call) | Mobile Header, Compact Controls | Horizontal Scroll Ledger, Large Tap Targets |

---

## 3. Visual Verification Checklist

1. **Public Marketing Shell (`PublicNavbar` + `PublicFooter`)**:
   - Present across routes 01–20.
   - Sticky top bar with glassmorphic backdrop filter (`backdrop-blur-md`).
   - Clean footer with categorized site map, emergency contact details, and Gov compliance disclaimers.
2. **Authenticated Dashboard Shell (`DashboardLayoutContent` + Sidebar + Topbar)**:
   - Present across routes 22–33.
   - Left-hand collapsible navigation sidebar with workspace switcher, institution badge, and role indicator.
   - Top action bar featuring Command Palette shortcut (`Cmd+K`), Language toggle (`EN` / `বাংলা`), and User avatar.
3. **Responsive Mobile Shell**:
   - Tested on iPhone 14/15/16 standard viewport (390 × 844 px, deviceScaleFactor 2).
   - Sidebar automatically folds into off-canvas mobile drawer accessible via hamburger menu.
   - Tabular data on student roster and attendance includes overflow horizontal scroll wrappers.

