# EDUCATIONOS MASTER FEATURE CATALOG & SYSTEM ENTITLEMENTS

**Document Version:** 2026.1-PROD  
**Status:** AUTHORITATIVE CANONICAL REFERENCE  
**Target Platform:** EducationOS / SchoolOS Enterprise SaaS  
**Timezone:** Asia/Dhaka  

---

## 1. Executive Overview

This document specifies the single source of truth (SSOT) for all functional modules, service add-ons, feature flags, and capacity quotas within the EducationOS platform. All billing engines (`pricing_engine.py`, `frontend/lib/plans.ts`), API route entitlement guards (`require_entitlement`), and UI navigation permission filters are bound to the feature keys defined herein.

---

## 2. Core Modules (Included in Base Platform Fee)

Every active tenant with an active subscription or verified trial is granted access to the Core Module suite.

| Module Key | Module Name | Primary Responsibilities | Core API Routes |
| :--- | :--- | :--- | :--- |
| `core_admin` | Institution Administration | Multi-role RBAC, Campus profile, Security settings, System audit logs | `/api/v1/institution`, `/api/v1/campus`, `/api/v1/audit` |
| `core_students` | Student Directory & Admissions | Student 360 profile, Dual-model admissions, Enrollment records, Class roster CSV import | `/api/v1/students`, `/api/v1/admissions` |
| `core_teachers` | Teacher & Staff Management | Staff roster, Subject & Class routine assignments, Roll call authorizations | `/api/v1/teachers` |
| `core_guardians` | Guardian / Parent Portal | Multi-child linkage, NID/Phone verification, Digital fee receipts, Attendance tracking | `/api/v1/guardians` |
| `core_academic` | Academic Structure & Routines | Classes, Sections, Shifts, Subjects, Periods, Timetable builder | `/api/v1/academic` |
| `core_attendance` | Smart Attendance & Offline Sync | 1-tap roll call, Offline IndexedDB queue, Idempotent event sync, A4 print roster | `/api/v1/attendance` |
| `core_exams` | Examinations & Grading | Exam schedules, Mark sheets, NCTB/GPA calculation, Print-ready A4 report cards | `/api/v1/exams`, `/api/v1/results` |
| `core_notices` | Notices & Institutional Alerts | Multi-audience noticeboard, Internal bulletins, Emergency broadcasts | `/api/v1/notices` |
| `core_reports` | Operational Reports | Class-wise attendance percentages, Daily absentee reports, Student demographics | `/api/v1/dashboard/stats` |

---

## 3. Optional Paid Modules

Optional modules are activated per tenant either through package bundles (Growth, Pro, Unified) or via dynamic modular checkout.

| Module Key | Module Name | Category | Monthly BDT | Scope & Gating |
| :--- | :--- | :--- | :--- | :--- |
| `module_ai_assistant` | AI Copilot & Exam Generator | AI / Academic | 1,200 BDT | Includes 250k monthly Gemini API tokens, syllabus chunk RAG, and AI MCQ question paper generation (`/api/v1/ai`, `/api/v1/question-papers/generate`). |
| `module_advanced_finance` | Advanced Finance & Fee Collection | Finance | 800 BDT | Dual-copy student fee receipts, Cash counter ledger, Bank/bKash reconciliation, and Tuition history (`/api/v1/finance`). |
| `module_school_website` | Hosted Institutional Public Website | Web CMS | 1,000 BDT | Templated responsive school website with About, Principal's message, Gallery, and Admission application widget. |
| `module_custom_domain` | Custom Domain & Managed SSL | Web CMS | 500 BDT | Automated CNAME/A record mapping (`schoolname.edu.bd`) with automated Let's Encrypt TLS provisioning. |
| `module_whatsapp_alerts` | Automated WhatsApp Absentee Alerts | Communications | 600 BDT | Instant automated notification sent to verified guardian phone when child is marked absent during morning roll call. |

---

## 4. Usage Quotas & Add-ons

Service usage beyond bundled limits is billed on an exact consumption basis.

| Add-on Key | Add-on Name | Unit Price (BDT) | Bundle Size | Description |
| :--- | :--- | :--- | :--- | :--- |
| `sms_bundle_500` | SMS Communication Pack | 175.00 BDT | 500 SMS | 0.35 BDT per SMS across GreenWeb, Osel, and SSL Wireless adapters. |
| `ai_tokens_500k` | Gemini AI Model Tokens | 250.00 BDT | 500,000 Tokens | High-quota token expansion for automated curriculum lesson planning and question paper composition. |

---

## 5. Capacity Quotas & Hard Limits

| Resource Metric | Free Trial | School Starter | School Growth | School Pro | Unified Pro |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Max Active Students** | 50 | 100 | 500 | 1,500 | 2,500 |
| **Monthly AI Question Quota** | 30 | 100 | 500 | 2,000 | 5,000 |
| **Cloud Storage Cap** | 1 GB | 5 GB | 25 GB | 100 GB | 250 GB |
| **Campus Branches** | 1 | 1 | 1 | 5 | 10 |
| **Concurrent Workspaces** | School only | School only | School only | School only | School + Academy |

---

## 6. Subscription Lifecycle & Grace Period Policy

The platform implements non-destructive dunning and suspension to prevent data loss for educational institutions:

1. **`TRIALING`**: 14-day evaluation period. All Core modules + 30 AI questions available.
2. **`ACTIVE`**: Paid subscription. Full access to entitled modules and student quotas.
3. **`GRACE_PERIOD`**: 7-day grace period triggered when renewal payment is past due. Full operational access continues while administrative reminders are issued.
4. **`SUSPENDED`**: Triggered if grace period lapses without payment. **Non-destructive read-only fallback mode** is enforced:
   - Read-only features (`student_directory`, `report_cards`, `attendance_view`, `school_profile`) remain completely accessible.
   - Write actions (admitting new students, publishing exams, generating AI blueprints, modifying fee schedules) are rejected with HTTP 403 `SUBSCRIPTION_SUSPENDED`.
5. **`EXPIRED`**: Terminated state requiring manual reactivation by Platform Super Admin or successful gateway checkout.

