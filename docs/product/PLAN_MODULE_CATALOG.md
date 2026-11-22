# EducationOS — Canonical Plan & Module Catalog

**Version:** 2026.1-dynamic  
**Classification:** Authoritative Product & Commercial Specification  
**Status:** Production Standard  
**Document Reference:** `docs/product/PLAN_MODULE_CATALOG.md`  

---

## 1. Executive Summary

EducationOS provides an institutional SaaS platform designed specifically for primary, secondary (K-12), college, and coaching academy campuses in Bangladesh and South Asia.

The commercial model is built on three transparent tiers:
1. **Base Platform Fee:** Fixed institutional infrastructure charge covering tenancy isolation, security auditing, and persistent data storage.
2. **Core Included Modules (9):** Mandatory fundamental school operating tools included free of charge with every active platform subscription.
3. **Customizable Optional Modules (5):** Modular add-ons that institutions can independently enable or disable according to their operational needs.
4. **Pre-Packaged Approved Plans:** Fixed-price packages tailored for standard school and coaching operational profiles.

---

## 2. Core Included Platform Modules (9 Modules — ৳0 / Included)

Every EducationOS subscription includes all nine core modules at zero additional monthly charge:

| Module ID | Official Name | Category | Primary Capabilities & Deliverables |
| :--- | :--- | :--- | :--- |
| `core_admin` | **Institution Administration** | Core | Multi-role RBAC, security settings, academic year calendar, campus configuration, audit log inspection. |
| `core_students` | **Student Directory & Admissions** | Core | Student 360 digital twin, enrollment records, class roster CSV import/export, student ID card generator. |
| `core_teachers` | **Teacher & Staff Management** | Core | Teacher profiles, employee records, class teacher assignments, subject mappings, daily staff roll call. |
| `core_guardians` | **Guardian & Parent Portal** | Core | Multi-child linking, parent access management, real-time attendance status, fee receipts view. |
| `core_academic` | **Academic Structure & Routines** | Core | Classes, sections, subjects, periods, weekly timetable scheduling, clash prevention algorithms. |
| `core_attendance` | **Smart Attendance & Offline Sync** | Core | 1-tap roll call, offline IndexedDB sync, local storage fallback, absentee report cards, A4 print views. |
| `core_exams` | **Examinations & Grading Registry** | Core | Exam schedules, mark sheets, NCTB/GPA calculation engine, merit lists, A4 PDF report cards. |
| `core_notices` | **Notices & Communication** | Core | Official notice board, departmental announcements, PDF notice attachments, broadcast messaging. |
| `core_reports` | **Standard Operational Reports** | Core | Class-wise attendance percentages, fee collection totals, student demographic summaries. |

---

## 3. Optional Specialized Modules (5 Modules — Modular Pricing)

Institutions can selectively activate optional modules to expand their operational capabilities:

| Module ID | Official Name | Category | Monthly Price | Detailed Deliverables & Quotas |
| :--- | :--- | :--- | :--- | :--- |
| `module_ai_assistant` | **AI Copilot & Question Paper Generator** | AI & Pedagogy | **৳1,200 / mo** | Includes 250,000 monthly Gemini tokens, NCTB question composer (Creative/CQ & MCQ), syllabus chunk RAG ingestion, and lesson plan generator. |
| `module_advanced_finance` | **Advanced Finance & Fee Collection** | Finance | **৳800 / mo** | Dual-copy student fee receipts, bank/bKash ledger reconciliation, tuition installments, expense ledger, and cash-in-hand accounting. |
| `module_school_website` | **Hosted Institutional Public Website** | Web | **৳1,000 / mo** | Responsive public website with custom school branding, notice board, photo gallery, online admission inquiry forms, and principal message. |
| `module_custom_domain` | **Custom Domain Integration & SSL** | Web | **৳500 / mo** | Automated DNS hostname mapping (`school.edu.bd`) with automated Let's Encrypt wildcard TLS certificate provisioning and renewal. |
| `module_whatsapp_alerts` | **Automated WhatsApp Absentee Alerts** | Communication | **৳600 / mo** | Real-time automated WhatsApp message dispatch to parents the moment a student is marked absent during morning roll call. |

---

## 4. Pre-Packaged Approved Plans

For institutions preferring predictable bundled billing rather than à-la-carte itemization:

### 4.1 School Track (K-12)
1. **School Starter (৳990 / mo):**
   - Capacity: Up to 100 Students
   - Quota: 100 AI Exam Questions / month
   - Features: All 9 Core Modules, 1-Tap Attendance, Cash/bKash Fee Receipts, A4 Report Cards, Offline Sync.
2. **School Growth (৳2,490 / mo — Most Popular):**
   - Capacity: Up to 500 Students
   - Quota: 500 AI Exam Questions / month
   - Features: All 9 Core Modules + AI Copilot + NCTB Grading Engine + Admissions Portal + WhatsApp Alerts.
3. **School Professional (৳5,990 / mo):**
   - Capacity: Up to 1,500 Students
   - Quota: 2,000 AI Exam Questions / month
   - Features: All 9 Core Modules + AI Copilot + Advanced Finance + Camera OMR Scanner + Multi-Branch Oversight + Append-Only Audit Ledger.

### 4.2 Coaching & Academy Track
1. **Academy Starter (৳1,490 / mo):**
   - Capacity: Up to 150 Batch Enrollments
   - Quota: 200 AI Exam Questions / month
   - Features: Shifts & Timetable Scheduling, Live MCQ Exams with Negative Marking, Central Merit Ranking.
2. **Academy Growth (৳3,990 / mo):**
   - Capacity: Up to 600 Batch Enrollments
   - Quota: 1,000 AI Exam Questions / month
   - Features: High-Concurrency Live Exams, Socratic AI Doubt Solver Studio, Solution Sheet PDF Export, Batch Installments.

### 4.3 Unified Campus Track
1. **Unified Campus Pro (৳9,990 / mo):**
   - Capacity: Up to 2,500 Combined Students
   - Quota: 5,000 AI Exam Questions / month
   - Features: Dual Workspace (School + Academy), Shared Staff Directory with Segregated Ledgers, Dedicated OMR & AI Ingestion Pipelines.

---

## 5. Discounting & Trial Policies

- **14-Day Free Evaluation:** All new institutions begin with a 14-day fully featured evaluation period.
- **Pilot Pass (Kids Shine International School):** 60-day complimentary full-suite pilot (`৳0.00`) under authorized institutional agreement.
- **Annual Billing Incentive:** 15% discount applied across all modules and per-student charges when prepaid annually.
- **Per-Student Marginal Scaling (Dynamic Engine):**
  - First 300 students: ৳12 / student / month
  - 301 to 800 students: ৳10 / student / month
  - 801+ students: ৳8 / student / month

