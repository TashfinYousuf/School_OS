# EDUCATIONOS — STAGE 12.5.6 AUTHENTICATION & LOGIN UX SPECIFICATION
**Domain:** Identity, Session Orchestration & Access Flow  
**Status:** IMPLEMENTED AND VERIFIED  
**Author:** Application Security Engineer & Product UX Architect  
**Verification Date:** 9 November 2026

---

## 1. Login Architecture & Persona Segregation

EducationOS serves 4 distinct user classes with clear authentication models:

```
[Unified Login Gateway: /login]
├── 1. Staff Tab (Admins, Principals, Headmasters, Teachers)
│   ├── Identifier: Institutional Email (e.g. admin@school.edu.bd)
│   ├── Credential: Argon2id/Bcrypt Password Hash (10+ characters)
│   ├── Backend Endpoint: POST /api/v1/auth/staff
│   └── Allowed Roles: ["admin", "teacher"]
│
├── 2. Student Tab (Enrolled K-12 Students)
│   ├── Identifier: Student Admission ID (e.g. KS-2026-001)
│   ├── Credential: Student Password (school-assigned credentials)
│   ├── Backend Endpoint: POST /api/v1/auth/student
│   └── Allowed Roles: ["student"]
│
├── 3. Parent / Guardian Tab (Mothers, Fathers, Legal Guardians)
│   ├── Identifier: Student Admission ID (e.g. KS-2026-001)
│   ├── Credential: Registered Mobile Number (e.g. 017XXXXXXXX)
│   ├── Normalization: Supports both ASCII and Bangla digits (০১২৩৪৫৬৭৮৯)
│   ├── Backend Endpoint: POST /api/v1/auth/guardian
│   └── Allowed Roles: ["guardian"]
│
└── 4. New Institution Onboarding Tab (Prospective School Principals)
    ├── Self-service school registration, admin user provisioning, and tenant initialization
    └── Backend Endpoint: POST /api/v1/auth/register-school
```

---

## 2. Security Invariants & Hardening Measures

1. **Role Containment**:
   - `ALLOWED_ROLES` mapping enforces that a login route only accepts tokens belonging to its authorized persona. A teacher attempting to sign in on the student tab is rejected before session creation.
2. **Session Storage Hygiene**:
   - `persistSession()` removes all prior session keys before setting fresh credentials:
     - `access_token`, `refresh_token`, `user_role`, `user_name`, `tenant_id`, `student_id`, `active_workspace_id`.
   - Dispatches `auth-changed` event to re-synchronize client application context.
3. **Bangla Numeral Normalization**:
   - Parents entering mobile numbers using Bengali numerals (e.g., `০১৭১১২২৩৩৪৪`) are automatically normalized to ASCII standard (`01711223344`) on both client and server before verification.
4. **Timing Attack Protection**:
   - When an account is not found during staff authentication, a dummy hash calculation (`_DUMMY_HASH`) is executed to ensure constant execution time, preventing email enumeration.
5. **Rate Limiting**:
   - Bounded in-memory sliding window rate limiter protects endpoints against brute-force attacks, returning HTTP 429 with `Retry-After`.

