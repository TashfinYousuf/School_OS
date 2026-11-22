# EDUCATIONOS — STAGE 12.5.6 GUARDIAN PORTAL SPECIFICATION
**Domain:** Parent & Guardian Portal Experience  
**Status:** IMPLEMENTED AND VERIFIED  
**Author:** Principal Product Architect & UX/UI Lead  
**Verification Date:** 9 November 2026

---

## 1. Persona Profile & Context

- **Target Persona**: Parent or Legal Guardian (e.g., father/mother of one or more children at Kids Shine School).
- **Core Needs**:
  1. Knowing if their child arrived at school today (morning roll call status).
  2. Tracking overall attendance percentage and punctuality over the term.
  3. Seamlessly switching between multiple enrolled children without re-authenticating.
  4. Viewing published progress cards, GPA, and subject marks.
  5. Checking tuition fee payment receipts and outstanding dues.
  6. Reviewing school announcements, vacation bulletins, and emergency closures.
- **Strict Anti-Requirements**:
  - NO administrative dashboards or teacher command center widgets.
  - NO access to children other than those linked in `student_guardians` (zero BOLA tolerance).

---

## 2. API Contract & Data Architecture

### Endpoint: `GET /api/v1/guardians/me/children`
- **Access Control**: Bearer JWT with `role: guardian` (or `admin`).
- **Identity Resolution**: Matches `claims["user_id"]` against `guardians.id` or `guardians.user_id`.
- **Join Cardinality**: One Guardian $\longrightarrow$ Multiple `GuardianStudentLink` $\longrightarrow$ Multiple `Student` records.

#### Response Payload Schema
```json
[
  {
    "student_id": "UUID",
    "student_name": "Sami Hossain",
    "first_name": "Sami",
    "last_name": "Hossain",
    "admission_number": "KS-2026-001",
    "class_name": "Class 5",
    "section": "A",
    "roll_number": "01",
    "relationship": "Father",
    "is_primary": true,
    "attendance": {
      "total_days": 24,
      "present_days": 23,
      "absent_days": 1,
      "late_days": 0,
      "rate_percentage": 95.8,
      "today_status": "Present"
    },
    "academics": {
      "gpa": 5.0,
      "standing": "GPA 5.00 (A+)",
      "subjects_evaluated": 6
    },
    "fees": {
      "total_paid": 15000,
      "status": "Paid in Full"
    }
  }
]
```

---

## 3. UI/UX Implementation Details

1. **Dashboard Home (`/dashboard`)**:
   - **Multi-Child Selector Bar**: If the guardian has 2 or more children enrolled, a horizontal pill selector appears at the top:
     `[Sami Hossain (Class 5)] [Zara Hossain (Class 2)]`
     Clicking a child immediately switches context across all snapshot cards.
   - **Today's Attendance Status**: Green pill with checkmark if marked `Present` in morning roll call; amber if `Late`; red if `Absent`; gray if `Not Marked`.
   - **Academic Standing**: Real term GPA with letter grade from published NCTB evaluation records.
   - **Fee Status**: Live verification of cleared payments or outstanding tuition dues.
2. **Attendance Log Page (`/dashboard/attendance`)**:
   - Renders authentic working days, present days, absent days, and attendance rate for the selected child.
   - Full date-wise ledger showing each classroom roll call record, time, status, and teacher remarks.
3. **Workspace Switcher Suppression**:
   - `WorkspaceSwitcher.tsx` detects `userRole === "guardian"` and replaces the workspace switcher with a static institutional badge.

