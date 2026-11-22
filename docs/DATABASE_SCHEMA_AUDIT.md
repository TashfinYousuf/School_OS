# EducationOS Database Schema & Migration Audit

**Audit Date:** 2026-11-01  
**Auditor:** Principal Software Architect  
**Scope:** `backend/app/models/`, `backend/alembic/`, `backend/app/core/database.py`, `backend/app/core/tenant_guard.py`  
**Application Target:** Release Candidate 1 (RC1)

---

## 1. Executive Summary & Architecture Overview

EducationOS uses PostgreSQL (tested against Supabase and CockroachDB) managed via **SQLAlchemy 2.0 ORM** and **Alembic** migrations. Multi-tenancy is architected as a pooled single-database model with discriminator columns (`tenant_id`) enforced through a dual layer:
1. **Application-Layer ORM Guard:** An event listener on `do_orm_execute` in `backend/app/core/tenant_guard.py` that intercepts SELECT, UPDATE, and DELETE statements and injects `WHERE tenant_id = :tenant_id`.
2. **Database-Layer Native RLS:** PostgreSQL Row-Level Security policies checking `tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.

### Systemic Database Defects Discovered:
1. **Broken Alembic Migration DAG (Severed Revision Chain):**
   - Migration file `backend/alembic/versions/xxxx_enforce_native_rls.py` defines:
     ```python
     # revision identifiers, used by Alembic.
     revision = 'b471c910283f'
     down_revision = 'a829f0c2e91a'  # DOES NOT EXIST!
     ```
   - No migration with revision `a829f0c2e91a` exists in `backend/alembic/versions/`.
   - Running `alembic upgrade head` aborts immediately with `alembic.util.exc.CommandError: Can't locate revision identified by 'a829f0c2e91a'`. The database migration pipeline cannot be deployed from scratch.
2. **Migration References Nonexistent Table:**
   - `xxxx_enforce_native_rls.py` attempts to apply RLS policy to `attendance_records`:
     ```sql
     ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
     CREATE POLICY tenant_isolation_policy ON attendance_records ...
     ```
   - The declarative SQLAlchemy model in `backend/app/models/attendance.py` defines:
     ```python
     __tablename__ = "attendance_events"
     ```
   - Running the RLS migration against a freshly migrated database fails with `psycopg2.errors.UndefinedTable: relation "attendance_records" does not exist`.
3. **Column Type Inconsistencies for `tenant_id`:**
   - Some models define `tenant_id` as `Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)`.
   - Other models (e.g. `audit_log.py`, `communication.py`) define `tenant_id` as `Column(String(36), nullable=False)`.
   - This causes type-casting mismatches in PostgreSQL joins, degrades indexing performance, and breaks RLS policies that cast `app.current_tenant_id` strictly to `::uuid`.
4. **Code References Nonexistent Model Attributes:**
   - `backend/app/api/endpoints/users.py` queries `User.deleted_at.is_(None)`. The `User` model in `backend/app/models/user.py` contains `is_active = Column(Boolean, default=True)` but **no `deleted_at` column**.
   - `backend/app/api/endpoints/tenants.py` queries `Tenant.deleted_at.is_(None)`. The `Tenant` model in `backend/app/models/tenant.py` contains `status = Column(String)` but **no `deleted_at` column**.
   - These queries fail at runtime with unhandled 500 `AttributeError` exceptions.
5. **Universal Multi-Tenant RLS Bypass:**
   - `backend/app/core/tenant_guard.py` checks:
     ```python
     tenant_id = db_session.info.get("tenant_id")
     if not tenant_id:
         return
     ```
   - Because all endpoint routers import `get_db` from `backend/app/core/database.py` (which never sets `db_session.info["tenant_id"]` and never executes `SET LOCAL app.current_tenant_id`), **every database operation completely bypasses both the ORM tenant filter and the PostgreSQL RLS policy**.

---

## 2. Model & Table Inventory

### Status Key:
- **VERIFIED COMPLETE**: Schema properly defined with primary keys, valid foreign keys, indexed `tenant_id`, and active test verification.
- **PARTIALLY IMPLEMENTED**: Model exists and functions, but missing crucial indexes, cascade definitions, or nullable constraints.
- **IMPLEMENTED BUT UNVERIFIED**: Model written to specifications, but lacks schema migration history or integrity testing.
- **NOT IMPLEMENTED**: Table referenced in design docs or migrations but missing in SQLAlchemy models.
- **BROKEN**: Missing referenced columns, severed relationships, or causes runtime SQL exceptions.

| Table Name | Model Class (`backend/app/models/`) | Primary Key | Tenant ID Column & Type | Foreign Key Constraints | Status | Core Schema Findings |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `tenants` | `Tenant` (`tenant.py`) | `UUID(as_uuid=True)` | N/A (Root Entity) | None | **PARTIALLY IMPLEMENTED** | Lacks `deleted_at` column required by `endpoints/tenants.py`. Missing unique index on `domain` slug. |
| `users` | `User` (`user.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=True) | `tenants.id` | **BROKEN** | Lacks `deleted_at` column queried by `endpoints/users.py`. Nullable `tenant_id` enables tenant-less users without fallback safeguards. |
| `students` | `Student` (`student.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id`, `users.id` | **VERIFIED COMPLETE** | Indexed on `(tenant_id, admission_number)`. Enforces uniqueness per tenant. |
| `guardians` | `Guardian` (`guardian.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id`, `users.id` | **VERIFIED COMPLETE** | Correctly maps one-to-many relationship with students via junction table `student_guardians`. |
| `attendance_events`| `AttendanceEvent` (`attendance.py`)| `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `students.id`, `classes.id` | **BROKEN** | Table named `attendance_events` in ORM, but Alembic RLS migration references `attendance_records`, breaking migrations. |
| `fee_structures`| `FeeStructure` (`fee.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id`, `classes.id` | **VERIFIED COMPLETE** | Configures monthly fee heads, amounts, and late fee grace periods. |
| `fee_invoices` | `FeeInvoice` (`fee.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `students.id`, `fee_structures.id` | **VERIFIED COMPLETE** | Tracks total amount, paid amount, due balance, and payment status (`PAID`, `PARTIAL`, `OVERDUE`). |
| `payment_transactions`| `PaymentTransaction` (`fee.py`)| `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `fee_invoices.id` | **PARTIALLY IMPLEMENTED** | Records transaction references. Lacks uniqueness constraint on external gateway `transaction_id`, enabling replay attacks. |
| `subscriptions`| `Subscription` (`subscription.py`)| `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **PARTIALLY IMPLEMENTED** | Stores plan tier and expiry. Duplicated across `billing.py` and unmounted `subscriptions.py`. |
| `payment_intents`| `PaymentIntent` (`payment_intent.py`)| `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **IMPLEMENTED BUT UNVERIFIED**| Tracks pending checkout intents with expiration timestamps. |
| `classes` | `ClassRoom` (`academic.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **VERIFIED COMPLETE** | Contains class name, section, and academic year. |
| `subjects` | `Subject` (`academic.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `classes.id` | **VERIFIED COMPLETE** | Tracks subject code, credit hours, and assigned teacher. |
| `class_routines`| `ClassRoutine` (`routine.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `classes.id`, `subjects.id`, `users.id` | **VERIFIED COMPLETE** | Stores day of week, start time, end time, and room number. |
| `exams` | `Exam` (`exam.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id`, `classes.id` | **VERIFIED COMPLETE** | Tracks exam title, start date, end date, and total marks. |
| `exam_results` | `ExamResult` (`result.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `exams.id`, `students.id`, `subjects.id` | **VERIFIED COMPLETE** | Stores marks obtained, grade, and GPA. Missing composite unique index on `(exam_id, student_id, subject_id)`. |
| `question_papers`| `QuestionPaper` (`question_paper.py`)| `UUID(as_uuid=True)`| `tenant_id` (UUID, nullable=False) | `exams.id`, `subjects.id` | **PARTIALLY IMPLEMENTED** | Stores AI-generated JSON question structures. Defaults `is_published=False`. |
| `academy_batches`| `AcademyBatch` (`academy.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **VERIFIED COMPLETE** | Tracks batch name, max capacity, enrolled count, and fee schedule. |
| `academy_exams` | `AcademyExam` (`academy.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `academy_batches.id` | **VERIFIED COMPLETE** | Configures MCQ live exams with duration and negative marking parameters. |
| `academy_results`| `AcademyExamResult` (`academy.py`)| `UUID(as_uuid=True)`| `tenant_id` (UUID, nullable=False) | `academy_exams.id`, `students.id` | **PARTIALLY IMPLEMENTED** | Stores candidate answers and calculated score. Lacks lock on concurrent submission. |
| `notices` | `Notice` (`notice.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **VERIFIED COMPLETE** | Notice board announcements with target audience filters. |
| `approval_requests`| `ApprovalRequest` (`approval.py`)| `UUID(as_uuid=True)`| `tenant_id` (UUID, nullable=False) | `tenants.id`, `users.id` | **BROKEN** | Status enum mismatch between model (`"Pending"`) and dashboard filter (`"pending_review"`). |
| `messages` | `Message` (`communication.py`) | `UUID(as_uuid=True)` | `tenant_id` (`String(36)`) | `users.id` | **PARTIALLY IMPLEMENTED** | **Type Mismatch:** Uses `String(36)` instead of native `UUID`, breaking PostgreSQL RLS cast. |
| `campuses` | `Campus` (`campus.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **IMPLEMENTED BUT UNVERIFIED**| Multi-branch campus management table. |
| `teacher_diaries`| `TeacherDiary` (`teacher_diary.py`)| `UUID(as_uuid=True)`| `tenant_id` (UUID, nullable=False) | `classes.id`, `users.id` | **IMPLEMENTED BUT UNVERIFIED**| Stores daily teacher logs and homework notes. |
| `workspaces` | `Workspace` (`workspace.py`) | `UUID(as_uuid=True)` | `tenant_id` (UUID, nullable=False) | `tenants.id` | **VERIFIED COMPLETE** | Multi-institution workspace container. |
| `workspace_memberships`| `WorkspaceMembership` (`workspace.py`)| `UUID(as_uuid=True)`| `tenant_id` (UUID, nullable=False) | `workspaces.id`, `users.id` | **BROKEN** | Correct model name is `WorkspaceMembership`, but `workspaces.py` router attempts to import `InstitutionalMembership`, breaking router load. |
| `audit_logs` | `AuditLog` (`audit_log.py`) | `UUID(as_uuid=True)` | `tenant_id` (`String(36)`) | None | **PARTIALLY IMPLEMENTED** | Uses `String(36)` for `tenant_id`. Logs user action, IP address, and payload diffs. |

---

## 3. Alembic Migration Analysis

Inspection of `backend/alembic/versions/`:
- **Current Head Migrations:**
  - `d771a4257381_...`: Initial base schema.
  - `b471c910283f` (`xxxx_enforce_native_rls.py`):
    - **Fatal Error:** `down_revision = 'a829f0c2e91a'` references a nonexistent commit ID.
    - **Fatal Error:** DDL executes `ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;`, but the table created by the base schema is `attendance_events`.

```sql
-- Failing DDL excerpt from backend/alembic/versions/xxxx_enforce_native_rls.py
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON attendance_records
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
-- ERROR: relation "attendance_records" does not exist!
```

---

## 4. Multi-Tenant Isolation Mechanism Breakdown

### 4.1 Application-Layer Guard (`backend/app/core/tenant_guard.py`)
```python
@event.listens_for(Session, "do_orm_execute")
def _add_filtering_criteria(execute_state):
    if not execute_state.is_select and not execute_state.is_update and not execute_state.is_delete:
        return
    
    db_session = execute_state.session
    tenant_id = db_session.info.get("tenant_id")
    
    # CRITICAL FLAW: Silent return when tenant_id is None
    if not tenant_id:
        return  # Query proceeds with NO WHERE tenant_id clause!
```
- When `tenant_id` is missing, the hook silently permits cross-tenant queries.
- Because `backend/app/core/database.py::get_db` never injects `tenant_id` into `db.info`, **all queries run unrestricted across the entire database**.

### 4.2 Database-Layer Native RLS
- PostgreSQL native RLS relies on the connection setting `app.current_tenant_id`.
- The database connection pool (`engine`) is shared across tenants.
- Because `core.database.get_db` never executes `SET LOCAL app.current_tenant_id = ...`, PostgreSQL RLS policies evaluate `current_setting('app.current_tenant_id', true)` as `NULL`, causing either zero records returned or an RLS bypass if policies are marked `PERMISSIVE` without strict default-deny.

---

## 5. Database Remediation Plan

1. **Repair Alembic Revision Tree:**
   - Locate the true parent revision for `xxxx_enforce_native_rls.py` and update `down_revision`.
   - Correct table names in the RLS migration (`attendance_records` -> `attendance_events`).
2. **Harmonize Model Attributes with Endpoints:**
   - Add `deleted_at = Column(DateTime(timezone=True), nullable=True)` to `User` and `Tenant` models, or update endpoints in `users.py` and `tenants.py` to filter by `is_active == True`.
3. **Standardize `tenant_id` Data Types:**
   - Convert all `tenant_id` columns defined as `String(36)` (`audit_logs`, `messages`) to native PostgreSQL `UUID(as_uuid=True)` with foreign keys referencing `tenants.id`.
4. **Fix Session Tenant Injection:**
   - Update `app.core.database.get_db` or standardize all endpoints onto `app.api.deps.get_db` so that `db.info["tenant_id"]` is unconditionally populated and `SET LOCAL app.current_tenant_id` is executed per transaction.
5. **Add Missing Composite Indexes:**
   - Add composite indexes on `(tenant_id, created_at)` across high-volume tables (`attendance_events`, `payment_transactions`, `exam_results`).

