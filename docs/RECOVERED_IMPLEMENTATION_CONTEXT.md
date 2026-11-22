# EDUCATIONOS — RECOVERED IMPLEMENTATION CONTEXT
## Milestone: Release Candidate 3 (RC3) — Academic & Experience Transformation

**Reconstruction Date:** 2026-11-14  
**Primary Execution Domain:** Bangladesh Education Domain (NCTB Baseline + Board Examinations)  
**Target Class Range:** Play / Pre-Primary through Class 12 (Higher Secondary / Intermediate)

---

## 1. Context & Architectural Overview

The goal of the interrupted session was the **RC3 Academic & Experience Transformation**, transitioning EducationOS from an early primary-focused system (Play–Class 5) into a comprehensive, production-grade K–12 and college SaaS platform for Bangladesh.

### Key Functional Pillars:
1. **Academic Expansion (Class 1–12):**
   - Support for Play, Nursery, KG, Class 1–5 (Primary), Class 6–8 (Junior Secondary), Class 9–10 (SSC with Science, Humanities, Business Studies), and Class 11–12 (HSC with compulsory and optional/4th subjects).
   - Dynamic class levels fetched from backend APIs instead of hardcoded strings.
   - Annual session rollover and transactional bulk promotion preserving historical academic records in `student_enrollment_history`.

2. **Student 360 Workspace & Full Editing:**
   - 16-section comprehensive student workspace.
   - Dual-mode editing: administrative edits with full `AuditLog` diffs; student self-service editing whitelisted to non-academic profile fields (photo, address, emergency contact).
   - Preservation of historical sessions and attendance/exam records.

3. **Bangladesh Admission Intake:**
   - Standard Bangladesh admission requirements: Bengali/English names, parent information, Division/District/Upazila/Union geographic hierarchy, previous school/board/roll/GPA, declaration, and document attachments.
   - Multi-stage lifecycle: `DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED / REJECTED -> ENROLLED`.

4. **Teacher 360 & Onboarding:**
   - Teacher profile expansion: Bengali name, employee ID, department, employment type, joining date, qualifications (`JSONB`), experience (`JSONB`), CV URL, bio.
   - Strict role-based protection of the Voice Diary feature: accessible only to `teacher` role.

5. **Class 1–12 Attendance:**
   - Support for daily attendance (Classes 1–8) and period-wise/subject-wise attendance (Classes 9–12).
   - Upgraded unique constraint: `uq_attendance_student_day_period`.

6. **Curriculum AI & Grounded RAG:**
   - Multi-format ingestion pipeline supporting PDF textbooks (via `pypdf`), DOCX lecture notes, and TXT files.
   - Semantic sliding-window chunking (600 characters with 100 character overlap).
   - Strict tenant isolation: school-uploaded files are tenant-scoped; NCTB national curricula are marked `is_global_curriculum=True`.
   - Dynamic school branding and token budgeting in `ai_gateway.py`.

7. **Global UI/UX, Design System, & Theming:**
   - Reusable theme-aware select primitives (`SearchableSelect`, `CustomSelect`).
   - Visible topbar controls for Language (বাংলা / EN) and Theme (Sun / Moon / System).
   - Scalable server-side search in Fee Management replacing unpaginated dropdowns.
   - Canonical institution branding sourced from `useInstitution()`.

---

## 2. Reconstructed Backend Artifacts

### 2.1 Database Models
- `backend/app/models/academic.py`: Added `group`, `shift`, `academic_year` to `ClassModel`, `GradeLevel`, `Subject`, `ClassRoutine`, `DailyLessonLog`. Added `StudentEnrollmentHistory`.
- `backend/app/models/student.py`: Added `first_name_bn`, `last_name_bn`, `name_bn`, `group`, `shift`, `academic_year`, `address`, `emergency_contact`, `previous_school`, `photo_url`, `disciplinary_notes`, `health_notes`.
- `backend/app/models/attendance.py`: Added `period_number`, `subject`, `shift`, `section`, `group`, and unique constraint `uq_attendance_student_day_period`.
- `backend/app/models/users.py`: Added `name_bn`, `employee_id`, `department`, `employment_type`, `joining_date`, `address`, `emergency_contact`, `qualifications`, `experience`, `cv_url`, `bio` to `Teacher`.
- `backend/app/models/admission.py`: New comprehensive model `AdmissionApplication`.
- `backend/app/models/curriculum.py`: New models `CurriculumDocument` and `CurriculumChunk`.
- `backend/app/models/__init__.py`: Central registry exporting all models.

### 2.2 Alembic Migrations
- Active migration: `backend/alembic/versions/407a7716be83_academic_expansion_class_1_to_12.py`.
- Chain verification: Directly follows `cedb24c053f7`. Exactly 1 head, 1 root, 0 dangling nodes.

### 2.3 Services & Business Logic
- `backend/app/services/curriculum_rag.py`: File text extraction (`extract_text_from_bytes`), semantic chunking (`chunk_text`), document ingestion (`ingest_document`), document listing, and deletion.
- `backend/app/services/ai_gateway.py`: FinOps token budgeting, prompt injection sanitization, model failover.
- `backend/app/services/institution.py`: Tenant institution branding provider.

### 2.4 API Endpoints
- `backend/app/api/endpoints/academic.py`: Dynamic class catalogue (`GET /classes`), bulk promotion (`POST /promote`), RAG-grounded lesson generation.
- `backend/app/api/endpoints/students.py`: Search endpoint (`GET /search`), admin edit (`PATCH /{id}`), self-service (`PATCH /me/profile`), full 360 profile (`GET /{id}/profile-360`).
- `backend/app/api/endpoints/teachers.py`: Onboarding and qualification endpoints.
- `backend/app/api/endpoints/teacher_diary.py`: Voice diary restricted to `require_roles(["teacher"])`.
- `backend/app/api/endpoints/attendance.py`: Period-wise attendance support.
- `backend/app/api/endpoints/ai.py`: Multi-format document upload, listing, and deletion.

---

## 3. Reconstructed Frontend Artifacts

### 3.1 Layout & Navigation
- `frontend/app/dashboard/layout.tsx`:
  - `RoleRouteGuard` wrapping active dashboard.
  - Strict role-based menu structures (Admin, Teacher, Student, Guardian).
  - Removal of teacher-only `Voice Diary AI` button from the global top header.
  - Profile badge links directly to `/dashboard/profile`.
  - Offline banner active for network state transparency.

### 3.2 Pending Frontend Modules
1. `frontend/lib/useAcademicClasses.ts`: Hook for dynamic class fetching with canonical fallback.
2. `frontend/components/ThemeToggle.tsx`: Topbar Sun / Moon / System appearance controller.
3. `frontend/components/ui/SearchableSelect.tsx`: Accessible, theme-aware searchable dropdown.
4. `frontend/components/ui/CustomSelect.tsx`: Standard custom select box.
5. Student 360 Edit Modal in `frontend/app/dashboard/students/page.tsx`.
6. Fee Management Search Combobox in `frontend/app/dashboard/finance/page.tsx`.
7. Curriculum Knowledge Base Tab in `frontend/app/dashboard/academic/page.tsx`.
8. Admission Multi-Step Intake Wizard.

