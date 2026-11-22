# EducationOS — Guardian Portal Onboarding & Family Management Guide
# অভিভাবক পোর্টাল অনবোর্ডিং ও পরিবার সংযোগ নির্দেশিকা

**Pilot Institution:** Kids Shine International School (KSIS)  
**Target Roles:** School Administrator, Guardian / Parent  
**Frontend URL:** `/dashboard/guardians`, `/activate`, `/login?tab=guardian`

---

## English Version

### 1. Overview & Objectives
The EducationOS Guardian Portal enables parents and legal guardians to monitor their child's academic journey. Features include:
- Real-time attendance check-in/out records and alerts.
- Term exam report cards, grade books, and marks breakdowns.
- Fee dues, payment history, and instant digital receipt downloads.
- Direct teacher announcements and school circulars.
- Multi-child / sibling switcher within a single parent login.

To protect child safety and student privacy, **only authorized guardians linked to valid enrolled students can access the portal**.

---

### 2. How the School Administrator Onboards a Guardian & Links Children

1. **Access the Guardian Hub:**  
   In the Admin Console, click **Guardians** in the left navigation (`/dashboard/guardians`).
2. **Explore the Dual-View Hub:**  
   The page provides two specialized operational views:
   - **Tab 1: "Portal Accounts & Family Links" (IAM Hub):** Used to provision accounts, link siblings, view invitation statuses, and reset passwords.
   - **Tab 2: "Quick WhatsApp Notice Hub":** Used for rapid one-click WhatsApp messaging to individual or group parent contacts.
3. **Onboard a New Guardian:**  
   - In Tab 1, click the purple **"Invite New Guardian"** button.
   - Fill out the Onboarding Form:
     * **Full Name:** Guardian's legal name (e.g., "Abdul Karim").
     * **Relationship:** Father, Mother, Brother, Sister, or Legal Guardian.
     * **Phone Number (Login Identifier):** Valid 11-digit Bangladesh mobile number (e.g., `01711000000`).
     * **Email Address (Optional):** Guardian's email address.
     * **Link Student (Optional):** Select the child from the dropdown list.
   - Click **"Create & Generate Activation Link"**.
4. **Copy & Dispatch Activation Link:**  
   - A modal immediately appears containing:
     * Guardian Name and Login Phone Number.
     * Single-Use Secure Activation URL (valid for 7 days).
     * Token Expiration Date.
   - Click **"Copy Link"** or **"Share via WhatsApp"** to send the invitation directly to the parent's WhatsApp.
5. **Linking Additional Children / Siblings:**  
   - If a family has multiple children enrolled at Kids Shine International School, click the **"Link Student"** button on the guardian's row.
   - Select the sibling from the student dropdown and click **"Save Link"**.
   - The parent can now seamlessly toggle between all their children from a single login without needing separate accounts.
6. **Unlinking a Student:**  
   - If custody changes or a child is unlinked, click the **"Unlink"** (×) badge beside the student's name on the guardian's card.

---

### 3. How the Guardian Activates Their Account

1. **Open the Invitation Link:**  
   The parent opens the link on their smartphone browser (`/activate?token=...`).
2. **Review Invitation Details:**  
   The page displays a "Valid Invitation" badge with the guardian's name and registered mobile number.
3. **Create Password:**  
   The parent types a secure password (minimum 8 characters) and confirms it.
4. **Activation Confirmation:**  
   Clicking **"Activate Account"** activates the profile and automatically redirects to the Guardian Login screen (`/login?tab=guardian`).
5. **Logging In:**  
   - Visit `/login` and select the **"Guardian"** tab.
   - Enter the registered Mobile Phone Number and the password created during activation.
   - After signing in, the guardian sees their family dashboard with linked children cards.

---

### 4. Administrative Security & Support

- **Forgotten Password:**  
  Click **"Reset"** on the guardian's card to re-issue an activation/reset link via SMS or WhatsApp.
- **Account Suspension:**  
  Click **"Suspend"** to lock portal access immediately if required for administrative or legal reasons.
- **Reactivation:**  
  Click **"Reactivate"** to restore normal parent access at any time.

---

## বাংলা সংস্করণ (Bangla Version)

### ১. ভূমিকা ও সুবিধা
এডুকেশনওএস অভিভাবক পোর্টালে যুক্ত হয়ে অভিভাবকগণ তাদের সন্তানের পড়াশোনা ও স্কুলের যাবতীয় তথ্য সরাসরি দেখতে পারবেন:
- প্রতিদিনের উপস্থিতি ও সময়মতো স্কুলে প্রবেশের নোটিফিকেশন।
- সাময়িক ও বার্ষিক পরীক্ষার ফলাফল ও গ্রেডশিট।
- বকেয়া বেতনের বিবরণ এবং অনলাইনে ফি প্রদানের রসিদ।
- শ্রেণি শিক্ষকের মন্তব্য এবং স্কুলের জরুরি নোটিশ।
- একাধিক সন্তান একই স্কুলে পড়লে একটিমাত্র একাউন্ট থেকেই সকল সন্তানের তথ্য দেখা যায়।

---

### ২. বিদ্যালয় প্রশাসন কীভাবে অভিভাবক যুক্ত করবেন ও শিক্ষার্থী লিংক করবেন

১. **অভিভাবক ম্যানেজমেন্ট পেজে যান:**  
   অ্যাডমিন ড্যাশবোর্ডের বাম মেনু থেকে **"Guardians"** (`/dashboard/guardians`) সিলেক্ট করুন।
২. **ডুয়াল-ভিউ হাব পরিচিতি:**  
   - **ট্যাব ১: "Portal Accounts & Family Links":** নতুন অভিভাবক তৈরি, সন্তান লিংক করা, পাসওয়ার্ড রিসেট ও নিরাপত্তা নিয়ন্ত্রণের জন্য।
   - **ট্যাব ২: "Quick WhatsApp Notice Hub":** অভিভাবকদের কাছে দ্রুত এক ক্লিকে হোয়াটসঅ্যাপ নোটিশ পাঠানোর জন্য।
৩. **নতুন অভিভাবক অনবোর্ড করা:**  
   - **"Invite New Guardian"** বাটনে ক্লিক করুন।
   - অভিভাবকের বিবরণ পূরণ করুন:
     * পুরো নাম (যেমন: "মো: রফিকুল ইসলাম")।
     * সম্পর্ক (পিতা / মাতা / আইনি অভিভাবক)।
     * মোবাইল নম্বর (১১ ডিজিটের ফোন নম্বর, যা দিয়ে অভিভাবক পরবর্তীতে লগইন করবেন)।
     * শিক্ষার্থীর নাম নির্বাচন (তালিকায় থাকা শিক্ষার্থী সিলেক্ট করুন)।
   - **"Create & Generate Activation Link"** বাটনে ক্লিক করুন।
৪. **অ্যাক্টিভেশন লিংক পাঠানো:**  
   - স্ক্রিনে একটি অ্যাক্টিভেশন কার্ড আসবে যেখানে একক-ব্যবহারযোগ্য নিরাপদ লিংক থাকবে।
   - **"Copy Link"** চাপুন অথবা **"Share via WhatsApp"** চেপে অভিভাবকের হোয়াটসঅ্যাপে লিংকটি তাৎক্ষণিক পাঠিয়ে দিন।
৫. **একাধিক সন্তান (ভাই-বোন) যুক্ত করা:**  
   - অভিভাবকের যদি অন্য কোনো সন্তানও স্কুলে পড়ে, তবে অভিভাবক কার্ডে থাকা **"Link Student"** বাটনে ক্লিক করে অপর সন্তানকে যুক্ত করে নিন।
   - এর ফলে অভিভাবক একটিমাত্র লগইনেই সকল সন্তানের ড্যাশবোর্ড সুইচ করে দেখতে পারবেন।
৬. **সন্তান আনলিংক করা:**  
   - কোনো শিক্ষার্থীকে অভিভাবক অ্যাকাউন্ট থেকে সরাতে চাইলে নামের পাশের **"Unlink"** ক্রস চিহ্নে ক্লিক করুন।

---

### ৩. অভিভাবক কীভাবে অ্যাকাউন্ট চালু করবেন

১. **লিংকে প্রবেশ করুন:**  
   অভিভাবক তার মোবাইলে পাওয়া লিংকে ক্লিক করবেন (`/activate?token=...`)।
২. **তথ্য যাচাই:**  
   স্ক্রিনে অভিভাবকের নাম এবং মোবাইল নম্বর দেখা যাবে।
৩. **পাসওয়ার্ড তৈরি করুন:**  
   - নিজের জন্য একটি গোপন পাসওয়ার্ড টাইপ করুন (কমপক্ষে ৮ অক্ষর)।
   - পুনরায় পাসওয়ার্ড লিখে নিশ্চিত করুন।
৪. **অ্যাক্টিভেশন সম্পন্ন করুন:**  
   - **"Activate Account"** চাপুন।
   - অ্যাকাউন্ট চালু হয়ে স্বয়ংক্রিয়ভাবে অভিভাবক লগইন স্ক্রিনে (`/login?tab=guardian`) নিয়ে যাবে।
৫. **লগইন করার নিয়ম:**  
   - স্কুলের ওয়েবসাইটে গিয়ে **"লগইন"** পেজে **"Guardian"** ট্যাব সিলেক্ট করুন।
   - আপনার নিবন্ধিত মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে ড্যাশবোর্ডে প্রবেশ করুন।

---

### ৪. প্রশাসনিক সহায়তা ও নিরাপত্তা

- **পাসওয়ার্ড ভুলে গেলে:**  
  অভিভাবক পাসওয়ার্ড ভুলে গেলে অ্যাডমিন `/dashboard/guardians` পেজ থেকে **"Reset"** চেপে নতুন লিংক প্রদান করবেন।
- **সাময়িক স্থগিত বা বন্ধ:**  
  জরুরি প্রয়োজনে **"Suspend"** চেপে অ্যাকাউন্ট বন্ধ রাখা যাবে এবং **"Reactivate"** চেপে পুনরায় চালু করা যাবে।
