# EDUCATIONOS — STAGE 12.5.6 ATTENDANCE ACCEPTANCE MATRIX
**Lifecycle Phase:** Full Operational Stabilization  
**Evaluation Standard:** Zero Mock Tolerance • Idempotent Offline Sync • IDOR/BOLA Protection  
**Auditor:** Principal Software Architect, Application Security Engineer & QA Lead  
**Verification Date:** 9 November 2026

---

## 1. Executive Summary & Verification Scope

The Attendance Management Subsystem in EducationOS has been upgraded from a basic daily mark roll call into a comprehensive, enterprise-ready, 8-phase attendance lifecycle:
$$\text{Capture} \longrightarrow \text{Validate} \longrightarrow \text{Persist} \longrightarrow \text{Retrieve} \longrightarrow \text{Filter} \longrightarrow \text{Review} \longrightarrow \text{Export} \longrightarrow \text{Audit}$$

All endpoints enforce institutional tenant scoping (`tenant_id`), role-based authorization guards (`require_roles`), and resource-level authorization (IDOR/BOLA prevention).

---

## 2. API Endpoint Specification & Verification Evidence

| Endpoint | Method | Role Authorization | Scope & Parameters | Verified Test Reference | Status |
|---|---|---|---|---|---|
| `/api/v1/attendance/sync-offline` | `POST` | `admin`, `teacher` | Idempotent offline batch sync with advisory lock and per-student deduplication. | `test_stage11_offline.test.ts` | **PASS (VERIFIED)** |
| `/api/v1/attendance/bulk-submit` | `POST` | `admin`, `teacher` | Batch roll call submission with cross-tenant ID containment validation. | `test_stage09_institution_operations.py` | **PASS (VERIFIED)** |
| `/api/v1/attendance/summary` | `GET` | `admin`, `teacher`, `superadmin` | Aggregates daily & monthly present/absent/late counts & attendance percentage. | `test_stage09_institution_operations.py` | **PASS (VERIFIED)** |
| `/api/v1/attendance/records` | `GET` | `admin`, `teacher`, `superadmin` | Historical query with `class_name`, `start_date`, `end_date`, `student_id`, `status`, pagination. | `test_stage12_5_6_attendance.py` (Test 1) | **PASS (VERIFIED)** |
| `/api/v1/attendance/student/{id}` | `GET` | `admin`, `teacher`, `guardian`, `student` | Detailed student attendance history, working days, present, absent, rate %. BOLA guarded. | `test_stage12_5_6_attendance.py` (Test 2) | **PASS (VERIFIED)** |
| `/api/v1/attendance/absent-list` | `GET` | `admin`, `teacher`, `superadmin` | Daily absentee roster joined with `student_guardians` and `guardians` phone directory for outreach. | `test_stage12_5_6_attendance.py` (Test 3) | **PASS (VERIFIED)** |
| `/api/v1/attendance/export` | `GET` | `admin`, `teacher`, `superadmin` | Streams tenant-scoped attendance data as `csv`, printable `html`, or `json`. | `test_stage12_5_6_attendance.py` (Test 4) | **PASS (VERIFIED)** |
| `/api/v1/attendance/correction-request` | `POST` | `admin`, `teacher` | Submits attendance amendment request into `ApprovalTask` center. | `test_stage09_institution_operations.py` | **PASS (VERIFIED)** |
| `/api/v1/attendance/correction-approval/{id}` | `POST` | `admin` | Admin review and atomic amendment of historical attendance record. | `test_stage09_institution_operations.py` | **PASS (VERIFIED)** |

---

## 3. Negative Security & BOLA Test Matrix

```
[Negative Security Scenario]
├── Unauthorized Guardian -> Requests Foreign Child's Attendance
│   └── Result: 403 Forbidden (Blocked by GuardianStudentLink Verification)
├── Student -> Requests Peer Student's Attendance
│   └── Result: 403 Forbidden (Blocked by Student ID Match Guard)
├── Teacher -> Requests Another Tenant's Attendance Records
│   └── Result: Zero records returned (Strict tenant_id isolation)
└── Concurrent Duplicate Offline Sync
    └── Result: Idempotent resolution without duplicated rows (uq_attendance_student_day)
```

1. **Foreign Child Access (BOLA/IDOR)**:
   - *Test*: Guardian A attempts `GET /api/v1/attendance/student/{unlinked_student_id}`.
   - *Result*: `403 Forbidden` (`Forbidden: You are not authorized to view this student's attendance.`).
2. **Student Cross-Access**:
   - *Test*: Student A attempts `GET /api/v1/attendance/student/{student_b_id}`.
   - *Result*: `403 Forbidden` (`Forbidden: Students may only view their own attendance.`).
3. **Cross-Tenant Containment**:
   - *Test*: Tenant Alpha attempts to query records for Tenant Beta student.
   - *Result*: Query filter `AttendanceEvent.tenant_id == tid` completely isolates data. Beta events never leak.

---

## 4. UI/UX Features Implemented in `attendance/page.tsx`

1. **Daily Roll Call (`take`)**:
   - Fast 1-click binary status toggling (`Present` $\leftrightarrow$ `Absent`).
   - "All Present" / "All Absent" bulk convenience buttons.
   - Offline queue badge and auto-sync on network reconnection.
2. **Class Attendance Ledger & History (`ledger`)**:
   - Multi-filter toolbar: Class selector, Date-range picker, Status selector.
   - One-click CSV export with RFC 4180 compliant escaping.
   - Printable A4 HTML view for institutional reporting.
3. **Daily Absentee Outreach (`absent`)**:
   - Roster of students absent on selected date.
   - Joined with Guardian Profile (Name, Relationship, Phone Number).
   - Instant Telephone Call trigger (`tel:...`).
   - Instant WhatsApp trigger (`https://wa.me/880...` with prefilled message).
4. **Parent/Student Portal View**:
   - Replaced all hardcoded strings with live database counts.
   - Multi-child selector for guardians with multiple enrolled children.
   - Detailed date-wise historical attendance log table.

