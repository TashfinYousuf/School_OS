# EducationOS — Institutional Design System Specification
**Version:** 2.0 (Pilot Production Standard)  
**Target:** Kids Shine International School & Multi-Tenant SaaS Platform

---

## 1. Executive Purpose & Design Philosophy
EducationOS is a mission-critical operating system for educational institutions, not a decorative demo or generic consumer web application. Its design language communicates **authority, operational clarity, calm efficiency, and institutional trust**.

### Core Tenets
1. **Operational Hierarchy Over Novelty:** Every card, metric, button, and table row must serve an active administrative or pedagogical need.
2. **Restrained Color & Intentional Semantics:** Colors signify status and domain invariants, never arbitrary decoration.
3. **Inclusive Bilingual Typography:** Equal typographic hierarchy and legibility for English (Inter / sans-serif) and Bangla (Hind Siliguri / Tiro Bangla / system fallback).
4. **Accessible Contrast & Keyboard Usability:** Minimum WCAG 2.1 AA compliant contrast ratios across dark and light modes.
5. **No AI Gimmickry:** AI capabilities (Curriculum Grounded Copilot, Exam Blueprint Generators, Voice Diary) are integrated as discrete professional tools, not noisy, flashing chatbot banners.

---

## 2. Color Palette & Semantic Tokens

### 2.1 Neutral Foundation
| Token | Light Mode Hex | Dark Mode Hex | Usage |
|:---|:---|:---|:---|
| `bg-app` | `#F8FAFC` (Slate 50) | `#0B0F17` (Deep Navy / Carbon) | Application canvas background |
| `bg-surface` | `#FFFFFF` | `#111827` (Slate 900) | Primary cards, modals, sidebars |
| `bg-surface-elevated` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Sub-panels, hover states, table headers |
| `border-subtle` | `#E2E8F0` (Slate 200) | `#1F2937` (Slate 800) | Content dividers, card borders |
| `text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Page titles, primary metric numbers, table data |
| `text-secondary` | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Section subtitles, table headers, breadcrumbs |
| `text-muted` | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | Timestamps, microcopy, disabled controls |

### 2.2 Semantic Invariants
| Role | Accent Class | Tailwind Tokens | Institutional Meaning |
|:---|:---|:---|:---|
| **Institutional Primary** | Blue / Indigo | `blue-600` / `blue-700` | Primary navigation, verified identity, authoritative actions |
| **Success / Present** | Emerald | `emerald-600` / `emerald-500` | Present attendance, paid fees, indexed curriculum, approved items |
| **Warning / Pending** | Amber | `amber-500` / `amber-600` | Pending approval, past due invoice, grace period, draft notice |
| **Danger / Absent** | Rose / Red | `rose-600` / `rose-500` | Absent student, rejected claim, hard lock, irreversible action |
| **Intelligence / AI** | Violet / Purple | `purple-600` / `purple-500` | NCTB curriculum RAG, Socratic dialog, lesson blueprints |

---

## 3. Typography & Spacing Hierarchy

### 3.1 Type Scale
- **Display Title (H1):** `text-2xl font-bold tracking-tight text-slate-900 dark:text-white` (24px / 1.5rem)
- **Section Heading (H2):** `text-lg font-semibold text-slate-900 dark:text-white` (18px / 1.125rem)
- **Card Title / Subheading (H3):** `text-sm font-semibold text-slate-900 dark:text-white` (14px / 0.875rem)
- **Primary Body:** `text-sm text-slate-700 dark:text-slate-200 leading-relaxed` (14px)
- **Secondary / Metric Caption:** `text-xs text-slate-500 dark:text-slate-400 font-medium` (12px)
- **Monospace Numerical:** `font-mono tracking-tight font-semibold` (used for BDT amounts, roll numbers, TrxIDs)

### 3.2 Spacing & Radii
- **Card Border Radius:** `rounded-2xl` (16px) for major widgets; `rounded-xl` (12px) for nested panels and action buttons.
- **Button Radius:** `rounded-xl` (12px) with `py-2 px-3.5` for standard actions; `py-1.5 px-3` for compact tables.
- **Grid Gap:** `gap-4` for dense operational cards; `gap-6` for primary dashboard layouts.

---

## 4. Operational Dashboard Hierarchy

The Admin Dashboard prioritizes real school cadence and daily operational workflows:

```
[1. Institution Cadence Header] -> Real Asia/Dhaka Date, School Name, Domain, Status
[2. Daily Attendance & Student Metrics] -> Present Today, Absent Today, Total Enrolled, Active Staff
[3. Financial Revenue & Weekly Collection] -> Weekly Collection (Sun-Sat), MTD Revenue, Transactions
[4. Operational Efficiency Ledger] -> Transparent Hours Saved, Paperless Benchmark, Activity Distribution
[5. Pending Institutional Approvals & Tasks] -> Leave Requests, Fee Waivers, Grade Changes
[6. Recent Circulars & Notices] -> Targeted Institutional Announcements
```

---

## 5. Iconography Standard (Lucide)
Icons exist exclusively for functional identification:
- `GraduationCap` / `Users`: Student directory & enrollment
- `CalendarCheck` / `CheckCircle2`: Attendance verification
- `Wallet` / `Receipt`: Fee collection & transactions
- `BookOpen` / `Library`: Syllabus & curriculum management
- `Database` / `BrainCircuit`: RAG knowledge chunks & documents
- `Megaphone` / `Bell`: Broadcast notices & circulars
- `ShieldCheck` / `KeyRound`: RBAC, IAM, and security settings

*Strict Prohibition:* No emoji interface controls, no random party poppers, no flashing real-time dots when sockets are inactive.

---

## 6. Component Standards

### 6.1 Data Tables
- Always include explicit column headers with `text-xs font-semibold text-slate-500 uppercase tracking-wider`.
- Alternate row highlights or subtle border separators: `border-b border-slate-100 dark:border-slate-800/60`.
- Empty states must provide contextual guidance: icon, headline, and clear action button.

### 6.2 Modals & Dialogs
- Centered viewport positioning with dark semi-transparent backdrop (`bg-black/50 backdrop-blur-sm`).
- Accessible via Escape key, overlay backdrop click, and explicit close icon.
- Content must scroll within the dialog (`max-h-[85vh] overflow-y-auto`) to adapt seamlessly across mobile and tablet viewports without clipping behind navigation bars.

### 6.3 Metric Cards
- Headline metric number prominently formatted (`text-2xl font-bold font-mono`).
- Time boundary clearly articulated (e.g., "15 Nov 2026 – 21 Nov 2026 (Sun–Sat)").
- Calculation transparency: Disclaimers provided for estimated operational savings.

