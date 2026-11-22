# EDUCATIONOS — STAGE 12.5.6 STUDENT PORTAL SPECIFICATION
**Domain:** Student Digital Twin & Study Room Experience  
**Status:** IMPLEMENTED AND VERIFIED  
**Author:** Principal Product Architect & UX/UI Lead  
**Verification Date:** 9 November 2026

---

## 1. Persona Profile & Context

- **Target Persona**: Enrolled K-12 Student (e.g., Kids Shine School student in Class 5).
- **Core Needs**:
  1. Knowing today's class schedule, periods, subjects, and assigned teachers.
  2. Checking personal attendance percentage and punctuality status.
  3. Viewing published NCTB exam results and grade progress cards.
  4. Viewing official circulars, examination routines, and school bulletins.
- **Strict Anti-Requirements**:
  - NO financial administrative jargon, billing switches, or tenant configurations.
  - NO administrative controls or access to peer student records (strict BOLA guard).

---

## 2. API Contract & Data Architecture

### Endpoint: `GET /api/v1/students/me/dashboard`
- **Access Control**: Bearer JWT with `role: student`.
- **Tenant Scope**: Implicit via `X-Tenant-ID` or JWT claims.
- **Identity Resolution**: Matches `claims["user_id"]` to `Student.id` or `Student.user_id`.

#### Response Payload Schema
```json
{
  "student": {
    "id": "UUID",
    "name": "Sami Hossain",
    "first_name": "Sami",
    "last_name": "Hossain",
    "admission_number": "KS-2026-001",
    "class_name": "Class 5",
    "section": "A",
    "roll_number": "01",
    "status": "Active"
  },
  "attendance": {
    "rate_percentage": 96.4,
    "total_days": 25,
    "present_days": 24,
    "absent_days": 1,
    "today_status": "Present"
  },
  "academics": {
    "term_gpa": 5.0,
    "standing": "GPA 5.00 (A+)",
    "subjects_evaluated": 6
  },
  "routine_today": {
    "day": "Monday",
    "periods_count": 5,
    "periods": [
      {
        "period": "Period 1",
        "subject": "Mathematics",
        "start_time": "09:00 AM",
        "end_time": "09:45 AM",
        "teacher_name": "Mr. Habib",
        "room_number": "Room 102"
      }
    ]
  }
}
```

---

## 3. UI/UX Implementation Details

1. **Dashboard Home (`/dashboard`)**:
   - Dynamic Hero Card displaying the student's name, class, section, roll number, and academic year.
   - Live KPI Stat Cards:
     - **Attendance Rate**: Authentic percentage computed from `attendance_events`.
     - **Term Standing**: NCTB GPA computed from published `student_results`.
     - **Today's Periods**: Count of periods scheduled for the current day from `class_routines`.
     - **AI Companion**: Quick trigger for Socratic Doubt Solver.
2. **Navigation Shell**:
   - Sidebar strictly filtered to student-accessible routes:
     - Overview (`/dashboard`)
     - Marksheet & Results (`/dashboard/results`)
     - Class Routine (`/dashboard/academic`)
     - Bulletins (`/dashboard/notices`)
3. **Workspace Switcher Suppression**:
   - `WorkspaceSwitcher.tsx` detects `userRole === "student"` and replaces the interactive dropdown with a clean, static institutional badge displaying the school name.

