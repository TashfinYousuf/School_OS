# EducationOS — Student Portal Onboarding & Access Guide
# শিক্ষার্থী পোর্টাল অনবোর্ডিং ও অ্যাক্সেস গাইডলাইন

**Pilot Institution:** Kids Shine International School (KSIS)  
**Target Roles:** School Administrator, Class Teacher, Student  
**Frontend URL:** `/dashboard/students`, `/activate`, `/login?tab=student`

---

## English Version

### 1. Overview & Objectives
EducationOS provides a secure, role-restricted Student Portal where students can view their class routine, real-time attendance record, published exam marks and report cards, fee status, and school notices. 

Students do not register themselves. For security and child safety, **every student account must be provisioned and authorized by the School Administration**.

---

### 2. How the School Administrator Enables Student Portal Access

1. **Log in to Admin Console:**  
   Navigate to `/login?tab=staff` and log in with your Administrator credentials.
2. **Open the Student Directory:**  
   Click **Students** in the left sidebar navigation (`/dashboard/students`).
3. **Locate the Student:**  
   Use the search bar to locate the student by name or Admission ID (e.g., `STD-2026-001`), or filter by Class and Section.
4. **Inspect the "Portal Access" Column:**  
   Each student row features a dedicated **Portal Access** status badge:
   - `Not Provisioned` (Grey): The student has an academic record, but no digital login exists yet.
   - `Invited / Pending` (Amber): A secure activation link has been generated but not yet activated by the student.
   - `Active` (Green): The student has activated their portal account and can log in.
   - `Suspended` (Red): Account is temporarily deactivated by the school.
5. **Enable Access & Generate Activation Link:**  
   - In the student row, click **"Enable"** (or open the Student 360 Workspace and click the **Portal & Access** tab, then click **"Enable Portal Access"**).
   - An activation modal immediately pops up displaying:
     * Student Name and permanent Student ID / Username.
     * Single-Use Secure Activation Link (valid for 7 days).
     * Token expiration timestamp.
6. **Share the Link with the Student / Parent:**  
   - Click **"Copy Link"** to copy the URL to your clipboard.
   - Alternatively, click **"Share via WhatsApp"** to open a pre-filled WhatsApp message directly to the family.
   - You can also write down or print the link on the student's ID card / slip.

---

### 3. How the Student Activates Their Portal Account

1. **Open the Activation Link:**  
   The student opens the provided link in any web browser on a phone, tablet, or PC (e.g., `https://school.educationos.com/activate?token=...`).
2. **Inspect Token Details:**  
   The page automatically inspects and displays the invitation status:
   - Green badge: "Valid Invitation".
   - Displays Student Name, Role (`student`), and User ID.
3. **Set a Secret Password:**  
   - Enter a secure password (minimum 8 characters, alphanumeric).
   - Re-type to confirm the password.
4. **Complete Activation:**  
   - Click **"Activate Account"**.
   - Upon successful activation, the page displays a success banner and automatically redirects to the Student Login screen (`/login?tab=student`).
5. **Subsequent Logins:**  
   - Go to `/login` and select the **"Student"** tab.
   - Enter the Student ID (or Admission Number) and the password created during activation.

---

### 4. Password Resets & Account Maintenance

- **If a student forgets their password:**  
  1. The Administrator navigates to `/dashboard/students`.
  2. In the student row (or 360 Workspace "Portal & Access" tab), click **"Reset"** (or **"Reissue Link"**).
  3. A new single-use activation/reset link is instantly generated.
  4. Share the new link with the student to set a new password.
- **Suspending Access:**  
  If a student is withdrawn or suspended, click **"Suspend"**. Login is blocked immediately.
- **Reactivating Access:**  
  Click **"Reactivate"** to restore account access at any time.

---

## বাংলা সংস্করণ (Bangla Version)

### ১. ভূমিকা ও উদ্দেশ্য
এডুকেশনওএস শিক্ষার্থী পোর্টালের মাধ্যমে শিক্ষার্থীরা তাদের ক্লাসের সময়সূচি, প্রাত্যহিক উপস্থিতি, পরীক্ষার ফলাফল, মার্কশিট, বেতন পরিশোধের অবস্থা এবং স্কুলের নোটিশ দেখতে পারে। 

শিক্ষার্থীরা নিজে নিজে সাইন-আপ করতে পারে না। নিরাপত্তার স্বার্থে **বিদ্যালয় প্রশাসন কর্তৃক প্রতিটি শিক্ষার্থীর পোর্টাল অ্যাকাউন্ট চালু ও অনুমোদন করা হয়**।

---

### ২. বিদ্যালয় প্রশাসক কীভাবে শিক্ষার্থীর পোর্টাল চালু করবেন

১. **অ্যাডমিন পোর্টালে লগইন করুন:**  
   `/login?tab=staff` পেজে গিয়ে আপনার অ্যাডমিনিস্ট্রেটর আইডি ও পাসওয়ার্ড দিয়ে প্রবেশ করুন।
২. **শিক্ষার্থী তালিকায় যান:**  
   বাম পাশের মেনু থেকে **"Students"** (`/dashboard/students`) সিলেক্ট করুন।
৩. **নির্দিষ্ট শিক্ষার্থী খুঁজুন:**  
   সার্চ বারে শিক্ষার্থীর নাম অথবা স্টুডেন্ট আইডি (যেমন `STD-2026-001`) লিখে খুঁজুন, অথবা শ্রেণি ও সেকশন ফিল্টার করুন।
৪. **"Portal Access" কলাম চেক করুন:**  
   তালিকার প্রতিটি শিক্ষার্থীর পাশে পোর্টাল স্ট্যাটাস প্রদর্শিত হবে:
   - `Not Provisioned` (ধূসর): একাডেমিক তথ্য আছে, তবে এখনও পোর্টাল অ্যাকাউন্ট তৈরি করা হয়নি।
   - `Invited / Pending` (হলুদ): অ্যাক্টিভেশন লিংক তৈরি করা হয়েছে, শিক্ষার্থী এখনও পাসওয়ার্ড সেট করেনি।
   - `Active` (সবুজ): অ্যাকাউন্ট চালু আছে এবং শিক্ষার্থী নিয়মিত লগইন করতে পারবে।
   - `Suspended` (লাল): অ্যাকাউন্ট সাময়িকভাবে স্থগিত।
৫. **অ্যাকাউন্ট চালু ও অ্যাক্টিভেশন লিংক তৈরি:**  
   - শিক্ষার্থীর নামের পাশে **"Enable"** বাটনে ক্লিক করুন (অথবা শিক্ষার্থীর প্রোফাইল খুলে **"Portal & Access"** ট্যাবে গিয়ে **"Enable Portal Access"** চাপুন)।
   - স্ক্রিনে একটি সিকিউর পপ-আপ প্রদর্শিত হবে যেখানে শিক্ষার্থীর স্টুডেন্ট আইডি ও একক-ব্যবহারযোগ্য অ্যাক্টিভেশন লিংক দেওয়া থাকবে (মেয়াদ ৭ দিন)।
৬. **লিংকটি শিক্ষার্থী বা অভিভাবকের কাছে পৌঁছানো:**  
   - **"Copy Link"** বাটনে ক্লিক করে লিংকটি কপি করে মেসেজ বা ইমেইলে পাঠান।
   - অথবা **"Share via WhatsApp"** বাটনে ক্লিক করে সরাসরি অভিভাবকের হোয়াটসঅ্যাপে পাঠিয়ে দিন।

---

### ৩. শিক্ষার্থী কীভাবে অ্যাকাউন্ট অ্যাক্টিভ করবে

১. **লিংক ওপেন করা:**  
   শিক্ষার্থী বা অভিভাবক মোবাইল অথবা কম্পিউটারের ব্রাউজারে প্রাপ্ত লিংকটি ওপেন করবে (`/activate?token=...`)।
২. **তথ্য যাচাই:**  
   স্ক্রিনে শিক্ষার্থীর নাম এবং স্টুডেন্ট আইডি স্বয়ংক্রিয়ভাবে ভেসে উঠবে ("Valid Invitation")।
৩. **নতুন পাসওয়ার্ড তৈরি:**  
   - নিজের জন্য একটি গোপন পাসওয়ার্ড লিখুন (কমপক্ষে ৮ অক্ষর)।
   - পুনরায় পাসওয়ার্ডটি টাইপ করে নিশ্চিত করুন।
৪. **অ্যাক্টিভেশন সম্পন্ন করা:**  
   - **"Activate Account"** বাটনে ক্লিক করুন।
   - অ্যাকাউন্ট সফলভাবে চালু হলে সিস্টেম স্বয়ংক্রিয়ভাবে শিক্ষার্থী লগইন পেজে (`/login?tab=student`) নিয়ে যাবে।
৫. **পরবর্তী লগইন পদ্ধতি:**  
   - স্কুলের ওয়েবসাইটে গিয়ে **লগইন** পেজে **"Student"** ট্যাব সিলেক্ট করুন।
   - স্টুডেন্ট আইডি ও পাসওয়ার্ড দিয়ে লগইন সম্পন্ন করুন।

---

### ৪. পাসওয়ার্ড রিসেট ও নিরাপত্তা ব্যবস্থাপনা

- **শিক্ষার্থী পাসওয়ার্ড ভুলে গেলে:**  
  ১. অ্যাডমিন `/dashboard/students` পেজে গিয়ে সংশ্লিষ্ট শিক্ষার্থীর পাশে **"Reset"** বাটনে ক্লিক করবেন।  
  ২. একটি নতুন অ্যাক্টিভেশন লিংক তৈরি হবে যা শিক্ষার্থীর কাছে পাঠালে সে নতুন পাসওয়ার্ড সেট করতে পারবে।
- **অ্যাকাউন্ট সাময়িক স্থগিত করা:**  
  কোনো কারণে অ্যাকাউন্ট বন্ধ রাখতে চাইলে **"Suspend"** বাটনে ক্লিক করুন। তাৎক্ষণিকভাবে লগইন বন্ধ হয়ে যাবে।
- **পুনরায় চালু করা:**  
  স্থগিত অ্যাকাউন্ট পুনরায় চালু করতে **"Reactivate"** বাটনে ক্লিক করুন।

