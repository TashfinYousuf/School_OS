# EducationOS — Student Identity & Account Provisioning Specification
**Document ID:** `docs/STUDENT_IDENTITY_AND_PROVISIONING.md`  
**Date:** 2026-11-11  
**Status:** ARCHITECTURAL SPECIFICATION & GOVERNANCE  
**Auditors:** Principal Product Architect, Identity & Access Management Engineer, Database Architect  

---

## 1. Core Identity Architecture

In EducationOS, academic records and authentication identities are strictly segregated into independent architectural concerns:

1. **Student Academic Record (`students` table):** Contains institutional registry data (admission number, roll number, class, section, date of birth, gender, blood group, academic history).
2. **Student Application Identity (`users` table):** Contains the cryptographic authentication principal (user ID, tenant ID, unique username, email, password hash, role="student", account active state).
3. **Student Account Linkage:** `Student.user_id` holds a foreign key reference to `User.id`. An academic record without an application account is an unprovisioned student.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   STUDENT IDENTITY SEPARATION                          │
│                                                                        │
│   ┌───────────────────────────┐       ┌────────────────────────────┐   │
│   │   Student Academic Record │       │ Student Application User   │   │
│   │   (Table: students)       │       │ (Table: users)             │   │
│   ├───────────────────────────┤       ├────────────────────────────┤   │
│   │ • id (UUID)               │       │ • id (UUID)                │   │
│   │ • tenant_id (SafeUUID)    │       │ • tenant_id (UUID)         │   │
│   │ • admission_number        │◄──────┤ • username (Unique/Tenant) │   │
│   │ • class_name, section     │       │ • email (@students.local)  │   │
│   │ • roll_number             │       │ • password_hash (Argon2id) │   │
│   │ • user_id (FK to users)   │──────►│ • role: "student"          │   │
│   └───────────────────────────┘       │ • must_change_password     │   │
│                                       └────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Student Account Provisioning Lifecycle

When a student is enrolled (via `/admissions` or administrative bulk import):

### Step 1: Institutional Username Generation
- A predictable, collision-free, institution-scoped username is formatted:
  $$\text{Username} = \text{SCHOOL\_CODE} + \text{"-"} + \text{ADMISSION\_NUMBER}$$
  *(e.g., `KSS-STD-2026-0042`)*
- Admission numbers are **public identifiers, not authentication secrets**.

### Step 2: Account Record Creation
- A row is inserted into `users`:
  - `tenant_id`: Student's school tenant ID.
  - `username`: The generated institutional username.
  - `email`: Structured as `{username}@{tenant_slug}.students.internal` (RFC-compliant internal mailbox).
  - `role`: `"student"`.
  - `password_hash`: High-entropy unguessable random placeholder hash until activation.
  - `is_active`: `False` (pending activation) or `True` with `must_change_password = True`.
- `Student.user_id` is linked to the newly created `User.id`.

### Step 3: Cryptographic Activation Invitation Generation
- An activation token is generated using cryptographically strong pseudo-random bytes:
  $$\text{Token} = \text{secrets.token\_urlsafe}(32) \quad (256\text{-bit entropy})$$
- The SHA-256 hash of the token is computed and stored in `account_invitations`:
  - `token_hash`: `hashlib.sha256(token.encode()).hexdigest()`
  - `tenant_id`: Student's tenant ID
  - `student_id`: Student's record ID
  - `user_id`: Newly created User account ID
  - `target_role`: `"student"`
  - `expires_at`: $\text{now} + 72\text{ hours}$
  - `is_consumed`: `False`
- **Zero Plaintext Admin Storage:** The raw token is NEVER stored in the database.

### Step 4: Delivery & Activation
- **Delivery Channels:**
  - **Channel A (Digital):** Secure activation link delivered to guardian's verified email/SMS:  
    `https://educationos.xyz/activate?token=<RAW_TOKEN>`
  - **Channel B (Physical Slip):** For institutions without SMS gateways, a printable single-use QR code or activation voucher containing the secure activation link is handed to the parent/student during enrollment.
- **Activation Flow:**
  1. Student/Parent opens `/activate?token=...`.
  2. Frontend submits `token` and requested new permanent password.
  3. Server hashes token with SHA-256 and retrieves `account_invitations` row.
  4. Server validates: `is_consumed == False`, `expires_at > now()`, matching `tenant_id`.
  5. Server hashes new password via `get_password_hash()` (bcrypt / argon2) and updates `users.password_hash`.
  6. Server sets `users.is_active = True`, `users.must_change_password = False`.
  7. Server marks invitation `is_consumed = True`, `consumed_at = now()`.
  8. Activation event is written to `audit_logs`.

---

## 3. Re-invitation and Invalidation Rules

1. **Supersession:** Requesting a new activation invitation immediately invalidates all previous unconsumed invitations for that student (`UPDATE account_invitations SET is_consumed = TRUE, revoked_at = NOW() WHERE student_id = :id`).
2. **Replay Protection:** Submitting a consumed or expired token returns a generic HTTP 400 error: `"Invalid or expired activation link. Please request a new invitation from your school administration."`
3. **No Password Exposure:** Administrators can click "Resend Activation", but can NEVER view or generate arbitrary static passwords for students.

