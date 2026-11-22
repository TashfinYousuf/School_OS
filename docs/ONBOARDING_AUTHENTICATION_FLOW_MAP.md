# EducationOS — Onboarding & Authentication Architecture Flow Map
**Document ID:** `docs/ONBOARDING_AUTHENTICATION_FLOW_MAP.md`  
**Generated:** 2026-11-09  
**Execution Standard:** Section C (Phase 1) Master Engineering Directive  
**Status:** **CANONICAL & UNIFIED (ZERO CONFLICTING PATHS)**  

---

## 1. Executive Architecture Overview

Prior to Phase 1, the platform exhibited two competing registration paths:
1. `/onboard`: Captured marketing metadata without account credentials and presented an unpersisted brochureware message redirecting to `/login`.
2. `/login`: Contained a 4th tab (`New School`) with a separate form calling `/api/v1/auth/register-school`.

This created a severe user experience regression where users completing `/onboard` arrived at `/login` with no account created, only to be confronted with a second registration form.

### The Unified Canonical Journey
```
[Public Website / Pricing CTA]
               │
               ▼
[Canonical /onboard Wizard]
   ├── Step 1: Modality & Plan Selection (K-12, College, Academy)
   ├── Step 2: Institution Profile (Name, Phone, Campus Address)
   ├── Step 3: Administrator Credentials (Name, Email, Strong Password)
   └── Draft Auto-Save: Persisted in sessionStorage across refreshes
               │
               ▼
[POST /api/v1/auth/register-school]
   ├── Atomic Provisioning: Tenant UUID, SchoolProfile, Admin User, Default Roles
   ├── Cryptographic JWT Issuance: Access Token (1hr) + Refresh Token (Session Registry)
   └── Client Auto-Login: localStorage session established & auth-changed dispatched
               │
               ▼
[Direct Dashboard Transition: /dashboard]
   └── No login loops, no duplicate forms, immediate workspace access
```

---

## 2. Route & Endpoint Topology

### 2.1 Public & Entry Routes

| URL Route | Primary Audience | Function | Redirection / Action |
| :--- | :--- | :--- | :--- |
| `/` | Prospective Institutions | Product discovery, feature tours, institution benefits | CTAs route to `/onboard` |
| `/pricing` | Decision Makers | Hybrid usage calculator, pricing tiers | CTAs route to `/onboard?plan={plan_id}` |
| `/onboard` | New Institutions | **The ONLY Canonical Onboarding Route** | Executes `POST /api/v1/auth/register-school`, establishes session, directs to `/dashboard` |
| `/login` | Existing Users | Unified 3-tab portal (Staff, Student, Parent) | Authenticates existing accounts. Contains callout link to `/onboard` |
| `/login?tab=register` | Legacy Links | Deprecated link handler | Automatically redirected to `/onboard` via `router.replace` |

---

### 2.2 Backend Authentication & Provisioning Endpoints

| Endpoint | Method | Input Schema | Response | Target Role |
| :--- | :---: | :--- | :--- | :---: |
| `/api/v1/auth/register-school` | `POST` | `school_name`, `admin_name`, `admin_email`, `admin_password`, `contact_phone`, `address`, `invite_code` | `{ access_token, refresh_token, tenant_id, role: "admin", school_code }` | `admin` (Provisioned) |
| `/api/v1/auth/staff` | `POST` | `email`, `password`, `school_code` (optional) | `{ access_token, refresh_token, tenant_id, role, name }` | `admin`, `teacher` |
| `/api/v1/auth/student` | `POST` | `admission_number`, `password`, `school_code` (optional) | `{ access_token, refresh_token, tenant_id, role: "student", student_id }` | `student` |
| `/api/v1/auth/guardian` | `POST` | `admission_number`, `phone_number`, `school_code` (optional) | `{ access_token, refresh_token, tenant_id, role: "guardian", name }` | `guardian` |
| `/api/v1/auth/refresh` | `POST` | `refresh_token` | `{ access_token, refresh_token }` (Rotated) | All Authenticated |
| `/api/v1/auth/logout` | `POST` | `refresh_token` (optional) | `{ message: "Logged out" }` (Session Revoked) | All Authenticated |

---

## 3. Session Storage & Security Invariants

1. **Tokens in Secure Storage:**
   - On successful login or onboarding, the client writes:
     - `token` and `access_token`: Short-lived JWT (1 hour).
     - `refresh_token`: Opaque string mapped to `refresh_token_sessions` in database.
     - `tenant_id`: UUID string governing PostgreSQL RLS.
     - `user_role`: Authorized RBAC role (`admin`, `teacher`, `guardian`, `student`).
     - `school_name`: Institutional branding display string.
2. **Post-Login Routing Invariants:**
   - `admin` → `/dashboard` (Full institutional operations).
   - `teacher` → `/dashboard` (Classroom operations, attendance, grading, routine).
   - `student` → `/dashboard` (Student Study Room, personal routine, report cards; zero admin controls).
   - `guardian` → `/dashboard` (Parent Portal, sibling switcher, attendance gauge, fee balances; zero admin controls).
3. **Draft Persistence & Anti-Loss Invariant:**
   - Active user inputs on `/onboard` are mirrored to `sessionStorage[educationos_onboarding_draft]`.
   - Page refresh, accidental navigation, or temporary network disconnect does not wipe entered institutional details.
   - Cleared automatically immediately upon successful server provisioning.
4. **No Open Redirects:**
   - All redirection destinations are hardcoded internal routes (`/dashboard`, `/login`, `/onboard`).

