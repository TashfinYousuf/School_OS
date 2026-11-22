# Kids Shine International School (KSIS) Admission UAT Checklist
**Release Track:** Final Pilot Readiness & Production Acceptance  
**Pilot Institution:** Kids Shine International School (KSIS)  
**Campus:** Main Campus, Dhaka, Bangladesh  
**Auditor / Acceptance Lead:** Principal Software Architect & QA Lead  

---

## 1. Test Environment & Pre-Requisites

- **URL:** Local Staging / QA Environment (`http://localhost:3000/dashboard/admissions`)
- **API Base:** `http://localhost:8000/api/v1`
- **Institution Context:** Kids Shine International School (`useInstitution()` dynamic branding active)
- **Timezone:** Asia/Dhaka

### QA Personas for UAT:
1. **School Principal / Admin:** `admin@ksis.edu` / Full administrative authority.
2. **Senior Class Teacher (Class 1):** `teacher1@ksis.edu` / Assigned to Class 1.
3. **Junior Class Teacher (Class 2):** `teacher2@ksis.edu` / Assigned to Class 2.
4. **Prospective Parent / Applicant:** Public applicant applying via portal or counter.

---

## 2. Model A (Entrance Examination) UAT Test Runbook

| Step # | Test Objective | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **A-1** | Configure Model A Intake Cycle | As Admin, open `/dashboard/admissions` → Configure Intake Session. Create "Grade 1 Intake 2026", Model A, App Fee ৳500, Final Fee ৳5,000. | Session created with status `OPEN`. Appears in Intake Cycles tab. | PASS |
| **A-2** | Prospective Applicant Submission | Submit application for candidate "Zubair Ahmed" for "Class 1". | Application created in `SUBMITTED` state with sequential number `ADM-2026-0001`. Application fee invoice created (৳500). Payment status `PENDING`. | PASS |
| **A-3** | Premature Exam Schedule Guard | As Admin, attempt to schedule entrance exam before application fee is paid. | System rejects action with HTTP 400: *"Cannot schedule entrance exam before the application fee is verified and paid."* | PASS |
| **A-4** | Counter / bKash Payment Submission | Submit manual payment reference `BKASH-TRX-778899` for `APPLICATION_FEE`. | Application payment status moves to `UNDER_REVIEW`. Entry recorded in payment history. | PASS |
| **A-5** | Cashier Verification & Receipt Issuance | As Admin/Cashier, click "Verify Pay" on `ADM-2026-0001`. Confirm ৳500 Cash/bKash deposit. | Sequential receipt `RCP-2026-0001` minted. Application `payment_status` becomes `PAID`. Invoice marked `PAID`. Printable receipt modal opens. | PASS |
| **A-6** | Schedule Entrance Exam & Issue Admit Card | As Admin, click "Schedule Exam". Select date and venue (Main Auditorium). | Application status moves to `EXAM_SCHEDULED`. Admit Card number `AC-2026-0001` generated. | PASS |
| **A-7** | Teacher-Scoped Examination Evaluation | Login as Class 1 Teacher. Open `/dashboard/admissions`. Locate Zubair Ahmed. Click "Grade Exam". Enter Score: 87.5 / 100 with evaluator notes. | Score saved. Application status moves to `EXAM_EVALUATED`. Score displayed in table. | PASS |
| **A-8** | Teacher Cross-Class Isolation Check | As Class 1 Teacher, attempt to view or enter scores for an application belonging to Class 2. | System blocks access with HTTP 403: *"Teachers can only access applications for their assigned class."* | PASS |
| **A-9** | Teacher Financial Escalation Block | As Teacher, attempt to click payment verification or student enrollment. | Buttons are hidden/disabled in UI; backend rejects with HTTP 403 Forbidden. | PASS |
| **A-10** | Administrative Selection & Final Invoicing | As Admin, click "Select" on candidate. Set selection state to `SELECTED`. | Status becomes `SELECTED`. Final admission fee invoice (৳5,000) automatically generated. | PASS |
| **A-11** | Premature Enrollment Guard | As Admin, attempt to enroll candidate before final admission fee is paid. | System rejects enrollment with HTTP 400: *"Final admission fee must be paid before official student enrollment."* | PASS |
| **A-12** | Final Fee Verification & Approval | As Admin/Cashier, verify final admission fee payment (৳5,000). | Sequential receipt `RCP-2026-0002` minted. Status automatically updates to `APPROVED`. | PASS |
| **A-13** | Official Student Enrollment | As Admin, click "Enroll". Assign Section "Rose", Roll "101". | Status becomes `ENROLLED`. Permanent `Student`, `Guardian`, and `StudentEnrollmentHistory` records created. Receipts retroactively linked to student ID. | PASS |
| **A-14** | Enrollment Idempotency Verification | Click "Enroll" on the same application again. | Returns existing enrolled record safely without duplicating student or guardian records. | PASS |

---

## 3. Model B (Direct Admission) UAT Test Runbook

| Step # | Test Objective | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **B-1** | Configure Model B Intake Cycle | As Admin, create "Nursery Direct 2026" with Model B (Direct Admission, Fee: ৳0). | Session created with status `OPEN`. | PASS |
| **B-2** | Parent Direct Application | Submit application for "Maryam Khan" for "Nursery". | Application created with status `SUBMITTED`, fee ৳0 auto-marked `PAID`. | PASS |
| **B-3** | Review Application | As Admin, click "Review". Add notes: "Birth certificate verified." | Status transitions to `UNDER_REVIEW`. Notes recorded with reviewer audit timestamp. | PASS |
| **B-4** | Administrative Approval | As Admin, click "Approve". | Status transitions to `APPROVED`. Ready for enrollment. | PASS |
| **B-5** | Direct Enrollment | As Admin, click "Enroll". Assign Section "Tulip", Roll "05". | Student created with admission ID `STD-2026-Nursery-XXXX`. Status becomes `ENROLLED`. | PASS |

---

## 4. Public Tracking & Cross-Tenant Security

| Step # | Test Objective | Action | Expected Result | Pass/Fail |
|---|---|---|---|---|
| **C-1** | Public Tracking Verification | Query `GET /api/v1/admissions/status/{application_number}?phone=01711000001`. | Returns real-time application status, admit card info, exam score, and receipt number. | PASS |
| **C-2** | Tracking Phone Mismatch Protection | Query public status with incorrect phone number. | HTTP 404 returned; private applicant details are never leaked. | PASS |
| **C-3** | Cross-Tenant Isolation | Authenticated user from School B attempts to query `GET /api/v1/admissions/{id}` for School A's application. | HTTP 404 returned; zero cross-tenant leakage. | PASS |

