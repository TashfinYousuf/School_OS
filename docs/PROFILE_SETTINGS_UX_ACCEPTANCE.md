# EducationOS — Profile & Settings UX Acceptance Report
**Document ID:** `docs/PROFILE_SETTINGS_UX_ACCEPTANCE.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section E (Phase 3) Master Engineering Directive  
**Status:** **RECONSTRUCTED, VERIFIED & ACCEPTED (`PASS`)**  

---

## 1. Executive Summary

Prior to Phase 3, user profile management lacked a dedicated route, and settings were awkwardly fragmented between a small sidebar modal (`SettingsModal.tsx`) and an incomplete page (`/dashboard/settings`). Users could not edit their personal name, update their passwords, or inspect session health.

### Implemented Architecture
1. **Dedicated User Profile Route (`/dashboard/profile`):**
   - Personal identity management: First Name, Last Name.
   - Tenancy attribution: Displaying registered official email, institutional name, campus code, and assigned role.
   - Password change pipeline: Validating old password against server hash, enforcing complexity policies (min 10 chars, letters & digits, max 72 bytes).
   - Session termination: Single-click authenticated logout with instant token revocation.
2. **Reconstructed Settings Architecture (`/dashboard/settings`):**
   - Six structured administrative tabs:
     1. **Institution Profile:** School name, tagline, EIIN/code, campus address, phone, email, academic session.
     2. **Academic & Grading:** NCTB standard 7-tier scale with pass thresholds.
     3. **Student Roster Import:** CSV template download & bulk student enrollment.
     4. **Appearance & Theme:** Light mode, dark mode, system synchronization, and bilingual EN/BN toggle.
     5. **Security Policies:** Kernel RLS, HMAC token lifetime, and bcrypt cost factor specifications.
     6. **Subscription & FinOps:** Active plan status, student volume ceiling, annual 10-month discount formula, and custom quotation request link.
3. **Interactive Header & Navigation Integration:**
   - In `frontend/app/dashboard/layout.tsx`, the top-right profile badge is now an interactive link directly to `/dashboard/profile`.
   - The sidebar bottom navigation provides direct links to "My Profile" and "Settings" (for administrators), eliminating conflicting modals.

---

## 2. API & Endpoint Specifications

| Endpoint | Method | Role Scope | Payload | Action |
| :--- | :---: | :--- | :--- | :--- |
| `/api/v1/users/me` | `GET` | All Authenticated | None | Returns authenticated user's profile |
| `/api/v1/users/me` | `PATCH` | All Authenticated | `first_name`, `last_name` | Updates user name and triggers client session sync |
| `/api/v1/users/me/change-password` | `POST` | All Authenticated | `old_password`, `new_password` | Verifies current password & commits new bcrypt hash |
| `/api/v1/institution/profile` | `GET` | All Authenticated | None | Returns institutional metadata |
| `/api/v1/institution/profile` | `PATCH` | Admin Only | School metadata | Updates institutional campus profile |
| `/api/v1/institution/import-students-csv` | `POST` | Admin Only | Multipart CSV file | Enrolls student roster in batch |

---

## 3. Verification & Acceptance Checklist

- [x] Visiting `/dashboard/profile` renders user initials, full name, role, email, and campus code.
- [x] Submitting personal name edits calls `PATCH /api/v1/users/me` and updates `localStorage[user_name]`.
- [x] Submitting password change validates old password and enforces 10-character letter+digit complexity.
- [x] Mismatched confirmation passwords display clear in-line error feedback.
- [x] Visiting `/dashboard/settings` displays all 6 administrative tabs without hydration mismatches.
- [x] Institutional profile updates persist to database via `PATCH /api/v1/institution/profile`.
- [x] Top-right header avatar is clickable and routes to `/dashboard/profile`.
- [x] Sidebar navigation links directly to `/dashboard/profile` and `/dashboard/settings`.

