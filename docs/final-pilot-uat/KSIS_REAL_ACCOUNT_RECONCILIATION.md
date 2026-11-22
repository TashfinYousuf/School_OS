# Kids Shine International School (KSIS) — Real Account Reconciliation Plan
## Non-Destructive Pilot Identity Reconciliation & Production Transition Runbook

**Institution:** Kids Shine International School (KSIS)  
**Tenant ID:** `1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31`  
**Classification:** Production Pilot Operational Audit & Safe IAM Reconciliation  
**Date:** November 2026  
**Status:** READY FOR OPERATIONAL EXECUTION

---

## 1. Executive Summary & Live Database Audit Baseline

A live forensic audit was conducted directly against the primary PostgreSQL database for the Kids Shine International School tenant (`1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31`).

### Live Audit Findings:
| Entity Type | Total Count | Provisioned with Portal User | Unprovisioned Records | Notes |
|---|---|---|---|---|
| **Academic Students** | 3 | 1 (`ACTIVE` student account) | 2 | Academic enrollments, roll numbers, and class data are fully intact. |
| **Academic Guardians** | 3 | 0 | 3 | Phone numbers and family links exist; zero digital credentials created. |
| **Tenant Users (`users` table)** | 3 | 3 | 0 | 1 Administrator (`admin`), 1 Faculty (`teacher`), 1 Student (`student`). |
| **Active Account Invitations** | 0 | 0 | 0 | No pending tokens existed before this remediation. |

### The Core Root Cause Identified:
Previously, the backend possessed the IAM capability (`IdentityService.provision_student_account` and `provision_guardian_account`), but the **Administrator User Interface lacked interactive buttons, invitation modals, and link dispatch tools** to allow a school administrator to onboard students and guardians. Consequently, school administrators could not independently transition enrolled students or guardians into active portal users.

---

## 2. Non-Negotiable Data Safety Rules

1. **Zero Data Destruction:** No `DELETE`, `TRUNCATE`, or cascading deletion will be executed against existing academic records (`students`, `guardians`, `guardian_student_links`, `fee_payments`, `invoices`, `attendance_events`).
2. **Idempotent Identity Provisioning:** If an account is already provisioned, `POST /api/v1/students/{student_id}/portal/provision` or `POST /api/v1/guardians/onboard` returns the existing user reference and re-issues an unexpired activation link rather than creating duplicate accounts.
3. **No Plaintext Passwords:** School administrators and system engineers must NEVER ask for, set, or store plaintext passwords for students or guardians. All credentials are established by the end users themselves via single-use SHA-256 hashed activation tokens.
4. **Tenant Scoping Invariant:** All queries and updates strictly bind `tenant_id = '1dcd99ff-0c62-4a45-a6d9-a06a6b5b3b31'`.

---

## 3. Step-by-Step Non-Destructive Reconciliation Procedure

### Phase A: Reconciling Existing KSIS Students
1. **Access Student Directory:**  
   The KSIS School Administrator signs into `/login?tab=staff` and navigates to `/dashboard/students`.
2. **Observe Portal Access Badges:**  
   - The provisioned student displays the green badge: `Active`.
   - The 2 unprovisioned students display the grey badge: `Not Provisioned`.
3. **Issue Portal Access (Click-to-Provision):**  
   - For each unprovisioned student, the Administrator clicks the **"Enable"** button on their table row (or opens the Student 360 Workspace and clicks the **"Portal & Access"** tab).
   - The system calls `POST /api/v1/students/{student_id}/portal/provision`.
   - The modal generates the single-use activation URL (`/activate?token=...`).
4. **Dispatch Activation Links:**  
   - The Administrator clicks **"Share via WhatsApp"** or **"Copy Link"** to distribute the activation invitation to the student's registered guardian.
   - The student or guardian opens the link, sets an 8+ character password, and is automatically redirected to `/login?tab=student`.

---

### Phase B: Reconciling Existing KSIS Guardians
1. **Access Guardian Management Hub:**  
   The Administrator navigates to `/dashboard/guardians`.
2. **Select "Portal Accounts & Family Links" Tab:**  
   The directory lists all 3 existing guardian profiles with their linked children.
3. **Onboard / Enable Portal:**  
   - For each guardian without an active portal, the Administrator clicks **"Enable Portal"** (or **"Invite New Guardian"**).
   - The system binds the guardian to their primary mobile phone number, creates the user identity with `is_active=False` and `must_change_password=True`, and creates the single-use invitation record.
4. **Dispatch Invitation:**  
   - The Administrator copies the link or dispatches via WhatsApp.
   - The guardian opens `/activate?token=...`, confirms their name and mobile number, chooses a secure password, and clicks "Activate Account".
   - The guardian is redirected to `/login?tab=guardian` and signs in using their mobile number.

---

### Phase C: Sibling & Multi-Child Linking Verification
1. **Verify Family Linking:**  
   If any KSIS family has more than one child, the Administrator clicks **"Link Student"** on the guardian's card in `/dashboard/guardians` and selects the sibling from the dropdown.
2. **End-to-End Verification:**  
   The guardian logs in and verifies that both siblings appear in the child selector dropdown on their dashboard.

---

## 4. Verification & Validation Metrics

| Metric | Target | Verification Method |
|---|---|---|
| **Student Provisioning Rate** | 100% of enrolled students | Check `/dashboard/students` for zero `Not Provisioned` statuses. |
| **Guardian Linkage** | 100% of students linked to verified guardian | Check `guardian_student_links` with `verification_status == 'VERIFIED'`. |
| **Token Invalidation on Use** | 100% (zero token replay) | Attempt reusing a consumed activation token -> verifies `400 Bad Request`. |
| **Cross-Family Access** | 0% (structural BOLA blockage) | Verify guardian accessing unlinked student ID receives `403 Forbidden`. |

---

## 5. Rollback & Emergency Contingency

If an invitation is sent to an incorrect phone number or person:
1. The Administrator immediately clicks **"Suspend"** or **"Revoke"** on the student or guardian row in the dashboard.
2. This immediately marks `is_consumed = True` on all pending tokens and sets `is_active = False` on the user account.
3. All active JWT sessions for that user are revoked in the token blacklist.
4. The administrator corrects the contact details and clicks **"Reissue Link"** to send a fresh invitation to the correct family.
