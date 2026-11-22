# EducationOS — Guardian–Student Relationship Security Specification
**Document ID:** `docs/GUARDIAN_STUDENT_RELATIONSHIP_SECURITY.md`  
**Date:** 2026-11-11  
**Status:** ARCHITECTURAL SPECIFICATION & GOVERNANCE  
**Auditors:** Application Security Architect, Database Reliability Engineer, QA Lead  

---

## 1. Zero Trust Relational Authorization Model

To permanently eradicate the cross-student access defect (BOLA / IDOR):

1. **Default-Deny Policy:** Guardians have zero access to any student record by default.
2. **Server-Side Verification Only:** The server independently verifies the relationship for EVERY request. Client-supplied student IDs are treated as untrusted hints.
3. **Relational Query Boundary:** Access is authorized if and only if the following query returns a valid record:

```sql
SELECT gsl.id 
FROM student_guardians gsl
JOIN guardians g ON g.id = gsl.guardian_id
WHERE g.user_id = :authenticated_user_id
  AND gsl.student_id = :target_student_id
  AND gsl.tenant_id = :authenticated_tenant_id
  AND gsl.verification_status = 'VERIFIED'
  AND (gsl.revoked_at IS NULL OR gsl.revoked_at > NOW());
```

If this query yields zero rows, the server immediately halts processing and raises **HTTP 403 Forbidden: "Access restricted: You do not have an active verified relationship with this student."**

---

## 2. Eradication of Flawed Authorization Patterns

| Legacy Insecure Pattern | Security Vulnerability | Hardened Replacement Invariant |
| :--- | :--- | :--- |
| Comparing phone number strings in `security_guard.py` (`guardian_user.phone == student.guardian_phone`). | Phone number collisions, typos, or shared phones leak records across unrelated students. | **BANNED.** Authorization strictly joins through `student_guardians` join table. |
| Trusting `student_id` passed in request URL without verifying authenticated user's link. | BOLA/IDOR: Any logged-in guardian can enumerate UUIDs and download marks/fees of other children. | **BANNED.** Every route verifies `guardian_id` owns active verified link to requested `student_id`. |
| Client-side fallback to mock data ("Talha Hussain") on 404 response. | Deceptive information presentation; non-compliance with data integrity standards. | **BANNED.** Client displays clean empty state ("No academic records published yet for this term"). |
| Auto-linking guardian on admission without verification check. | Rogue guardian account provisioned without parental consent or school review. | All self-serve linking requests enter `PENDING_VERIFICATION` until verified by school authority. |

---

## 3. Mandatory Relationship Security Test Matrix

| Test Case ID | Test Scenario | Expected Outcome | Verification Status |
| :--- | :--- | :--- | :---: |
| **TEST-REL-01** | Guardian A attempts to fetch Student B's attendance via URL param manipulation. | **HTTP 403 Forbidden** | Required Gate |
| **TEST-REL-02** | Guardian A attempts to fetch Student B's report card via API query params. | **HTTP 403 Forbidden** | Required Gate |
| **TEST-REL-03** | Guardian A attempts to export CSV roster of Student B's class. | **HTTP 403 Forbidden** | Required Gate |
| **TEST-REL-04** | School revokes Guardian A's link to Student A; Guardian A immediately requests Student A records. | **HTTP 403 Forbidden** | Required Gate |
| **TEST-REL-05** | Guardian A requests records of verified child Student A. | **HTTP 200 OK** (Permitted fields only) | Required Gate |
| **TEST-REL-06** | Guardian A requests records of second verified child Student C (different class). | **HTTP 200 OK** (Permitted fields only) | Required Gate |
| **TEST-REL-07** | Guardian A from Tenant 1 attempts to query verified Student A in Tenant 2. | **HTTP 403 / 404** (Tenant Boundary Block) | Required Gate |
| **TEST-REL-08** | Two verified guardians (Father and Mother) independently access same student. | **HTTP 200 OK** for both | Required Gate |
| **TEST-REL-09** | Two students share same phone number, but only Student 1 is linked to Guardian. Guardian attempts to access Student 2. | **HTTP 403 Forbidden** | Required Gate |

