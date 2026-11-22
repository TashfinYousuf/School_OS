# EducationOS Admission Management System Architecture
**Release Track:** KSIS Pilot Readiness & Production Grade Hardening  
**Target Institution:** Kids Shine International School (KSIS)  
**Timezone:** Asia/Dhaka  

---

## 1. Executive Architecture Overview

The EducationOS Admission Management System provides an institutional prospective student intake engine supporting two core admission pipelines tailored for Bangladeshi private and English-medium educational institutions:

1. **Model A (Competitive / Entrance Examination Model):**
   - Configurable Intake Session (`MODEL_A`)
   - Online / Counter Application Submission
   - Application Fee Invoicing & Counter/Mobile Verification
   - Automated Admit Card (`AC-YYYY-XXXX`) & Examination Roll Generation
   - Teacher-Scoped Examination Grading (Subject-wise marks & observations)
   - Administrative Merit List Selection (`SELECTED`, `WAITLISTED`, `NOT_SELECTED`)
   - Final Term Admission Fee Invoicing & Payment Verification
   - Idempotent Official Student Enrollment with Guardian Linking & IAM Provisioning

2. **Model B (Direct / Nursery / Transfer Admission Model):**
   - Configurable Intake Session (`MODEL_B`)
   - Direct Application Submission (with birth certificate / document metadata)
   - Optional Application Processing Fee
   - Administrative Document Review (`UNDER_REVIEW`)
   - Institutional Approval (`APPROVED`)
   - One-Click Official Student Enrollment (`ENROLLED`)

---

## 2. Entity Relational Design & Database Schemas

### 2.1 `AdmissionSession` (`admission_sessions`)
Represents an institutional intake cycle with explicit model rules, date bounds, and per-class fee structures.
- `id`: UUID (Primary Key)
- `tenant_id`: String(64) (Indexed, RLS-enforced)
- `academic_year`: String(20) (e.g., "2026")
- `session_name`: String(100) (e.g., "Spring 2026 Primary Intake")
- `admission_model`: String(20) (`MODEL_A` | `MODEL_B`)
- `status`: String(20) (`DRAFT` | `OPEN` | `CLOSED` | `ARCHIVED`)
- `start_date`, `end_date`: Date
- `application_fee`: Numeric(12, 2)
- `final_admission_fee`: Numeric(12, 2)
- `class_fees`: JSONB (Overrides base application fee for specific classes)
- `max_seats`: JSONB (Capacity constraints per class)
- `eligibility_criteria`: Text

### 2.2 `AdmissionApplication` (`admission_applications`)
The core prospective applicant lifecycle record.
- `id`: UUID (Primary Key)
- `tenant_id`: String(64) (Indexed, RLS-enforced)
- `session_id`: UUID (FK to `admission_sessions.id`)
- `admission_model`: String(20) (`MODEL_A` | `MODEL_B`)
- `application_number`: String(64) (Unique per tenant: `ADM-YYYY-XXXX`)
- `status`: String(32) (`SUBMITTED` → `UNDER_REVIEW` → `EXAM_SCHEDULED` → `EXAM_EVALUATED` → `SELECTED` / `WAITLISTED` → `APPROVED` → `ENROLLED`)
- `academic_year`, `class_name`, `shift`, `group`, `desired_section`
- Demographics: `first_name`, `last_name`, `first_name_bn`, `last_name_bn`, `gender`, `date_of_birth`, `blood_group`
- Guardian Details: `guardian_name`, `guardian_phone`, `guardian_relationship`, `guardian_email`, `guardian_nid`
- Address: `present_address`, `permanent_address`, `division`, `district`, `upazila`
- Model A Exam Fields: `admit_card_number`, `entrance_exam_roll`, `entrance_exam_score`, `entrance_exam_details`, `selection_status`
- Financial Links:
  - `application_fee`, `payment_status`, `invoice_id` (FK to `invoices.id`)
  - `final_admission_fee`, `final_fee_payment_status`, `final_invoice_id` (FK to `invoices.id`)
- `enrolled_student_id`: UUID (FK to `students.id`, populated upon enrollment)

### 2.3 `AdmissionReceipt` (`admission_receipts`)
Cryptographically tracked, sequential, immutable counter & portal payment receipt.
- `id`: UUID (Primary Key)
- `tenant_id`: String(64) (Indexed, RLS-enforced)
- `receipt_number`: String(64) (Sequential: `RCP-YYYY-XXXX`)
- `application_id`: UUID (FK to `admission_applications.id` ondelete `CASCADE`)
- `student_id`: UUID (Nullable until official enrollment, then retroactively linked)
- `amount_paid`: Numeric(12, 2)
- `currency`: String(10) (default "BDT")
- `payment_method`: String(50) ("Cash Counter", "bKash", "Nagad", "Bank Transfer")
- `transaction_reference`: String(100)
- `fee_category`: String(50) ("APPLICATION_FEE" | "FINAL_ADMISSION_FEE")
- `receipt_payload`: JSONB (Immutable snapshot containing student name, class, guardian phone, amount, verified by user ID, and ISO timestamp)
- `issued_by_user_id`: String(64)
- `issued_at`: DateTime(timezone=True)

---

## 3. Role-Based Access Control & Class-Scoped Isolation

```
+-------------------+-----------------+-------------------+-------------------+
| Capability        | Admin / Head    | Assigned Teacher  | Non-Assigned Tch  |
+-------------------+-----------------+-------------------+-------------------+
| Create Session    | YES             | NO (403)          | NO (403)          |
| View All Apps     | YES             | NO (Class-Scoped) | NO (Class-Scoped) |
| Schedule Exam     | YES             | NO (403)          | NO (403)          |
| Enter Exam Score  | YES             | YES (Own Class)   | NO (403)          |
| Select/Waitlist   | YES             | NO (403)          | NO (403)          |
| Verify Payment    | YES             | NO (403)          | NO (403)          |
| Issue Receipt     | YES             | NO (403)          | NO (403)          |
| Official Enroll   | YES             | NO (403)          | NO (403)          |
+-------------------+-----------------+-------------------+-------------------+
```

### Teacher Class-Isolation Implementation:
When a user authenticated as a teacher queries applications (`GET /api/v1/admissions`) or attempts to grade a candidate (`POST /api/v1/admissions/{id}/exam-score`), the system executes:
```python
teacher = db.query(Teacher).filter(
    Teacher.tenant_id == _ensure_uuid(tid),
    Teacher.user_id == _ensure_uuid(claims.get("user_id")),
).first()
if teacher and teacher.assigned_class:
    if app.class_name != teacher.assigned_class:
        raise HTTPException(
            status_code=403,
            detail="Teachers can only access applications for their assigned class."
        )
```
This guarantees that educators never see or manipulate applicants outside their own institutional jurisdiction.

---

## 4. Idempotent Enrollment Lifecycle

The `POST /api/v1/admissions/{application_id}/enroll` endpoint executes inside an isolated serializable transaction guarded by `with_for_update()`:

1. **Idempotency Guard:** If `app.status == "ENROLLED"` and `app.enrolled_student_id` is present, it returns the existing record immediately without duplicating student or guardian records.
2. **Approval Check:** Confirms `app.status == "APPROVED"`.
3. **Financial Clearance Guard:**
   - Model A: Confirms `final_fee_payment_status == "PAID"` if final fee is greater than 0.
   - Model B: Confirms `payment_status == "PAID"` if application fee is greater than 0.
4. **Student Provisioning:** Creates new `Student` entity with unique `STD-YYYY-CLASS-XXXX` admission number.
5. **Academic Enrollment History:** Records `StudentEnrollmentHistory` with promotion status `ADMITTED`.
6. **Guardian Linking:** Locates existing guardian by verified phone number or creates new `Guardian` profile, linking with `GuardianStudentLink`.
7. **IAM Provisioning:** Invokes `IdentityService.provision_student_account` and `provision_guardian_account` for portal credentials.
8. **Receipt Retroactive Linkage:** Updates all `AdmissionReceipt` records issued for this application to link `student_id = student.id`.

