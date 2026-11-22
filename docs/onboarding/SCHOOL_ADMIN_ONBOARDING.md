# EducationOS — School Administrator Onboarding & Operating Manual
# বিদ্যালয় প্রশাসক অনবোর্ডিং ও পরিচালনা নির্দেশিকা

**Target Pilot:** Kids Shine International School (KSIS)  
**Role:** `admin`  
**Portal URL:** `/dashboard` (Admin Console)

---

## English Version

### 1. Introduction & Administrative Scope
As a School Administrator in EducationOS, you have full custody and governance over your institution's digital campus. Your responsibilities include configuring academic structures, provisioning faculty and student accounts, setting tuition schedules, overseeing roll-call attendance, and issuing authoritative institutional notices.

### 2. Initial Institutional Setup
1. **School Profile & Branding:**
   - Navigate to `/dashboard/settings`.
   - Verify Institution Name: **Kids Shine International School**.
   - Input EIIN, institutional address, contact phone, and official motto.
   - Upload school crest/logo (SVG or high-res PNG).
2. **Academic Structure (Year 2026):**
   - Navigate to `/dashboard/academic`.
   - Confirm active academic year is set to **2026**.
   - Review grade levels: Play, Nursery, KG, Class 1 through Class 10 (or 12).
   - Configure sections (e.g., Section A, Section B, Lily, Rose) and class teacher assignments.

### 3. Faculty & Staff Onboarding
1. Navigate to `/dashboard/teachers`.
2. Click **"Add Teacher"** or **"Invite Faculty"**.
3. Input teacher full name, mobile number, department, and assigned classes.
4. The system generates a single-use secure activation link (`/activate?token=...`).
5. Share this link via SMS or print an activation slip. When the teacher activates their account, their status flips to `ACTIVE`.

### 4. Student Enrollment & Guardian Linking
1. Navigate to `/dashboard/students`.
2. **Single Enrollment:** Click **"New Student"** to enroll an individual student with roll number, class, section, date of birth, and guardian details.
3. **Bulk Enrollment:** Click **"Import CSV"** to batch-upload classes using the standardized EducationOS CSV template.
4. **Guardian Auto-Linking:** The system matches guardians by phone number and links all siblings under a single unified guardian portal account.

### 5. Fee Structure & Accounting
1. Navigate to `/dashboard/finance`.
2. Set up Fee Heads (Monthly Tuition, Admission Fee, Exam Fee, Lab Fee, Transport).
3. Assign fee templates to classes.
4. Issue monthly bill invoices and record collections (supporting Cash, bKash, Nagad, and Bank deposit).
5. Print 2-copy institutional receipts (1 School Copy, 1 Student Copy) with auto-generated receipt serial numbers.

### 6. Daily Administrative Cycle
- **08:30 AM — Attendance Monitoring:** Review live roll-call submissions from classroom teachers. Identify unrecorded sections.
- **10:00 AM — Automated Absence Alerts:** Trigger SMS notifications to parents of absent students.
- **01:00 PM — Lesson Diary Audit:** Verify teachers have updated class lesson diaries with covered topics and homework.
- **03:00 PM — Daily Cash Reconciliation:** Reconcile counter collections with the day's fee register.

---

## বাংলা সংস্করণ (Bangla Version)

### ১. ভূমিকা ও প্রশাসনিক দায়িত্ব
এডুকেশনওএস প্ল্যাটফর্মে বিদ্যালয় প্রশাসক হিসেবে আপনার দায়িত্ব প্রতিষ্ঠানের যাবতীয় কার্যক্রম ডিজিটালভাবে পরিচালনা করা। এর মধ্যে রয়েছে শ্রেণি ও সেকশন বিন্যাস, শিক্ষক ও শিক্ষার্থীদের অ্যাকাউন্ট তৈরি, বেতন কাঠামো নির্ধারণ, উপস্থিতি তদারকি এবং নোটিশ জারি।

### ২. প্রাথমিক প্রতিষ্ঠান সেটআপ
১. **প্রোফাইল সেটিংস:** `/dashboard/settings` পেজে গিয়ে বিদ্যালয়ের নাম (Kids Shine International School), ঠিকানা, ফোন নম্বর এবং লোগো যাচাই করুন।
২. **একাডেমিক ক্যালেন্ডার (২০২৬):** `/dashboard/academic` পেজে ২০২৬ শিক্ষাবর্ষের শ্রেণি (প্লে থেকে দশম শ্রেণি) ও সেকশনগুলো সক্রিয় করুন।

### ৩. শিক্ষক ও স্টাফ অনবোর্ডিং
১. `/dashboard/teachers` মেনু থেকে **"Add Teacher"** এ ক্লিক করুন।
২. শিক্ষকের নাম, মোবাইল নম্বর এবং নির্ধারিত শ্রেণি নির্বাচন করুন।
৩. সিস্টেম থেকে প্রাপ্ত একক-ব্যবহারযোগ্য অ্যাক্টিভেশন লিংক শিক্ষকের নিকট প্রেরণ করুন।

### ৪. শিক্ষার্থী ভর্তি ও অভিভাবক সংযোগ
১. `/dashboard/students` পেজে গিয়ে একক শিক্ষার্থী ভর্তি করুন অথবা CSV ফাইলের মাধ্যমে একসাথে সম্পূর্ণ ক্লাসের তালিকা আপলোড করুন।
২. মোবাইল নম্বরের ভিত্তিতে অভিভাবক অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে তৈরি ও শিক্ষার্থীর সাথে যুক্ত হয়।

### ৫. ফি ও হিসাব ব্যবস্থাপনা
১. `/dashboard/finance` পেজে মাসিক বেতন, সেশন ফি, এবং পরীক্ষার ফি নির্ধারণ করুন।
২. নগদ টাকা বা মোবাইল ব্যাংকিংয়ের (বিকাশ/নগদ) মাধ্যমে ফি গ্রহণ করে দুই কপি রসিদ প্রিন্ট করুন।

