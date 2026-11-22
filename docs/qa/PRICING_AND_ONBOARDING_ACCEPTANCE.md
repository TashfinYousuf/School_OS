# EducationOS — Pricing Transparency & Onboarding Redesign Acceptance Evidence

**Date:** 2026-11-16  
**Status:** Remediated & Verified  
**Component:** Onboarding (`/onboard`), Canonical Plan & Module Catalog (`PLAN_MODULE_CATALOG.md`), Server Price Validation  
**Author:** Principal Product Architect & QA Lead  
**Reference Document:** `docs/product/PLAN_MODULE_CATALOG.md`  

---

## 1. Executive Summary

In response to the platform owner's defect report regarding the black-box summary on `/onboard` ("Includes Base Platform + 9 Core Modules + 2 Optional Modules"), we completely redesigned the pricing transparency architecture:

1. **Canonical Catalog:** Published `docs/product/PLAN_MODULE_CATALOG.md` defining all 9 Core Included Modules (at ৳0), 5 Specialized Optional Modules, and Approved Fixed-Tier Plans.
2. **Expandable Core Modules Accordion:** School administrators can now inspect the 9 core modules directly within `/onboard`, reviewing their capabilities, deliverables, and SLAs.
3. **Interactive Optional Modules Customizer:** Administrators can toggle on/off any of the 5 optional modules (`module_ai_assistant`, `module_advanced_finance`, `module_school_website`, `module_custom_domain`, `module_whatsapp_alerts`) with real-time dynamic quote recalculation.
4. **Module Details Modal:** Built an in-depth inspection modal accessible for all 14 modules displaying functional descriptions, security boundaries, and monthly charges.
5. **Pre-Packaged Plan Comparison Modal:** Built a one-click plan comparison modal comparing School Starter (৳990), School Growth (৳2,490), and School Pro (৳5,990) with one-click package selection.
6. **Server-Side Module & Price Binding:** Extended `SchoolRegistrationPayload` to accept `selected_modules`, `billing_cycle`, and `plan_id`, binding the choices directly to workspace activation and initial subscription provisioning.

---

## 2. Structural Module & Transparency Comparison

| Feature | Legacy Behavior | Redesigned Behavior | Acceptance Status |
| :--- | :--- | :--- | :--- |
| **Core Modules Inspection** | Hidden black-box ("+ 9 Core Modules") | Expandable Accordion with all 9 cards + free badge | **VERIFIED PASS** |
| **Optional Modules Customization** | Hardcoded initial 2 modules | Interactive checkboxes for all 5 modules with real-time recalculation | **VERIFIED PASS** |
| **Module Details Dialog** | None | Full modal with capabilities, deliverables, and SLA specs | **VERIFIED PASS** |
| **Plan Comparison Matrix** | None on `/onboard` | Modal comparing Starter, Growth, and Pro tiers with one-click package apply | **VERIFIED PASS** |
| **Server Price Validation** | Ignored custom modules on signup | Backend validates and enables selected modules on created Workspace | **VERIFIED PASS** |
| **Frontend Compilation** | N/A | `npx tsc --noEmit` clean (0 errors) | **VERIFIED PASS** |

---

## 3. Registered Modules Matrix

### Included Core Platform Modules (9 Modules — ৳0 Add-On Cost)
1. `core_admin`: Institution Administration & RBAC
2. `core_students`: Student Directory & Admissions
3. `core_teachers`: Teacher & Staff Management
4. `core_guardians`: Guardian & Parent Portal
5. `core_academic`: Academic Structure & Timetable Routines
6. `core_attendance`: Smart Attendance & Offline Sync
7. `core_exams`: Examinations & Grading Registry
8. `core_notices`: Notices & Communication
9. `core_reports`: Standard Operational Reports

### Customizable Optional Modules (5 Modules — Modular Add-On Pricing)
1. `module_ai_assistant` (+৳1,200/mo): AI Copilot & Question Paper Composer (Gemini 250k tokens)
2. `module_advanced_finance` (+৳800/mo): Dual-Copy Fee Receipts & Bank/bKash Reconciliation
3. `module_school_website` (+৳1,000/mo): Hosted Institutional Public Website
4. `module_custom_domain` (+৳500/mo): Custom Domain DNS Mapping with Automated SSL/TLS
5. `module_whatsapp_alerts` (+৳600/mo): Automated Real-Time WhatsApp Absentee Notifications

