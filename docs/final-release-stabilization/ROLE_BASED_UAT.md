# EducationOS — Role-Based End-to-End User Acceptance Test (UAT)
**Pilot Institution:** Kids Shine International School (KSIS), Dhaka, Bangladesh  
**Test Suite Reference:** `backend/tests/test_rc4_bugfixes.py`, `backend/tests/test_stage12_5_9_pilot_personas.py`  
**Date:** November 2026

---

## 1. Role Matrix & Persona Coverage

| Role | Test Identity | Primary Capabilities Verified | UAT Status |
|---|---|---|---|
| **Platform Superadmin** | `superadmin@schoolos.internal` | Multi-tenant overview, platform health, tenant provisioning, system subscriptions | **VERIFIED PASS** |
| **School Admin / Principal** | `admin@ksis.edu.bd` | Institutional command dashboard, student admissions wizard, faculty directory, notice publisher | **VERIFIED PASS** |
| **Teacher / Educator** | `teacher.fatima@ksis.edu.bd` | Assigned classroom routine, student directory, digital attendance register, voice diary trigger | **VERIFIED PASS** |
| **Student** | `ayaan.rahman` (`.invalid` account) | Enrolled school badge, personal academic records, attendance history, fee statement | **VERIFIED PASS** |
| **Guardian / Parent** | `mahmudur.rahman@gmail.com` | Multi-child switcher, ward attendance tracking, official money receipts, fee balance | **VERIFIED PASS** |
| **Accountant / Finance Officer** | `accounts@ksis.edu.bd` | Daily collection ledger, fee collection modal (Cash/bKash), monthly archive statements | **VERIFIED PASS** |

---

## 2. Detailed Role Acceptance Journeys

### Journey 1: Platform Superadmin
- **Entrypoint:** `/dashboard/platform`
- **Actions:**
  1. Authenticates via platform login credentials.
  2. Inspects platform metrics: total active tenants, aggregate students, system subscription ARR.
  3. Verifies tenant isolation: cannot view un-scoped tenant data outside administrative super-console.
- **Verification:** All platform metrics load with 200 OK without database locks or cross-tenant leaks.

### Journey 2: School Admin / Principal (KSIS Pilot)
- **Entrypoint:** `/dashboard`
- **Actions:**
  1. Reviews Institutional Command Dashboard: today's attendance metrics, current month fee collection, enrolled student count.
  2. Inspects Weekly Cadence (Weeks 1–4) and Month-End Admin Preview.
  3. Launches 8-Step Student Admission Wizard: enters student demographics, guardian details, and fee structure; receives collision-free UID `KSIS-2027-XXXX`.
  4. Publishes official school notice with target audience filter.
- **Verification:** Admission creation is atomic; notice broadcasts successfully.

### Journey 3: Teacher / Educator
- **Entrypoint:** `/dashboard/teachers` & `/dashboard/attendance`
- **Actions:**
  1. Views assigned scheduled classes for the day.
  2. Marks daily classroom attendance: Present, Absent, Late.
  3. Saves daily register: events are stored with immutable timestamps and offline idempotency keys.
  4. Triggers voice-to-diary classroom log.
- **Verification:** Teacher has zero access to financial ledgers or platform settings; attendance persists correctly.

### Journey 4: Student (Synthetic Identity & Portals)
- **Entrypoint:** `/dashboard` & `/dashboard/finance`
- **Actions:**
  1. Logs in using student username / synthetic email (`@students.invalid`).
  2. `GET /api/v1/users/me` returns 200 OK (Bug A fix validated).
  3. Header displays static enrolled school badge: "Kids Shine International School (KSIS)" (no dropdown affordance).
  4. Navigates to `/dashboard/finance`: views own fee records, tuition invoice, and cleared receipts.
- **Verification:** Student cannot access administrative settings or other students' records.

### Journey 5: Guardian / Parent (Multi-Child Family)
- **Entrypoint:** `/dashboard` & `/dashboard/finance`
- **Actions:**
  1. Authenticates via verified mobile phone / email.
  2. Enrolled institution badge resolves to "Kids Shine International School (KSIS)".
  3. Navigates to `/dashboard/finance`:
     * Total paid: ৳5,000, Total due: ৳5,000.
     * Official money receipt `REC-KSIS-XXXX` rendered with timestamp and bKash transaction ID.
     * Sibling switcher dropdown displays both enrolled children: `Ayaan Rahman (Playgroup)` and `Zara Rahman (Nursery)`.
     * Switches to `Zara Rahman`: fee statement refreshes immediately for child 2.
- **Verification:** Attempting to query an unlinked student ID yields HTTP 403 Forbidden.

### Journey 6: Accountant / Finance Officer
- **Entrypoint:** `/dashboard/finance`
- **Actions:**
  1. Opens Daily Collection Ledger: inspects real-time collections across Cash, bKash, and Bank rails.
  2. Clicks "Collect Student Fee": selects student, billing month, fee category, amount, and payment rail; generates official money receipt.
  3. Generates Monthly Collection Archive Statement: selects year (2026) and month (November); generates printable statement with category and method breakdown.
  4. Clicks "Print Statement": generates clean A4 physical printout.
- **Verification:** Double-entry ledger updates atomically; receipts cannot be modified post-issuance.
