# EducationOS — Faculty & Teacher User Manual
# এডুকেশনওএস — শিক্ষক ও শিক্ষিকা পরিচালনা নির্দেশিকা

**Version:** 2.0 Enterprise Verified  
**Target Audience:** Class Teachers, Subject Teachers, Faculty Coordinators  
**Platform:** Progressive Web App (Mobile, Tablet, Desktop)  
**Language:** English & বাংলা  

---

# 1. GETTING STARTED & LOGIN
## ১. অ্যাকাউন্টে প্রবেশ ও প্রোফাইল সেটআপ

1. Visit your institution's portal URL (or launch the installed EducationOS app on your smartphone).
2. On `/login`, enter your registered institutional email and secure password provided by school administration.
3. Upon authentication, you will be routed directly to your **Teacher Dashboard**, displaying today's class schedule, assigned sections, and pending roll calls.

---

# 2. ATTENDANCE MANAGEMENT & OFFLINE ROLL CALL
## ২. হাজিরা গ্রহণ, অফলাইন মোড ও লেজার এক্সপোর্ট

### 2.1 Daily Morning Roll Call (দৈনিক সকালের হাজিরা)
- Navigate to **Dashboard > Attendance**.
- Select your assigned Class and Section.
- All enrolled students are marked **Present (উপস্থিত)** by default.
- Tap any absent student to toggle their status to **Absent (অনুপস্থিত)** or **Late (দেরি)**, and enter optional remarks (e.g., "Fever", "Sick").
- Click **Save Attendance (হাজিরা সংরক্ষণ)**.

### 2.2 Offline Resilience & Automatic Sync (অফলাইন হাজিরা গ্রহণ)
- If internet connectivity drops inside the classroom, EducationOS switches automatically to **Offline Mode**.
- The offline queue records the roll call batch in your device's local encrypted storage (`offlineDB`).
- An on-screen status badge shows pending offline records.
- When internet connection is restored, the queue synchronizes the batch to the central server automatically without duplicating records.

### 2.3 Absentee Review & Guardian Outreach (অনুপস্থিত শিক্ষার্থী ও অভিভাবক যোগাযোগ)
- Open the **Absentee Outreach** tab for today's date.
- Review all absent students along with their registered guardian's name, relationship, and contact number.
- Initiate direct outreach:
  - **Phone Call (`tel:`):** Tap to call the guardian immediately.
  - **WhatsApp (`wa.me`):** Tap to open a pre-formatted chat to inform the parent about the absence.

### 2.4 Attendance History & Class Ledger Export (উপস্থিতি লেজার ও এক্সপোর্ট)
- Open the **Ledger & History** tab.
- Filter by date range, specific student, or status to evaluate monthly attendance trends.
- Click **Export CSV** to download the complete classroom attendance sheet for documentation.

---

# 3. CONTINUOUS EVALUATION & EXAM MARKS ENTRY
## ৩. ধারাবাহিক মূল্যায়ন ও পরীক্ষার নম্বর এন্ট্রি

### 3.1 Subject-Wise Marks Entry (বিষয়ানুযায়ী নম্বর প্রদান)
- Open **Dashboard > Examination > Marks Entry**.
- Filter by Exam (e.g., *Half Yearly Examination 2026*), Class, Section, and your assigned Subject.
- Enter Written (CQ), Multiple Choice (MCQ), and Practical marks.
- Validation checks enforce:
  - Marks cannot exceed allocated maximum limits.
  - Negative marks are rejected.
  - Automatic calculation of total marks, letter grades, and grade points per NCTB standards.

### 3.2 Draft Saving vs Final Submission (খসড়া ও চূড়ান্ত দাখিল)
- **Save as Draft:** Save evaluated scores periodically without locking.
- **Submit for Publication:** Submits completed grade sheets to the Head Teacher / Examination Committee for final publication.

---

# 4. CLASS ROUTINE & TIMETABLE
## ৪. ব্যক্তিগত ক্লাস রুটিন ও সময়সূচি

- View your weekly timetable on **Dashboard > Academic Routine**.
- Period timings, assigned subjects, and room numbers are clearly displayed on mobile.
- Changes or substitute periods assigned by administration reflect immediately on your dashboard.
