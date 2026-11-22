# EducationOS — RC3 Defect Remediation & Product Hardening Plan
**Document:** `docs/qa/RC3_REMEDIATION_PLAN.md`  
**Track:** RC3 — Academic & Experience Transformation  
**Status:** Approved Remediation Execution Roadmap  
**Date:** 2026-11-14  

---

## 1. Overview & Objective

This plan details the phased execution sequence to resolve all 12 owner-observed defects and fulfill all remaining requirements from the Master Product Transformation Directive. The plan ensures zero regressions, complete tenant isolation, compliance with `AGENTS.md`, and clean execution across all verification gates.

---

## 2. Phased Implementation Roadmap

### Phase 1: Global Modal, Dialog & Sidebar UX Repair (DEF-02, DEF-03, DEF-04, DEF-05)
- **Files to Modify:**
  - `frontend/app/dashboard/layout.tsx`:
    - Remove conflicting z-index stacking context (`relative z-20` on `aside` vs `relative z-10` on main wrapper).
    - Implement mobile drawer (<768px) with full-height slide-over, backdrop overlay, and touch-accessible toggle (minimum 44x44px).
    - Provide smooth desktop collapse/expand with accessible labels and tooltips.
  - `frontend/components/ui/ResponsiveDialog.tsx` (New Component):
    - Reusable, accessible, responsive dialog wrapper.
    - Portal / top-level z-index (`z-[100]`).
    - Backdrop click dismissal (`e.target === e.currentTarget`).
    - Keyboard dismissal via `Escape` key listener.
    - Responsive viewport constraints: `w-full max-w-[calc(100vw-2rem)] sm:max-w-lg md:max-w-2xl lg:max-w-4xl max-h-[90vh] flex flex-col`.
    - Internal scroll container for overflow (`overflow-y-auto custom-scrollbar`).
    - Unsaved changes confirmation hook when closing dirty forms.
  - Refactor modal dialogs in `frontend/app/dashboard/students/page.tsx`, `finance/page.tsx`, `academic/page.tsx`, `teachers/page.tsx`, `attendance/page.tsx` to adopt the new responsive dialog pattern.
- **Verification:** Viewport checks across 360px, 390px, 768px, 1024px, 1440px. Backdrop dismissal and Escape key testing.
- **Deliverable:** `docs/qa/MODAL_AND_RESPONSIVE_UX_AUDIT.md`.

---

### Phase 2: Educator/Teacher Requirement Completion (DEF-01)
- **Files to Modify:**
  - `backend/app/api/endpoints/teachers.py`:
    - Add `GET /api/v1/teachers/me/workload` (returns assigned classes, subject count, weekly periods, and routine).
    - Add `GET /api/v1/teachers/{id}/profile-360` (detailed educator 360 dossier with qualifications, classes, subjects, attendance summary, and performance metrics).
    - Ensure additive schema updates with proper tenant filtering.
  - `frontend/app/dashboard/teachers/page.tsx`:
    - Teacher 360 Workspace: tabbed view (Workload & Timetable, Classroom Quick Actions, Qualifications & Experience, Demographics).
    - Complete Onboarding Modal: Employee ID, department, employment type, joining date, and structured qualification editor.
  - `frontend/app/dashboard/page.tsx`:
    - Provide dedicated educator classroom dashboard view when `userRole === 'teacher'` (Today's classes, attendance shortcut, pending marks entry).
- **Verification:** Verification of Teacher 360 tabs, teacher onboarding flow, teacher dashboard view, and endpoint unit tests.
- **Deliverable:** `docs/qa/EDUCATOR_MODULE_REQUIREMENT_AND_ACCEPTANCE_REPORT.md`.

---

### Phase 3: Financial Ledger, Historical Reports & Student-Wise History (DEF-06, DEF-07)
- **Files to Modify:**
  - `backend/app/api/endpoints/finance.py`:
    - Implement `GET /api/v1/finance/reports/monthly` with query params `year: int`, `month: int`. Returns monthly collection summary, fee category breakdown, payment method breakdown, transaction counts, and print metadata with institution information.
    - Implement student filtering (`student_id: Optional[str] = None`) and active `search` query parameter in `GET /api/v1/finance/ledger` (searching student name, admission number, transaction reference).
    - Implement `GET /api/v1/finance/students/{student_id}/history` returning student-wise chronological fee ledger, total paid, and outstanding balance.
    - Ensure `GET /api/v1/finance/summary` computes total cumulative revenue distinctly from current month's collection.
  - `frontend/app/dashboard/finance/page.tsx`:
    - Add "Monthly Collection Report" tab with month/year picker and printable official fee report.
    - Add "Student Fee History" modal/view reachable from student search and invoice rows.
    - Enable search filtering in fee transaction tables.
- **Verification:** Verify monthly report generation, student fee ledger query, printable money summary layout.
- **Deliverable:** `docs/qa/FINANCIAL_LEDGER_AND_MONTHLY_REPORT_ACCEPTANCE.md`.

---

### Phase 4: Weekly KPI and Month-End Admin Preview Cycle (DEF-08)
- **Files to Modify:**
  - `backend/app/api/endpoints/dashboard.py`:
    - Add weekly KPI calculation in `get_dashboard_metrics` with exact Asia/Dhaka week window bounds (Saturday to Thursday / Sunday to Friday).
    - Add month-to-date weekly aggregations (Week 1, Week 2, Week 3, Week 4 breakdown).
    - Implement `GET /api/v1/dashboard/month-end-preview` (Admin-only preview of previous month collection, attendance rate, new admissions, and pending receivables before cycle reset).
  - `frontend/app/dashboard/page.tsx`:
    - Render weekly metrics with clear date window badges.
    - Render month-to-date aggregation card.
    - Render dismissible/reopenable Month-End Preview dialog for Admin.
- **Verification:** Verify weekly metrics aggregation and month-end preview modal.
- **Deliverable:** `docs/qa/WEEKLY_KPI_AND_MONTH_END_PREVIEW_ACCEPTANCE.md`.

---

### Phase 5: Global Unique School & Student Identifiers (DEF-09)
- **Files to Modify:**
  - `backend/app/core/identity.py` (New Helper):
    - Concurrency-safe identifier generation: `generate_student_uid(db, tenant_id, academic_year) -> str` (`STU-{YEAR}-{HEX_6}` or `EDU-{TENANT_CODE}-{YEAR}-{ALPHANUM_6}`).
    - Safe collision retry mechanism with unique database constraints.
  - `backend/app/api/endpoints/students.py` and `admissions.py`:
    - Auto-generate unique immutable `admission_number` if omitted from request payload.
  - `frontend/app/dashboard/students/page.tsx`:
    - Display auto-generated ID preview badge in Step 1 of Admission Wizard.
- **Verification:** Test student admission without providing an admission number; verify unique immutable ID generation.
- **Deliverable:** `docs/qa/GLOBAL_UNIQUE_IDENTIFIER_ACCEPTANCE.md`.

---

### Phase 6: Curriculum RAG Ingestion State Hardening (DEF-10)
- **Files to Modify:**
  - `backend/app/services/curriculum_rag.py`:
    - In `ingest_document`: ensure `chunks_count = 0` if database commit fails; record exact diagnostic failure in `error_message`; rollback session cleanly.
    - Enforce atomic state transition: `PENDING -> PARSING -> INDEXED / FAILED`.
  - `backend/app/api/endpoints/ai.py`:
    - If `doc.status == "FAILED"`, return HTTP 422 with `detail=doc.error_message`.
  - `frontend/app/dashboard/academic/page.tsx`:
    - Fix document properties (`file_name` vs `filename`).
    - Display error tooltip and retry action for `FAILED` status.
- **Verification:** Verify error handling on simulated parser failure; verify `INDEXED` status matches exact chunk count.
- **Deliverable:** `docs/qa/CURRICULUM_RAG_INGESTION_ROOT_CAUSE_REPORT.md`.

---

### Phase 7: Notices API 500 Fix (DEF-11)
- **Files to Modify:**
  - `backend/app/schemas/notice.py`:
    - Make `published_at: Optional[datetime] = None` in `NoticeResponse`.
    - Make `content: Optional[str] = ""` in `NoticeBase`.
    - Add field validator to normalize `target_audience` to uppercase with fallback `"ALL"`.
  - `backend/app/api/endpoints/notices.py`:
    - Properly filter non-expired notices handling `Notice.expiry_date.is_(None)`.
- **Verification:** Test `GET /api/v1/notices/` against rows with null dates and lowercase audience; verify HTTP 200.
- **Deliverable:** `docs/qa/NOTICES_API_500_ROOT_CAUSE_AND_FIX.md`.

---

### Phase 8: Complete English / Bangla Localization (DEF-12)
- **Files to Modify:**
  - `frontend/lib/i18n.ts`:
    - Expand translation dictionaries to cover all dashboard sections: Dashboard Overview, Attendance, Finance, Students, Teachers, Academic, Notices, Exams, Dialogs, Filter labels, Status badges, and Buttons.
  - Audit and update dashboard page components to consume `t(key)` systematically.
- **Verification:** Switch language to Bangla in header/settings; verify 100% of dashboard overview, modals, student table, attendance, and finance UI render authentic Bengali text.
- **Deliverable:** `docs/qa/COMPLETE_EN_BN_LOCALIZATION_AUDIT.md`.

---

### Phase 9 & 10: Verification, Gates & Final Summary
- **Execution:**
  1. `SKIP_DB=1 bash backend/scripts/check.sh`
  2. `cd frontend && npx tsc --noEmit`
  3. `bash backend/scripts/check_hardcoded_tenant.sh`
  4. `cd backend && ../venv/bin/python -m pytest tests/test_stage01_startup.py tests/test_stage02_migrations.py tests/test_stage05_rbac.py -v`
  5. Author `docs/qa/RC3_REMEDIATION_FINAL_REPORT.md` and update `docs/IMPLEMENTATION_PROGRESS.md`.

