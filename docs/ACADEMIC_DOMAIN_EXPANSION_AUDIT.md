# ACADEMIC DOMAIN EXPANSION FORENSIC AUDIT (CLASS 1–12)

**Document Reference:** `docs/ACADEMIC_DOMAIN_EXPANSION_AUDIT.md`  
**Release Track:** EducationOS RC3 — Academic & Experience Transformation  
**Auditor:** Principal SaaS Product Architect & Bangladesh Education Domain Specialist  
**Date:** 2026-11-14

---

## 1. Executive Summary & Forensic Baseline

The existing EducationOS academic domain implementation was designed primarily around pre-primary and primary schools (Play to Class 5). Across all seven major frontend dashboard pages (`academic/page.tsx`, `attendance/page.tsx`, `exams/page.tsx`, `guardians/page.tsx`, `results/page.tsx`, `students/page.tsx`, `teachers/page.tsx`), the class choices were hardcoded to an identical 8-element array:
```typescript
const classes = ["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"];
```
This hardcoded limit completely excluded:
- Junior Secondary: Class 6, Class 7, Class 8.
- Secondary (SSC): Class 9 and Class 10 with specialized disciplinary streams (**Science**, **Humanities**, **Business Studies**).
- Higher Secondary (HSC / College): Class 11 and Class 12 with mandatory subjects, group-specific subjects, and 4th/optional subject combinations.

In the backend database schema:
1. `backend/app/models/academic.py`: Contained basic `GradeLevel`, `Subject`, `ClassModel`, `ClassRoutine`, and `DailyLessonLog` entities, but lacked fields for section, shift (Morning/Day), group (Science/Humanities/Business Studies), academic year linkage, and subject combinations.
2. `backend/app/models/student.py`: Only had single string fields `class_name`, `section`, `roll_number`. Lacked `group`, `shift`, `academic_year_id`, `subject_combination_ids`, `optional_subject_id`, and Bengali name fields.
3. `backend/app/models/attendance.py`: Constrained by `UniqueConstraint("tenant_id", "student_id", "date", name="uq_attendance_student_day")`. It lacked period-wise attendance, subject tracking, shift/section indexing, and group tracking needed for high school and college students.
4. **Academic Progression & Rollover**: Entirely missing. There was no transactional endpoint or model for student session promotion, section transfers, or academic year archiving. Previous academic history was at risk of being overwritten if an administrator edited `student.class_name` directly.

---

## 2. Granular Forensic Findings

### Finding ACAD-F01 (Severity: CRITICAL)
- **Title:** Hardcoded Class 1–5 Limitation Across Frontend Dashboards
- **Affected Files:**
  - `frontend/app/dashboard/academic/page.tsx:53`
  - `frontend/app/dashboard/attendance/page.tsx:65`
  - `frontend/app/dashboard/exams/page.tsx:58, 238, 259`
  - `frontend/app/dashboard/guardians/page.tsx:36`
  - `frontend/app/dashboard/results/page.tsx:61`
  - `frontend/app/dashboard/students/page.tsx:40`
  - `frontend/app/dashboard/teachers/page.tsx:44`
- **Root Cause:** A static string array `["Play", "Nursery", "KG", "Class 1", "Class 2", "Class 3", "Class 4", "Class 5"]` was hardcoded in seven different dashboard pages rather than dynamically fetching institution-configured levels from `GET /api/v1/academic/grades` or tenant settings.
- **Impact:** Any institution with Class 6–12, SSC batches, or HSC college sections cannot view, select, admit, or manage students beyond Class 5.
- **Implementation Plan:**
  1. Expand backend canonical grade catalogue in `academic.py` with default seed levels supporting Play, Nursery, KG, Class 1–12, and SSC/HSC streams.
  2. Implement an institution-configurable academic levels API (`GET /api/v1/academic/classes` and `GET /api/v1/academic/structure`).
  3. Replace hardcoded arrays across all frontend pages with dynamic fetching via a shared `useAcademicClasses()` hook with fallback to a complete standard Class 1–12 canonical catalogue.
- **Verification Test:** Automated frontend test verifying classes 1 through 12 render in selectors; backend endpoint test asserting tenant-scoped grade levels.

---

### Finding ACAD-F02 (Severity: CRITICAL)
- **Title:** Missing SSC & HSC Academic Group Architecture (Science, Humanities, Business Studies)
- **Affected Files:**
  - `backend/app/models/academic.py`
  - `backend/app/models/student.py:25`
  - `backend/app/schemas/academic.py`
  - `backend/app/api/endpoints/academic.py`
  - `frontend/app/dashboard/academic/page.tsx`
  - `frontend/app/dashboard/students/page.tsx`
- **Root Cause:** NCTB curriculum for Class 9–10 and 11–12 mandates division into academic streams (Science / বিজ্ঞান, Humanities / মানবিক, Business Studies / ব্যবসায় শিক্ষা). The `Student` model and `GradeLevel` models contained no `group` column or stream association.
- **Impact:** High schools and intermediate colleges cannot assign students to groups, schedule group-specific subjects (e.g., Physics, Higher Math vs. Accounting vs. Civics), or track SSC/HSC examination readiness.
- **Implementation Plan:**
  1. Add `group` column (`String(50)`, nullable, indexed) to `students`, `grade_levels`, `subjects`, and `class_routines`.
  2. Add `academic_year` and `shift` (`Morning` / `Day`) columns to `students` and `classes`.
  3. Support group selection conditionally in the student profile, admission forms, and academic routine management.
- **Verification Test:** `pytest` test creating Class 9 & Class 11 students with group assignments and verifying group-filtered routine queries.

---

### Finding ACAD-F03 (Severity: HIGH)
- **Title:** Lack of Academic Progression, Promotion & Session Rollover
- **Affected Files:**
  - `backend/app/models/academic.py`
  - `backend/app/api/endpoints/academic.py`
  - `backend/app/models/student.py`
  - `frontend/app/dashboard/academic/page.tsx`
- **Root Cause:** No data model or transactional API existed for recording annual promotions. If a student moved from Class 5 to Class 6, mutating `student.class_name` overwrote historical enrollment, destroying auditability and past academic session linkage.
- **Impact:** Inability to perform year-end rollovers, bulk promotions, or preserve historical academic transcripts and report cards.
- **Implementation Plan:**
  1. Create `StudentEnrollmentHistory` model in `academic.py` capturing `tenant_id`, `student_id`, `academic_year`, `class_name`, `section`, `roll_number`, `group`, `promotion_status` (PROMOTED, RETAINED, TRANSFERRED), and `promoted_at`.
  2. Implement transactional bulk promotion endpoint: `POST /api/v1/academic/promote` with preview mode (`dry_run=True`), conflict detection, and rollback safety.
  3. Add UI modal in `academic/page.tsx` allowing administrators to preview and execute class promotions.
- **Verification Test:** Integration test verifying that bulk promotion preserves old session records in `student_enrollment_history` while updating the active `students` row.

---

### Finding ACAD-F04 (Severity: HIGH)
- **Title:** Period-Wise Attendance Limitation for High School & College
- **Affected Files:**
  - `backend/app/models/attendance.py:43`
  - `backend/app/api/endpoints/attendance.py:83`
  - `frontend/app/dashboard/attendance/page.tsx`
- **Root Cause:** `AttendanceEvent` has `UniqueConstraint("tenant_id", "student_id", "date", name="uq_attendance_student_day")`. This schema design rejects secondary attendance records for the same student on the same day, making period-wise or subject-wise tracking impossible for Classes 9–12.
- **Impact:** Colleges and high schools that require period-wise or subject-wise attendance tracking are blocked by unique constraint violations (`IntegrityError`).
- **Implementation Plan:**
  1. Add `period_number` (`String(32)`, default `"DAILY"`), `subject` (`String(100)`, nullable), and `shift` (`String(50)`, nullable) to `AttendanceEvent`.
  2. Update table uniqueness to `UniqueConstraint("tenant_id", "student_id", "date", "period_number", name="uq_attendance_student_day_period")` via Alembic migration.
  3. Support both daily mode (Classes 1–8) and period-wise mode (Classes 9–12) in backend APIs and frontend attendance sheets.
- **Verification Test:** Alembic migration verification + pytest creating multiple period attendance events for a Class 10 student without constraint failure.

---

## 3. Bangladesh NCTB & Board Requirements Matrix

| Academic Tier | Applicable Classes | Core Streams / Groups | Compulsory NCTB Subjects | Optional / 4th Subjects |
| :--- | :--- | :--- | :--- | :--- |
| **Pre-Primary / Early Years** | Play, Nursery, KG | General | Bangla, English, Basic Math, Drawing | N/A |
| **Primary (প্রাথমিক)** | Class 1–5 | General | Bangla, English, Elementary Math, Bangladesh & Global Studies, Science, Religious Education | N/A |
| **Junior Secondary (নিম্ন মাধ্যমিক)** | Class 6–8 | General | Bangla, English, Mathematics, Science, BGS, ICT, Religion, Arts & Crafts, Physical Education | N/A |
| **Secondary (মাধ্যমিক / SSC)** | Class 9–10 | Science, Humanities, Business Studies | Bangla 1st & 2nd, English 1st & 2nd, General Math, ICT, Religion | **Science:** Physics, Chemistry, Biology, Higher Math<br>**Humanities:** History, Geography, Civics, Economics<br>**Business:** Accounting, Finance, Business Ent. |
| **Higher Secondary (উচ্চ মাধ্যমিক / HSC)** | Class 11–12 | Science, Humanities, Business Studies | Bangla, English, ICT | **Science:** Physics, Chemistry, Biology, Higher Math, Statistics<br>**Humanities:** Civics, Economics, Logic, Social Work<br>**Business:** Accounting, Management, Finance, Marketing |

---

## 4. Implementation Schedule & Gate Alignment

1. **Schema Migration:** Add `group`, `shift`, `academic_year` to `students`; add period tracking to `attendance_events`; create `student_enrollment_history`.
2. **Backend API:** Provide dynamic class catalogues, bulk promotion, and period attendance.
3. **Frontend Integration:** Refactor all seven dashboard pages to remove hardcoded arrays and support Class 1–12, SSC, and HSC workflows.
4. **Verification:** Pass all backend tests and `schema_drift.py` checks.
