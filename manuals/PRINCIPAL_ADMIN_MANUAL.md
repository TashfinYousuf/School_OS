# EducationOS — Principal & Institution Administrator Manual
# এডুকেশনওএস — অধ্যক্ষ ও প্রতিষ্ঠান প্রধান পরিচালনা সহায়িকা

**Version:** 2.0 Enterprise Verified  
**Target Institutions:** K-12 Schools, Cadet Colleges, Madrasahs, Technical Institutes  
**Language:** English & বাংলা (Bilingual Reference)  

---

# SECTION 1: INSTITUTIONAL ONBOARDING & SETUP
## ১. প্রতিষ্ঠান সেটআপ ও প্রাতিষ্ঠানিক প্রোফাইল কনফিগারেশন

### 1.1 Initial Institutional Setup (প্রাথমিক প্রতিষ্ঠান তৈরি)
1. Navigate to `/onboard` or `/register` to initiate institutional onboarding.
2. Enter your formal institutional name (e.g., *Kids Shine International School*), EIIN number (if applicable), board affiliation, and administrative contact details.
3. The system assigns a cryptographically isolated tenant identifier (`tenant_id`), establishing multi-tenant database isolation.

### 1.2 Academic Year & Campus Context (শিক্ষাবর্ষ ও ক্যাম্পাস ব্যবস্থাপনা)
- Configure the academic cycle (e.g., *Academic Session 2026: Jan 01 – Dec 31*).
- Define operating shifts: Morning Shift (মর্নিং শিফট: 7:30 AM – 12:00 PM), Day Shift (ডে শিফট: 12:30 PM – 5:00 PM).
- **Campus & Workspace Management:**
  - For single-campus institutions, the workspace interface stays minimal—no dropdown is displayed.
  - Multi-campus institutions can configure secondary branches (e.g., *Main Campus*, *Junior Branch*) where authorized administrative staff can toggle branch contexts via the header switcher.

---

# SECTION 2: ATTENDANCE OVERSIGHT, HISTORY & EXPORTS
## ২. উপস্থিতি পর্যবেক্ষণ, ইতিহাস ও ডেটা এক্সপোর্ট

### 2.1 Institution-Wide Attendance Ledger (সার্বক্ষণিক উপস্থিতি লেজার)
- Navigate to **Dashboard > Attendance > Ledger & History**.
- Filter attendance records by:
  - **Date Range:** Single day, weekly, or full monthly history.
  - **Class & Section:** View attendance specific to any classroom.
  - **Status:** Filter by Present (উপস্থিত), Absent (অনুপস্থিত), or Late (দেরি).
- Summary statistics display real-time daily headcounts and attendance rates.

### 2.2 Absentee Outreach Directory (অনুপস্থিত শিক্ষার্থী ও অভিভাবক যোগাযোগ)
- Open the **Absentee Outreach** tab for the selected date.
- The system automatically compiles all absent students joined with their primary guardian's registered name, phone number, and relationship.
- Administrators and class teachers can initiate instant follow-up via:
  - **Direct Call (`tel:`):** Launches device phone dialer with guardian's number.
  - **WhatsApp Link:** Opens a direct chat link formatted with international country code (`+880`).

### 2.3 Official Ledger Export (উপস্থিতি লেজার এক্সপোর্ট)
- Generate official institutional attendance records on demand:
  - **CSV Export:** For local spreadsheet archival, statistical analysis, or custom reporting.
  - **Printable HTML:** Formatted with school header, date range, roll numbers, status tallies, and signature fields for formal record-keeping.
  - **JSON Stream:** For verified programmatic backups.

---

# SECTION 3: CURRICULUM, CLASSES & ROUTINE MANAGEMENT
## ৩. কারিকুলাম, শ্রেণি ও রুটিন ব্যবস্থাপনা

### 3.1 NCTB Curriculum Grade Structure (জাতীয় শিক্ষাক্রম অনুযায়ী শ্রেণি বিন্যাস)
- Pre-configured with the standard NCTB Class 1 to Class 10 curriculum structure.
- Add sections per class (e.g., *Class 6 - Padma (পদ্মা)*, *Class 6 - Meghna (মেঘনা)*).
- Assign Class Teachers (শ্রেণি শিক্ষক) with single-tap delegation.

### 3.2 Routine Conflict Engine (ক্লাস রুটিন ও সংঘর্ষ নিরোধ ইঞ্জিন)
- Navigate to **Dashboard > Academic Routine**.
- Assign teacher, subject, room, period, and time slot.
- The built-in collision engine prevents:
  1. **Teacher Collisions:** Prevents assigning the same faculty member to multiple classrooms at the same time period.
  2. **Room Collisions:** Prevents booking the same physical room for overlapping sections.
  3. **Section Collisions:** Prevents double-booking periods for the same class section.

---

# SECTION 4: STUDENT & GUARDIAN DIRECTORY
## ৪. শিক্ষার্থী ও অভিভাবক ডিরেক্টরি ব্যবস্থাপনা

### 4.1 Student Roster & Record Management (শিক্ষার্থী তালিকা ও ভর্তি)
- Access **Dashboard > Students** for the full student registry.
- Fields include: `Student Name`, `Admission Number`, `Class`, `Section`, `Roll Number`, `Guardian Name`, `Guardian Phone`.
- Linked guardians are cryptographically mapped in `student_guardians`, ensuring only verified family members access student records.

### 4.2 Multi-Child Sibling Association (অভিভাবক-শিক্ষার্থী সংযোগ)
- Multiple siblings enrolled in the school are associated with the same guardian phone/account.
- Parents can seamlessly toggle between siblings on their personal portal without logging in separately.

---

# SECTION 5: TUITION FEES & CASH COUNTER RECONCILIATION
## ৫. টিউশন ফি, বকেয়া আদায় ও ক্যাশ লেজার

### 5.1 Fee Head Setup (ফি কাঠামো নির্ধারণ)
- Define recurring and one-time fee heads:
  - Monthly Tuition Fee (মাসিক বেতন)
  - Admission / Re-admission Fee (ভর্তি ফি)
  - Term Examination Fee (পরীক্ষার ফি)
  - Session Charge & Development Fund (সেশন চার্জ)

### 5.2 Cash Counter Collection & Idempotent Receipts (কাউন্টারে ফি আদায়)
- Real-time search by Student Roll, Admission Number, or Name.
- Instant balance inquiry showing current month dues and past arrears.
- **Payment Collection:**
  - Cash counter operator records fee payment in integer BDT units.
  - Submissions require client-provided idempotency keys to prevent duplicate payments during connectivity issues.
  - Print verified duplicate money receipts showing transaction identifiers and remaining arrears.
  - *Note:* Direct online payment gateway integration (bKash/Nagad checkout) is planned for commercial release (Stage 12.6) following gateway merchant credential authorization.

---

# SECTION 6: EXAMINATION, EVALUATION & RESULT PUBLISHING
## ৬. পরীক্ষা, মূল্যায়ন ও ট্রান্সক্রিপ্ট প্রকাশনা

### 6.1 NCTB 7-Tier Grading Scale (জাতীয় গ্রেডিং স্কেল)
Enforces the Bangladesh standard 7-tier letter grading and GPA:

| Marks Range (নম্বর) | Letter Grade (গ্রেড) | Grade Point (জিপিএ) | Assessment (মূল্যায়ন) |
|:---:|:---:|:---:|:---:|
| 80% – 100% | **A+** | 5.00 | Outstanding (অসাধারণ) |
| 70% – 79% | **A** | 4.00 | Excellent (চমৎকার) |
| 60% – 69% | **A-** | 3.50 | Very Good (খুব ভালো) |
| 50% – 59% | **B** | 3.00 | Good (ভালো) |
| 40% – 49% | **C** | 2.00 | Satisfactory (সন্তোষজনক) |
| 33% – 39% | **D** | 1.00 | Passing (উত্তীর্ণ) |
| 0% – 32% | **F** | 0.00 | Fail (অকৃতকার্য) |

### 6.2 Post-Publication Edit Lock (ফল প্রকাশের পর ফলাফল লক)
- Once marks are tabulated and the Principal clicks **Publish Results**, results transition to `LOCKED` status.
- Prevents tampering of marks without an explicit, audit-logged admin override.
- Parents and students can immediately view terminal progress reports online.

---

# SECTION 7: SYSTEM AUDIT & SECURITY CONTROLS
## ৭. সিস্টেম অডিট ও সিকিউরিটি নিয়ন্ত্রণ

- **Role-Based Access Control (RBAC):** Restrict accounts clerks to finance; restrict subject teachers to their respective subject marks entry; restrict students and guardians from admin endpoints.
- **Audit Logs:** Fee collections, mark edits, and permission changes are recorded with timestamp and operator identity.
- **Data Boundaries:** Cryptographic tenant boundary guarantees complete separation between independent schools.
