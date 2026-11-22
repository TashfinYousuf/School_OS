# EducationOS — Faculty & Teacher Onboarding Guide
# শিক্ষক ও শিক্ষিকা অনবোর্ডিং গাইডলাইন

**Pilot Institution:** Kids Shine International School (KSIS)  
**Target Roles:** School Administrator, Faculty / Teacher  
**Frontend URL:** `/dashboard/teachers`, `/activate`, `/login?tab=staff`

---

## English Version

### 1. Overview & Objectives
The Teacher Portal equips classroom teachers and subject educators to manage day-to-day academic routines efficiently:
- Mark live attendance for assigned classes and sections.
- Enter continuous assessments, homework, classwork, and term exam marks.
- Maintain daily digital lesson diaries.
- Send announcements and notices to student batches and guardians.

All teacher accounts are provisioned and administered by the School Management.

---

### 2. How the School Administrator Onboards a Teacher

1. **Access the Teacher Directory:**  
   In the Admin Console, click **Teachers** in the left navigation (`/dashboard/teachers`).
2. **Add a New Teacher:**  
   Click the **"Add Teacher"** button at the top right.
3. **Fill Out Teacher Details:**  
   - **Full Name:** Official name of the teacher (e.g., "Nazmul Hossain").
   - **Mobile Phone:** Primary phone number (e.g., `01712000000`).
   - **Email Address:** Work or personal email address (used for password reset notifications).
   - **Department / Subject:** Primary subject expertise (e.g., Mathematics, English, Science).
   - **Class Teacher Assignment:** (Optional) Designate if they are the lead class teacher for a specific section (e.g., Class 1 Lily).
4. **Generate & Dispatch Invitation:**  
   - The platform creates an account in `INVITED` status and produces a single-use secure activation URL.
   - Click **"Copy Link"** to copy the URL, or dispatch via SMS/WhatsApp.
5. **Account Statuses:**  
   - `Invited`: Activation link issued, pending password setup.
   - `Active`: Teacher has activated their account and has full dashboard access.
   - `Suspended`: Account locked by administration (e.g., during leave of absence or resignation).

---

### 3. How the Teacher Activates Their Account

1. **Open Activation Link:**  
   Open the link sent by the school administration (`/activate?token=...`).
2. **Verify Identity:**  
   Confirm the displayed name and designated role (`teacher`).
3. **Set a Strong Password:**  
   Create an 8+ character password containing a mix of letters, numbers, and symbols.
4. **Log In:**  
   - Navigate to `/login` and select the **"Staff / Teacher"** tab.
   - Enter your registered email address (or mobile number) and password.
   - You will land on the Teacher Dashboard configured with your assigned classes.

---

### 4. Daily Teaching Workflow at Kids Shine International School

- **Morning Roll-Call:**  
  Open **Attendance** (`/dashboard/attendance`), choose your class/section, and tap students marked Absent or Late. Click **"Submit Attendance"**.
- **Lesson Diary:**  
  Record the day's completed curriculum topics and homework assignments so parents can track evening study requirements.
- **Marks Entry:**  
  Input midterm and final exam scores under **Academic → Gradebook**.

---

## বাংলা সংস্করণ (Bangla Version)

### ১. ভূমিকা ও সুবিধা
এডুকেশনওএস শিক্ষক পোর্টালের মাধ্যমে শিক্ষকমণ্ডলী তাদের দৈনন্দিন ক্লাসের যাবতীয় কার্যাবলী সহজে পরিচালনা করতে পারেন:
- ক্লাসের শিক্ষার্থীদের প্রাত্যহিক ডিজিটাল হাজিরা গ্রহণ।
- সাময়িক ও চূড়ান্ত পরীক্ষার নম্বর এবং হোমওয়ার্ক প্রদান।
- প্রতিদিনের পাঠদান বিবরণী (Lesson Diary) সংরক্ষণ।
- শিক্ষার্থী ও অভিভাবকদের উদ্দেশ্যে স্কুলের নোটিশ ও বার্তা প্রেরণ।

---

### ২. বিদ্যালয় প্রশাসন কীভাবে শিক্ষক অনবোর্ড করবেন

১. **শিক্ষক তালিকায় প্রবেশ করুন:**  
   অ্যাডমিন ড্যাশবোর্ডের বাম মেনু থেকে **"Teachers"** (`/dashboard/teachers`) অপশন নির্বাচন করুন।
২. **নতুন শিক্ষক যুক্ত করা:**  
   উপরে ডানপাশে থাকা **"Add Teacher"** বাটনে ক্লিক করুন।
৩. **শিক্ষকের তথ্য প্রদান:**  
   - পুরো নাম (যেমন: "নজমুল হোসেন")।
   - মোবাইল নম্বর ও ইমেইল ঠিকানা।
   - পড়ানোর বিষয় ও বিভাগ (যেমন: গণিত, ইংরেজি, বাংলা)।
   - শ্রেণি শিক্ষক হিসেবে দায়িত্ব (যেমন: প্রথম শ্রেণি - লিলি সেকশন)।
৪. **অ্যাক্টিভেশন লিংক তৈরি ও প্রেরণ:**  
   - সিস্টেম থেকে তৈরি হওয়া একক-ব্যবহারযোগ্য অ্যাক্টিভেশন লিংকটি কপি করে সংশ্লিষ্ট শিক্ষকের কাছে এসএমএস বা হোয়াটসঅ্যাপে পৌঁছে দিন।
৫. **স্ট্যাটাস মনিটরিং:**  
   শিক্ষক পাসওয়ার্ড সেট করা মাত্রই তার স্ট্যাটাস `Active` এ পরিবর্তিত হবে।

---

### ৩. শিক্ষক কীভাবে পোর্টাল সক্রিয় করবেন

১. **অ্যাক্টিভেশন লিংকে ক্লিক করুন:**  
   স্কুল প্রশাসন থেকে পাওয়া লিংকে যান (`/activate?token=...`)।
২. **তথ্য যাচাই ও পাসওয়ার্ড নির্ধারণ:**  
   নিজের নাম যাচাই করে অন্তত ৮ অক্ষরের একটি শক্তিশালী পাসওয়ার্ড সেট করুন।
৩. **ড্যাশবোর্ডে প্রবেশ:**  
   স্কুলের লগইন পেজে গিয়ে **"Staff / Teacher"** ট্যাবে ইমেইল/ফোন ও পাসওয়ার্ড দিয়ে ড্যাশবোর্ডে প্রবেশ করুন।

---

### ৪. কিডস শাইন ইন্টারন্যাশনাল স্কুলে শিক্ষকের দৈনন্দিন কাজ

- **সকাল ৯:০০ টা - ডিজিটাল হাজিরা:** ক্লাসে উপস্থিত হয়ে অনুপস্থিত শিক্ষার্থীদের চিহ্নিত করে এক ক্লিকে হাজিরা সাবমিট করুন।
- **দুপুর ১:০০ টা - পাঠ পরিকল্পনা ও হোমওয়ার্ক:** আজকের ক্লাসে কী পড়ানো হলো এবং কী বাড়ির কাজ দেওয়া হলো তা ডায়রিতে আপডেট করুন।
- **পরীক্ষার মূল্যায়ন:** পরীক্ষার পর গ্রেডবুক মেনুতে গিয়ে প্রাপ্ত নম্বর ইনপুট দিন।

