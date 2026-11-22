# EducationOS — Legacy Student & Guardian Account Migration Runbook
**Release Track:** RC3 — Academic & Experience Transformation  
**Status:** Canonical Operations Manual  
**Last Updated:** November 2026  

---

## 1. Executive Summary & Objective

With the expansion of EducationOS to cover the complete Bangladesh academic domain (Class 1 through 12, Pre-Primary, Madrasha, and TVET) and the rollout of dedicated Student & Guardian Portal workflows, existing student records and parent phone contacts stored in legacy flat records must be safely linked to authenticated user accounts without data loss, downtime, or cross-tenant leakage.

This runbook defines the end-to-end reconciliation and migration process for:
1. Associating legacy unlinked `Student` entities with authenticated `User` credentials.
2. Linking guardian phone numbers to verified `Guardian` profile entities and `GuardianStudentLink` records.
3. Preserving multi-tenant isolation (`tenant_id`) and historical enrollment continuity (`StudentEnrollmentHistory`).
4. Non-destructive backfills adhering to schema migration `407a7716be83`.

---

## 2. Schema Architecture & Data Mapping

### 2.1 Core Entities & Linkage Matrix

| Entity | Primary Key | Key Foreign Keys | Purpose |
| :--- | :--- | :--- | :--- |
| `users` | `id` (UUID) | `tenant_id` | Authentication credential (`email`, `phone_number`, `password_hash`, `role`) |
| `students` | `id` (UUID) | `tenant_id`, `user_id` (nullable) | Student demographic & academic digital twin |
| `guardians` | `id` (UUID) | `tenant_id`, `user_id` | Guardian identity & primary mobile contact |
| `guardian_student_links` | `id` (UUID) | `tenant_id`, `guardian_id`, `student_id` | Verifiable relationship (`FATHER`, `MOTHER`, `LEGAL_GUARDIAN`) |
| `student_enrollment_history` | `id` (UUID) | `tenant_id`, `student_id` | Longitudinal academic record across years and classes |

### 2.2 Nullable Transition Guarantee
Under migration `407a7716be83`:
- `students.user_id` remains nullable to prevent orphan record crashes during incremental onboarding.
- `students.stream_group` defaults to `GENERAL` for Classes 1–8 and supports `SCIENCE`, `HUMANITIES`, `BUSINESS_STUDIES` for Classes 9–12.
- `students.version` column enforces optimistic locking on parallel updates.

---

## 3. Migration Procedure

### Phase A: Pre-Migration Snapshot & Validation
1. Verify database integrity and active migration head:
   ```bash
   cd backend
   alembic current
   # Expected head: 407a7716be83
   ```
2. Export isolated tenant snapshot:
   ```sql
   -- Verify count of unlinked students
   SELECT tenant_id, COUNT(*) AS unlinked_students
   FROM students
   WHERE user_id IS NULL
   GROUP BY tenant_id;
   ```

### Phase B: Reconciliation & Batch Account Provisioning
1. **Automated User Credential Generation**:
   For students possessing a valid admission number or emergency phone, the provisioning pipeline generates an institutional identifier:
   - Login ID: `{admission_number}@{school_slug}.educationos.bd` (or direct mobile for guardians).
   - Temporary activation secret hashed with bcrypt (cost factor >= 12).
   - Status set to `PENDING_ACTIVATION`.

2. **Guardian Linkage Deduplication**:
   - Queries `students.emergency_contact` and `students.guardian_phone`.
   - Groups matching phone numbers under one `guardians` record per tenant.
   - Inserts idempotent rows into `guardian_student_links` with verification status `VERIFIED` if matched to admission records.

### Phase C: Longitudinal Academic History Seeding
For all existing students:
- Insert an initial snapshot record into `student_enrollment_history`:
  - `academic_year`: Current active session (e.g. `2026`).
  - `class_name`: Student's current `class_name`.
  - `section`: Student's current `section`.
  - `roll_number`: Student's current `roll_number`.
  - `enrollment_status`: `ENROLLED`.
  - `stream_group`: Assigned stream or `GENERAL`.

---

## 4. Rollback & Disaster Recovery Strategy

1. **Transaction Atomicity**:
   All batch reconciliation steps must be wrapped in explicit transactions with tenant-level locks:
   ```sql
   SELECT pg_advisory_xact_lock(hashtext('migration:' || tenant_id::text));
   ```
2. **Reversibility**:
   In the event of an activation dispute:
   - `students.user_id` can be set back to `NULL` without deleting demographic or payment records.
   - Linked user status can be flipped to `SUSPENDED` instantly via `PATCH /api/v1/auth/users/{id}`.
   - Financial ledger entries (`payments`, `invoices`) are permanently immutable and reference `student_id`, safeguarding revenue data from authentication changes.

---

## 5. Security & Verification Checklist

- [x] Multi-tenant scoping verified: Every query strictly scopes `tenant_id`.
- [x] Zero plain-text credentials in logs or transient tables.
- [x] RLS enabled on `student_enrollment_history` and `guardian_student_links`.
- [x] Offline attendance idempotency preserved via `sync_idempotency_key`.
- [x] Tested against Kids Shine pilot and high-scale institutional datasets.

