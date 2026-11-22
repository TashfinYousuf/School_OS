# ACADEMIC EXPANSION & EXPERIENCE TRANSFORMATION IMPLEMENTATION PLAN

**Document Reference:** `docs/ACADEMIC_EXPANSION_IMPLEMENTATION_PLAN.md`  
**Release Track:** EducationOS RC3 — Academic & Experience Transformation  
**Authors:** Principal Software Architect, Senior Full-Stack Engineer, AI/RAG Architect, Database Architect  
**Date:** 2026-11-14

---

## 1. Master Execution Plan & Architecture Governance

This implementation plan resolves every defect identified in the forensic audit reports without disrupting existing working systems, database records, tenant isolation, or authentication flows. All database schema changes are applied through Alembic migrations (`alembic upgrade head`), and all code changes are additive and backward-compatible.

### Non-Negotiable Implementation Principles
1. **Schema Integrity:** Add nullable columns and partial unique indexes; never drop existing columns.
2. **Tenant Isolation:** Every new query and model enforces `tenant_id` filtering.
3. **Additive APIs:** Preserve all existing endpoint signatures, paths, and response shapes while adding required fields.
4. **No Mock or Localhost Hardcoding:** All API requests use `NEXT_PUBLIC_API_URL` and `fetchWithTenant`.
5. **Real RAG Grounding:** File ingestion pipeline validates files, extracts text, chunks semantically, and scopes to the tenant.
6. **Zero Regression:** All existing 179+ backend tests and 79+ frontend tests must remain green at every step.

---

## 2. Sequential Phase Execution Roadmap

```
Phase 1: DB Schema Migration & Academic Domain Expansion (Class 1–12, SSC/HSC Groups, Rollover)
                                  │
                                  ▼
Phase 2: Student 360 Workspace & Full Editing Backend + Frontend
                                  │
                                  ▼
Phase 3: Bangladesh Admission Multi-Step Intake Wizard & Workflow
                                  │
                                  ▼
Phase 4: Teacher 360, Professional Onboarding & Teacher-Only Voice Diary Enforcement
                                  │
                                  ▼
Phase 5: Attendance Expansion (Daily + Period-Wise for Class 9–12)
                                  │
                                  ▼
Phase 6 & 7: Curriculum AI RAG Document Ingestion Pipeline & Lesson Planner
                                  │
                                  ▼
Phase 8 & 9: Global Design System (SearchableSelect), Topbar Theme & Language System
                                  │
                                  ▼
Phase 10: Role-Based Navigation & Canonical Permission Unification
                                  │
                                  ▼
Phase 11: Scalable Fee Management UX (Server-Side Debounced Student Search)
                                  │
                                  ▼
Phase 12: Tenant & Workspace Branding Synchronization
                                  │
                                  ▼
Phase 13: Legacy Student/Guardian Account Activation & Migration Guide
                                  │
                                  ▼
Phase 14 & 15: Global Regression Testing, Gate Validation & Final Acceptance Report
```

---

## 3. Workstream Breakdown

### Workstream 1: Database Models & Alembic Migration
- **Models Affected:**
  - `backend/app/models/academic.py`: Add `group`, `shift`, `academic_year` to `classes`, `grade_levels`, `subjects`, and `class_routines`. Create `StudentEnrollmentHistory` model.
  - `backend/app/models/student.py`: Add `name_bn`, `first_name_bn`, `last_name_bn`, `group`, `shift`, `academic_year`, `address`, `emergency_contact`, `previous_school`, `disciplinary_notes`, `health_notes`, `photo_url`.
  - `backend/app/models/teacher.py` / `users.py`: Add `name_bn`, `employee_id`, `department`, `employment_type`, `joining_date`, `address`, `emergency_contact`, `qualifications` (`JSONB`), `experience` (`JSONB`), `cv_url`, `bio`.
  - `backend/app/models/admission.py`: Add Bengali names, father/mother names (EN/BN), geographic address fields (Division, District, Upazila/Thana, Union/Ward), previous exam info, placement fields, declaration metadata.
  - `backend/app/models/attendance.py`: Add `period_number`, `subject`, `shift` to `AttendanceEvent`, updating unique constraint to `uq_attendance_student_day_period`.
  - `backend/app/models/curriculum.py`: Add `CurriculumDocument` entity for tracking uploaded files, parsing status, and chunk associations.
- **Migration Script:** Create Alembic revision `e1f2a3b4c5d6_academic_expansion_class_1_to_12.py`.

### Workstream 2: Backend APIs & Business Logic
- `backend/app/api/endpoints/academic.py`:
  - `GET /api/v1/academic/classes`: Return dynamic canonical and institution-configured Class 1–12 list.
  - `POST /api/v1/academic/promote`: Transactional bulk promotion with dry-run support.
  - Fix direct LLM calls in `generate-lecture` and `lessons/generate-materials` to route through `ai_gateway` and `curriculum_rag`.
- `backend/app/api/endpoints/students.py`:
  - `GET /api/v1/students/search`: High-performance debounced search endpoint for name, admission ID, roll, class, and phone.
  - `PATCH /api/v1/students/{student_id}`: Comprehensive admin update with `AuditLog` diff tracking.
  - `PATCH /api/v1/students/me/profile`: Student self-service update for whitelisted fields.
- `backend/app/api/endpoints/teachers.py`:
  - Support full qualification, experience, and employee profile updates.
- `backend/app/api/endpoints/teacher_diary.py`:
  - Restrict `voice-diary-sync` to `require_roles(["teacher"])`.
- `backend/app/api/endpoints/admissions.py`:
  - Expand application creation, review, and enrollment workflow supporting Bangladesh data fields.
- `backend/app/api/endpoints/attendance.py`:
  - Support period-wise attendance recording and querying for high school and college tiers.
- `backend/app/api/endpoints/ai.py` & `curriculum_rag.py`:
  - Implement `POST /api/v1/ai/curriculum/upload` for PDF, DOCX, TXT document ingestion with text extraction and chunking.
  - Add `GET /api/v1/ai/curriculum/documents` and document deletion.

### Workstream 3: Frontend UX, Design System & Portals
- **Design System Components:**
  - Create `frontend/components/ui/SearchableSelect.tsx` and `CustomSelect.tsx` with light/dark tokens and keyboard accessibility.
  - Create `frontend/components/ThemeToggle.tsx` (Sun / Moon / System) and mount in `frontend/app/dashboard/layout.tsx`.
- **RBAC & Feature Protection:**
  - In `layout.tsx`, gate the `Voice Diary AI` button to render only for `userRole === "teacher"`.
- **Dynamic Academic Classes Hook:**
  - Create `frontend/lib/useAcademicClasses.ts` and replace hardcoded arrays in all 7 dashboard pages.
- **Student 360 Workspace:**
  - Reconstruct `frontend/app/dashboard/students/page.tsx` with full editing modal, section tabs, and change confirmation.
- **Admission Wizard:**
  - Build multi-step admission application form with step validation and Bengali support.
- **Teacher 360 & Onboarding:**
  - Upgrade `frontend/app/dashboard/teachers/page.tsx` with full qualification/experience editor and multi-step onboarding wizard.
- **Attendance Period-Wise Selector:**
  - Update `frontend/app/dashboard/attendance/page.tsx` to support period-wise attendance for Class 9–12.
- **Curriculum Knowledge Base Tab:**
  - Add document upload dropzone and ingestion status table in `frontend/app/dashboard/academic/page.tsx`.
- **Scalable Fee Search:**
  - Replace native unpaginated `<select>` in `frontend/app/dashboard/finance/page.tsx` with server-side debounced student search.
- **Branding Synchronization:**
  - Harmonize `useInstitution()` and `WorkspaceContext` so active institution name is consistently rendered.

### Workstream 4: Verification, Testing & Acceptance
- Write unit and integration tests:
  - `backend/tests/test_academic_expansion_class_1_to_12.py`
  - `backend/tests/test_student_360_editing_and_audit.py`
  - `backend/tests/test_teacher_onboarding_and_voice_diary_rbac.py`
  - `backend/tests/test_curriculum_rag_document_ingestion.py`
  - `backend/tests/test_period_wise_attendance.py`
- Run all project gates: `check.sh`, `pytest -q`, `check_hardcoded_tenant.sh`, `npm test`, `npx tsc --noEmit`.
- Author final acceptance documentation.
