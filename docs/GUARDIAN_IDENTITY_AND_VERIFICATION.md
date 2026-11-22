# EducationOS — Guardian Identity & Verification Architecture
**Document ID:** `docs/GUARDIAN_IDENTITY_AND_VERIFICATION.md`  
**Date:** 2026-11-11  
**Status:** ARCHITECTURAL SPECIFICATION & GOVERNANCE  
**Auditors:** Principal Product Architect, Identity & Access Management Engineer, Database Architect  

---

## 1. Core Guardian Identity Principles

1. **Independent IAM Identity:** A Guardian account is a dedicated `User` entity (`users` table with `role = "guardian"`). It possesses its own credentials (email or phone number + password + optional MFA/OTP).
2. **No Admission-Number Conflation:** Guardians log in with their OWN credentials, never by submitting their child's admission ID.
3. **Relational Many-to-Many Binding:** Guardians and Students are linked exclusively via the verified join table `student_guardians` (`GuardianStudentLink`).
4. **Zero Implicit Access:** A phone number matching a student's contact field NEVER automatically grants guardian portal access. Access requires an explicitly verified relational link.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GUARDIAN RELATIONSHIP TOPOLOGY                       │
│                                                                        │
│   ┌────────────────────────┐              ┌────────────────────────┐   │
│   │   Student A (Class 3)  │              │   Student B (Class 7)  │   │
│   │   Record ID: 101       │              │   Record ID: 102       │   │
│   └───────────▲────────────┘              └───────────▲────────────┘   │
│               │                                       │                │
│   ┌───────────┴───────────────────────────────────────┴────────────┐   │
│   │             Join Table: student_guardians                      │   │
│   │  • Link 1: Guardian X -> Student A (Mother, Status: VERIFIED)  │   │
│   │  • Link 2: Guardian X -> Student B (Mother, Status: VERIFIED)  │   │
│   │  • Link 3: Guardian Y -> Student A (Father, Status: VERIFIED)  │   │
│   └───────────────────────────▲────────────────────────────────────┘   │
│                               │                                        │
│               ┌───────────────┴───────────────┐                        │
│               │   Guardian X Application User │                        │
│               │   (Mother: Verified Account)  │                        │
│               └───────────────────────────────┘                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Canonical Relationship State Machine

Every link between a guardian and a student transitions through an audited lifecycle:

```
                  ┌──────────────────────────────┐
                  │    PENDING_VERIFICATION      │
                  │ (Self-registration/request) │
                  └──────────────┬───────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
       ┌──────────────────┐            ┌──────────────────┐
       │     VERIFIED     │            │     REJECTED     │
       │ (Access Granted) │            │ (Access Denied)  │
       └─────────┬────────┘            └──────────────────┘
                 │
                 ▼
       ┌──────────────────┐
       │     REVOKED      │
       │ (Access Blocked) │
       └──────────────────┘
```

### Relationship States:
- `PENDING_VERIFICATION`: Relationship requested by parent or staff; no data access permitted.
- `VERIFIED`: Formally confirmed by school admissions, administrative document check, or verified SMS link; grants access to student's academic, attendance, and fee statements.
- `REJECTED`: Disapproved by school staff (e.g., fraudulent request, incorrect child ID).
- `REVOKED`: Previously valid relationship terminated (e.g., custody update, transfer, family request); access revoked instantaneously across all active sessions.
- `EXPIRED`: Student graduated or transferred; archive read-only status.

---

## 3. Guardian Account Provisioning & Linking Flow

### Scenario A: Official School Admission (Standard)
1. Parent submits student admission form containing guardian details (Full Name, Relationship, Phone, NID).
2. School reviews documentation and clicks **Enroll**.
3. System checks if a Guardian record with this verified phone/NID already exists in this tenant:
   - If exists: Reuses `Guardian.id`.
   - If not exists: Provisions `Guardian` entity and corresponding `User` account (`role="guardian"`).
4. System creates `GuardianStudentLink` with `verification_status = "VERIFIED"` and `verification_method = "OFFICIAL_ADMISSION"`.
5. System triggers an activation invitation token to the parent's phone/email.
6. Parent activates account and sets permanent guardian password.

### Scenario B: Existing Parent Linking a Sibling
1. Logged-in parent navigates to `/guardian/children/link-request`.
2. Parent inputs sibling's school code, admission number, and birth certificate number.
3. System creates a `GuardianStudentLink` with `verification_status = "PENDING_VERIFICATION"`.
4. School administration reviews the link request against physical institutional records.
5. Once approved by admin, status transitions to `"VERIFIED"`, and the child immediately appears in the parent's portal child selector.

---

## 4. Multi-Child Experience & Session Context

- **Persistent Child Context:** When a guardian has multiple verified children, the selected child is stored in the client session context (`selected_child_id`).
- **Server-Side Enforcement:** Every query (e.g. `/api/v1/guardians/me/children/{student_id}/attendance`) re-validates:
  $$\text{SELECT } 1 \text{ FROM student\_guardians WHERE guardian\_id} = :uid \text{ AND student\_id} = :sid \text{ AND verification\_status} = \text{'VERIFIED'}$$
- If the relationship is invalid, missing, or revoked, the server immediately returns **HTTP 403 Forbidden**.

