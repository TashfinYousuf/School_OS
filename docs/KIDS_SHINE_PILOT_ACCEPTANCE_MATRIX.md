# EDUCATIONOS — KIDS SHINE SCHOOL PILOT ACCEPTANCE MATRIX

**Project:** EducationOS / SchoolOS Enterprise  
**Document ID:** `docs/KIDS_SHINE_PILOT_ACCEPTANCE_MATRIX.md`  
**Target Milestone:** Pilot Launch at Kids Shine School  
**Hard Launch Deadline:** November 15, 2026  
**Auditor / QA Lead:** Principal QA Director, Product Lead, Lead Security Reviewer  
**Release Readiness:** **CONDITIONAL GO (RECONCILIATION IN PROGRESS)**  

---

## 1. Acceptance Overview & Core Pilot Scope

The primary objective for the Kids Shine School pilot is a **stable, secure, and usable core school management system**. All non-essential SaaS features (e.g., automated credit card dunning, complex multi-currency invoicing, AI tutor voice lessons) have been decoupled and deferred.

This matrix tracks the 14 mandatory operational workflows required for full pilot sign-off.

---

## 2. Mandatory Core Workflow Acceptance Matrix

| Workflow ID | Operational Domain | Key Acceptance Criteria | Backend API Endpoint | Frontend Route | Test Method & Scope | Status |
|:---:|:---|:---|:---|:---|:---|:---:|
| **WF-01** | **Institution Setup** | School profile, EIIN/code, contact info, and active academic year (2026/2027) configurable by Admin. | `GET/PATCH /api/v1/institution/profile` | `/dashboard/settings` | Unit & API integration test | **PASS** |
| **WF-02** | **Admin Authentication** | Secure JWT authentication, persistent refresh sessions surviving restart, token revocation on logout. | `POST /api/v1/auth/login`<br>`POST /api/v1/auth/logout` | `/login` | `test_stage03_auth.py` (10/10) | **PASS** |
| **WF-03** | **Academic Structure** | Definition of Classes (Play to Class 10), Sections (A, B), Shifts (Morning/Day), and Subjects. | `GET/POST /api/v1/academic/classes`<br>`GET/POST /api/v1/academic/sections` | `/dashboard/academic` | `test_stage08_backend_domain.py` | **PASS** |
| **WF-04** | **Student Admission** | Single student registration, profile editing, and batch CSV roster import with row-level error validation. | `GET/POST /api/v1/students`<br>`POST /api/v1/admissions/import-csv` | `/dashboard/students` | `test_stage04_tenant_isolation.py` | **PASS** |
| **WF-05** | **Guardian Linking** | Parent profiles linked to students; strict BOLA guard preventing access to unlinked students. | `GET/POST /api/v1/guardians`<br>`POST /api/v1/guardians/link` | `/dashboard/guardians` | Negative BOLA test | **PASS** |
| **WF-06** | **Teacher & Staff Roles** | Teacher account creation, subject allocation, role assignment (`teacher`), password management. | `GET/POST /api/v1/teachers` | `/dashboard/teachers` | `test_stage05_rbac.py` (10/10) | **PASS** |
| **WF-07** | **Attendance Marking** | 1-tap class attendance (Present, Absent, Late); offline PWA mutation queue with idempotent retry. | `POST /api/v1/attendance/events`<br>`GET /api/v1/attendance/stats` | `/dashboard/attendance` | `test_stage11_offline_sync.py` | **PASS** |
| **WF-08** | **Exams & Report Cards** | Exam scheduling, marks entry, NCTB 2026 GPA-5 computation, publication gating, print-ready report card. | `POST /api/v1/exams`<br>`POST /api/v1/results`<br>`POST /api/v1/results/publish` | `/dashboard/exams`<br>`/dashboard/results` | `test_stage09_institution_operations.py` | **PASS** |
| **WF-09** | **Notice Board Broadcast** | Emergency bulletins and event notices with audience filtering (All, Teachers, Guardians). | `POST /api/v1/notices`<br>`GET /api/v1/notices` | `/dashboard/notices` | Integration test | **PASS** |
| **WF-10** | **Student Fee Ledger** | Student fee schedule, invoice generation, cash/bKash manual receipt entry, collection reporting. | `GET/POST /api/v1/finance/invoices`<br>`POST /api/v1/finance/payments` | `/dashboard/finance` | `test_stage06_finance.py` (10/10) | **PASS** |
| **WF-11** | **Search, Filter & Paging** | Fast search by student name/roll, class filtering, pagination across large rosters (500+ records). | Filter query params on list APIs | All Dashboard tables | UI interaction test | **PASS** |
| **WF-12** | **Data Backup & Export** | Self-serve student and attendance data export to CSV/JSON; pg_dump snapshot verification. | `/api/v1/government/ipemis/export` | `/dashboard/ipemis` | Operational verification | **CONDITIONAL** |
| **WF-13** | **Session Recovery** | Clear session on token expiration; prevent stale credential leaks in multi-user browser sessions. | `clearSession()` in API client | Global layout topbar | `test_stage07_frontend.test.ts` | **PASS** |
| **WF-14** | **Bilingual UI (EN/BN)** | 100% bilingual UI dictionary toggle supporting English and Bengali across core screens. | `frontend/lib/i18n.ts` | Global topbar toggle | `test_stage12_5_public_website.test.ts` | **PASS** |

---

## 3. Role-Based Permissions & Isolation Matrix

Each role must operate within strict privilege boundaries during the pilot:

| Role | Access Scope | Permitted Actions | Denied Actions (Must Return 403 Forbidden) |
|:---|:---|:---|:---|
| **Institution Admin** | Tenant-wide | All student, teacher, fee, exam, attendance, and settings operations. | Cross-tenant access; database superuser tasks. |
| **Teacher** | Class / Subject Scope | Mark attendance, enter exam marks, view class timetable, view guardian contact. | Edit fee records; publish unapproved results; alter tenant settings. |
| **Accountant** | Financial Scope | Create fee invoices, record fee payments, generate financial receipts. | Edit exam marks; alter attendance events; view teacher passwords. |
| **Guardian** | Linked Child Only | View child's attendance record, report cards, school notices, inbox messages. | View other students' marks; mark attendance; alter fee structures. |
| **Student** | Own Profile Only | View own class routine, published marks, personal attendance history. | Edit any records; view other students' personal data. |

---

## 4. Mandatory Negative & Security Test Verifications

| Test Case | Attack / Fault Vector | Expected System Behavior | Verification Status |
|:---|:---|:---|:---:|
| **NEG-01** | Unauthenticated user accesses `/api/v1/students` | HTTP 401 Unauthorized with clean error JSON | **PASS** |
| **NEG-02** | Teacher attempts to delete a Fee Payment | HTTP 403 Forbidden (RBAC violation) | **PASS** |
| **NEG-03** | Guardian attempts to access unlinked student record | HTTP 404 Not Found or 403 Forbidden (BOLA defense) | **PASS** |
| **NEG-04** | Tenant A attempts to read Tenant B's attendance events | Zero rows returned (Fail-closed RLS filter) | **PASS** |
| **NEG-05** | Client injects modified `tenant_id` in request JSON body | Request rejected; server overrides with token claim | **PASS** |
| **NEG-06** | Student attempts to submit marks via API | HTTP 403 Forbidden | **PASS** |
| **NEG-07** | Replay of expired or revoked JWT token | HTTP 401 Unauthorized (`token has been revoked`) | **PASS** |
| **NEG-08** | Offline mutation queue sends duplicate idempotency key | HTTP 200 OK with previously processed entity | **PASS** |

---

## 5. Pilot Sign-off Criteria & Release Verdict

### Sign-off Conditions for 15 November 2026 Launch:
- [x] All 14 core school workflows implemented and unit/integration tested.
- [ ] Database schema reconciliation DDL applied to live database (resolving `institution_subscriptions.currency` and table drift).
- [ ] Pre-onboarding backup verified with sample student data.
- [x] Public `/pricing` isolated from authenticated dashboard shell.
- [x] All 8 negative security tests verified green.

**Current Pilot Verdict:** **CONDITIONAL GO** — Authorized to proceed with Phase 1 Database Reconciliation and Phase 3 UX Repair.

