# EDUCATIONOS — ROLE-BASED INSTITUTIONAL USER MANUAL
## Practical Standard Operating Procedures (SOP) for Principals, Admins, Educators, Students & Parents

**Document Version:** 2026.1-MANUAL  
**Classification:** Operational Institutional Standard  

---

## 1. Persona 1: Institution Owner & Principal (Strategic Leadership)

### 1.1 First-Time Login & Overview
1. Navigate to your institution's portal URL (or `https://schoolos.app/login`).
2. Select the **Staff** tab.
3. Enter your registered administrative email and password.
4. Upon login, the **Executive Dashboard** presents:
   - **Active Student Enrollment Count** vs. subscription plan capacity.
   - **Today’s Faculty & Student Attendance Percentage**.
   - **Today's & Monthly Fee Collection Totals** (with digital payment vs. cash breakdown).
   - **Recent Institutional Activity Feed** (audit log highlights).

### 1.2 Multi-Branch & Campus Administration
- **Path:** `Dashboard` → `Campus Settings` (`/dashboard/settings`).
- **Reviewing Branches:** View main campus details, address, and contact numbers.
- **Establishing a New Campus Branch:** If your institution holds the `multi_branch` entitlement (School Pro or Unified Pro), click **+ Add Branch**, provide branch title, address, and localized phone number, and save.

### 1.3 Reviewing Financial & Academic Audits
- **Path:** `Dashboard` → `Audit Logs` (`/dashboard/settings`).
- **Verifying Changes:** Filter logs by action type (`STUDENT_ADMISSION`, `FEE_COLLECTION`, `MARKS_ENTRY`, `TRANSACTION_REVERSAL`). Every record captures the exact user, IP address, timestamp, and before/after state diff.

---

## 2. Persona 2: School Administrator (Operations & Finance)

### 2.1 Student Enrollment (Direct Admission — Model A)
1. **Path:** `Dashboard` → `Students` → **Admit Student** (`/dashboard/students`).
2. **Step 1: Bio-Demographic Details:** Enter Student First Name, Last Name, Date of Birth, Blood Group, and Gender.
3. **Step 2: Academic Placement:** Select Class (e.g. Class 1 to 12), Section (A, B, C), and Roll Number.
   - *Note:* If you leave Admission Number blank, EducationOS automatically generates a sequential institutional identifier (e.g., `KS-2026-001`).
4. **Step 3: Primary Guardian Details:** Enter Guardian Name, Phone Number, Relationship (Father/Mother/Guardian), and NID (optional).
5. **Step 4: Save & Issue Slip:** Click **Admit Student**. An official Admission Confirmation Slip is generated immediately for the guardian.

### 2.2 Tuition Fee Collection & Receipt Issuance
1. **Path:** `Dashboard` → `Finance` → **Collect Fee** (`/dashboard/finance`).
2. **Step 1: Student Lookup:** Search student by Admission ID, Roll Number, or Name. The system instantly loads their current due balance and fee schedule.
3. **Step 2: Select Fee Heads:** Check the applicable fees (e.g. Monthly Tuition — March, Exam Fee, Transport).
4. **Step 3: Select Payment Method:**
   - **Cash Counter:** Physical drawer receipt.
   - **Bank Transfer:** Record bank name and deposit slip number.
   - **bKash / Nagad:** Enter the 8–10 character transaction reference code (`TrxID`).
5. **Step 4: Print Instant Receipt:** Click **Record Collection**. An official dual-copy receipt (Student Copy + Office Copy) is instantly rendered for printing on A4 or receipt printers.

### 2.3 Bulk Student Roster Import (CSV/Excel)
1. **Path:** `Dashboard` → `Students` → **Bulk Import**.
2. Download the sample CSV template.
3. Populate student records (Name, Class, Section, Roll, Guardian Phone).
4. Drag and drop the completed file. The system validates formatting and flags any duplicate admission numbers before committing.

---

## 3. Persona 3: Teacher / Educator (Classroom & Pedagogy)

### 3.1 1-Tap Classroom Attendance Roll Call
1. **Path:** `Dashboard` → `Smart Attendance` (`/dashboard/attendance`).
2. Select your assigned **Class** and **Section** (defaults to today's date).
3. The touch-optimized roster loads with all students set to **Present** by default.
4. Tap any absent student's card to toggle status to **Absent** (red) or **Late** (amber).
5. Tap **Save Daily Register**.
   - *Offline Behavior:* If classroom internet drops, an orange banner appears: *"Offline Mode Active. 1 record queued in local storage."* The roll call is preserved locally and syncs automatically the moment connection resumes.

### 3.2 AI-Assisted Exam Question Paper Composer
1. **Path:** `Dashboard` → `Exams` → **AI Question Composer** (`/dashboard/exams`).
2. **Step 1: Configure Blueprint:**
   - Subject: e.g. *General Science (সাধারণ বিজ্ঞান)*.
   - Class / Grade: e.g. *Class 8*.
   - Topic / Chapter: e.g. *Photosynthesis & Plant Respiration (সালোকসংশ্লেষণ)*.
   - Question Type: Multiple Choice Questions (MCQ) or Creative Questions (CQ).
   - Question Count: Select between 5 and 25 questions.
   - Difficulty: Easy, Medium, or Hard.
3. **Step 2: Generate Draft:** Click **Generate Question Blueprint**. In under 15 seconds, the AI Gateway composes syllabus-grounded questions with 4 distinct options, correct answer keys, and pedagogical explanations.
4. **Step 3: Educator Review (Mandatory):**
   - Review each question. Edit question phrasing or replace distractors if desired.
   - All AI materials are generated as `Draft` status. Click **Approve & Publish to Question Bank** to finalize.

### 3.3 Terminal Marks Entry & Report Card Generation
1. **Path:** `Dashboard` → `Results` (`/dashboard/results`).
2. Select Class, Section, and Exam Term (e.g. *Half-Yearly Examination 2026*).
3. Enter subject marks. The system dynamically computes Grade Points and Letter Grades according to official NCTB rules.
4. Click **Generate Batch Report Cards**. Download publication-ready A4 PDF progress reports for the entire section.

---

## 4. Persona 4: Student (Learning & Assessment)

### 4.1 First-Time Account Activation
1. Navigate to `/activate`.
2. Enter your unique **Admission ID** (provided on your school admission slip) and invitation code or date of birth.
3. Set your private password and security question.

### 4.2 Taking a Live MCQ Assessment
1. **Path:** `Student Workspace` → `Live Exams` (`/dashboard/live-exams`).
2. View scheduled online tests. Click **Start Exam**.
3. Answer MCQs before the countdown timer expires.
4. *Negative Marking:* If configured by the institution (e.g. -0.25 for incorrect answers), the header reminds you: *"Think carefully: 0.25 marks deducted for wrong answers."*
5. Click **Submit Assessment**. Instant percentile scores and detailed solution sheets load upon exam completion.

### 4.3 Socratic AI Learning Studio
1. **Path:** `Student Workspace` → `Learning Studio` (`/dashboard/learning`).
2. Select your Subject and Topic.
3. Type your question or concept you are struggling with.
4. The Socratic AI Tutor guides your understanding through hints and thought-provoking questions, helping you arrive at the solution yourself.

---

## 5. Persona 5: Guardian / Parent (Transparency & Mobile Portal)

### 5.1 Accessing the Mobile Portal
1. Navigate to `/login` and tap the **Parent** tab.
2. Enter your registered mobile phone number (used during student admission) and password.
3. If logging in for the first time, tap **Activate Account** to receive an SMS verification code.

### 5.2 Monitoring Child Attendance & Safety
- **Today's Status:** The home screen displays an immediate safety badge: **Present in Class**, **Late Arrival**, or **Absent**.
- **Historical Percentage:** View monthly attendance percentage bar graphs.

### 5.3 Fee Receipts & Payment Verification
- **Path:** `Guardian Portal` → `Fee Receipts`.
- Review past tuition payments, transaction reference IDs, and download official PDF money receipts for your family records.

