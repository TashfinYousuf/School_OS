# High-Severity Finance IDOR Remediation Report

**Vulnerability Reference:** `SEC-AUDIT-IDOR-01`  
**CWE:** CWE-639: Authorization Bypass Through User-Controlled Key  
**CVSS Base Score:** 6.5 (High)  
**Affected Route:** `GET /api/v1/finance/students/{student_id}/history`  
**Fixed In:** [backend/app/api/endpoints/finance.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/app/api/endpoints/finance.py#L424-L445)  
**Regression Test:** [backend/tests/test_rc3_defect_remediation.py](file:///Users/tashfinyousuf/Python/SCHOOL_OS/backend/tests/test_rc3_defect_remediation.py#L182) (`test_sec_audit_idor_01_student_fee_history_scope_enforcement`)  
**Status:** **VERIFIED FIXED & TESTED**  

---

## 1. Vulnerability Summary

Prior to this fix, `GET /api/v1/finance/students/{student_id}/history` accepted any `student_id` and filtered the database strictly by `FeePayment.tenant_id == tid`. While this prevented cross-tenant leakage, it failed to perform resource-level authorization within the tenant (Horizontal Privilege Escalation):
- Any authenticated student in the school could provide another student's UUID in the path and retrieve their complete fee payment ledger, invoice dues, and receipts.
- Any authenticated guardian could provide an unlinked student's UUID and view that student's financial records.

---

## 2. Technical Root Cause

In `backend/app/api/endpoints/finance.py`, the endpoint applied a generic role check `require_roles(["admin", "superadmin", "finance_officer", "accountant", "teacher", "guardian", "student"])` without extracting the caller's identity claims or verifying their relationship to the target `Student` record. In contrast, `students.py` properly called `security_guard.verify_student_scope(...)`.

---

## 3. Remediation Applied

1. Injected `current_user: dict = Depends(get_current_user_claims)` into `get_student_fee_history`.
2. Invoked canonical `security_guard.verify_student_scope`:
   ```python
   # Enforce Scope Authorization (SEC-AUDIT-IDOR-01)
   security_guard.verify_student_scope(
       current_user_role=current_user.get("role"),
       current_user_id=current_user.get("user_id"),
       student=st,
       db=db
   )
   ```
3. Verified the authorization matrix:
   - **Admin / Principal / Accountant / Fee Collector**: Authorized for any student within their tenant.
   - **Student**: Authorized ONLY for their own student record (`student.id == current_user_id` or `student.user_id == current_user_id`). Requests for any other student receive HTTP 403 Forbidden.
   - **Guardian**: Authorized ONLY for students where a verified `GuardianStudentLink` (`verification_status == 'VERIFIED'`) exists. Requests for unlinked students receive HTTP 403 Forbidden.
   - **Cross-Tenant Request**: Fails at the tenant boundary with HTTP 404 Not Found (preventing account enumeration).

---

## 4. Automated Regression Verification

The test `test_sec_audit_idor_01_student_fee_history_scope_enforcement` in `test_rc3_defect_remediation.py` was executed and passed with 100% compliance:
- Admin accessing Student A: **PASS (200 OK)**
- Student A accessing Student A: **PASS (200 OK)**
- Student A accessing Student B: **PASS (403 Forbidden)**
- Guardian accessing linked Student A: **PASS (200 OK)**
- Guardian accessing unlinked Student B: **PASS (403 Forbidden)**

