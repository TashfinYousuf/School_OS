# GLOBAL UNIQUE IDENTIFIER ACCEPTANCE REPORT (DEF-09)

## 1. Overview
- **Issue:** DEF-09 — Student admission IDs were previously required to be manually entered, or synthesised on the client with timestamp fragments (`Date.now()`). The owner required automatically generated, unique institutional identifiers.
- **Resolution:**
  - Implemented centralized `app.core.identity.generate_student_uid(db, tenant_id, academic_year, class_name)` providing deterministic sequential institutional IDs (`STU-{YEAR}-{SEQ:04d}`) with cryptographic collision-resistant fallback (`STU-{YEAR}-{HEX_6}`).
  - Updated `StudentAdmissionPayload` to make `admission_number` optional (`Optional[str] = None`).
  - Updated `admit_student` endpoint (`POST /api/v1/students/admit`) to automatically assign a unique tenant-scoped identifier when not explicitly provided.
  - Updated `StudentBulkImportRequest` and `bulk_import_students` to auto-assign IDs for rows omitting admission numbers.
  - Updated `frontend/app/dashboard/students/page.tsx` Admission Wizard to inform users of auto-assigned unique IDs and removed client-side timestamp fabrication.

## 2. API Contract & Tenant Isolation
- **Endpoint:** `POST /api/v1/students/admit`
  - Body: `StudentAdmissionPayload` (additive: `admission_number` is optional).
  - Uniqueness constraint: Checked against `Student.tenant_id == current_tenant_id` ensuring cross-tenant collision immunity.
  - Response: Always includes `"admission_number": student.admission_number`.

## 3. Verification Evidence
- Python syntax compilation: Passed (`python3 -m py_compile backend/app/core/identity.py backend/app/schemas/student.py backend/app/api/endpoints/students.py`).
- Tenant isolation: Multi-tenant database uniqueness maintained via `uq_tenant_admission_number`.

