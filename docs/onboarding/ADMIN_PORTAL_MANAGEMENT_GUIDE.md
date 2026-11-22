# EducationOS — Central Identity & Access Management (IAM) Guide
# কেন্দ্রীয় পরিচিতি ও নিরাপত্তা প্রশাসন নির্দেশিকা

**Pilot Institution:** Kids Shine International School (KSIS)  
**Target Roles:** Platform Super Admin, School Principal / Administrator  
**Scope:** Student IAM, Guardian IAM, Faculty IAM, Security Audits, Session Revocation

---

## English Version

### 1. Architectural Principles of EducationOS IAM
EducationOS enforces zero-trust, multi-tenant identity governance across all educational stakeholders:
- **Tenant Scoping:** Every user belongs strictly to their licensed school tenant. Cross-tenant access is structurally impossible.
- **Role-Based Isolation:** Permissions are strictly mapped by role (`admin`, `teacher`, `student`, `guardian`).
- **No Self-Registration:** Students and Guardians cannot arbitrarily register accounts; identities must originate from verified academic enrollment records.
- **Single-Use Tokens:** All invitations and password setup links use single-use cryptographic tokens (SHA-256 hashed in database, 7-day TTL).
- **Graceful Lifecycle Management:** Immediate suspension locks access, while academic records remain intact.

---

### 2. Central Directory Controls

#### A. Managing Students (`/dashboard/students`)
| Action | Purpose | How to Trigger |
|---|---|---|
| **Enable Portal** | Provisions digital login for an enrolled student. | Click "Enable" on student row or "Enable Portal Access" in 360 Workspace → Portal & Access tab. |
| **Copy Link** | Copies single-use `/activate?token=...` link. | Click "Copy Link" in activation modal. |
| **Share via WhatsApp** | Dispatches pre-composed invitation to parent. | Click "Share via WhatsApp" button. |
| **Reset Password** | Issues fresh single-use activation/reset token. | Click "Reset" on student row. |
| **Suspend** | Immediately blocks student login without deleting data. | Click "Suspend" on student row. |
| **Reactivate** | Restores login access for suspended student. | Click "Reactivate" on student row. |

#### B. Managing Guardians (`/dashboard/guardians`)
| Action | Purpose | How to Trigger |
|---|---|---|
| **Invite New Guardian** | Registers a guardian, links child, and generates activation link. | Click "Invite New Guardian" purple button. |
| **Link Student** | Connects sibling/child to an existing guardian account. | Click "Link Student" on guardian card. |
| **Unlink Student** | Removes parental view of specific child. | Click "Unlink" (×) badge beside child's name. |
| **Reset Password** | Generates new single-use activation link for guardian. | Click "Reset" on guardian card. |
| **Suspend / Reactivate** | Instantly toggles guardian portal access state. | Click "Suspend" or "Reactivate". |

---

### 3. Token & Session Security

1. **Token Invalidation:** When a token is used at `/activate`, it is marked as consumed immediately in a single database transaction. Re-using the link returns `400 Bad Request: Invitation token has already been consumed or is invalid`.
2. **Expired Tokens:** Tokens expire after 7 days (168 hours). Attempting activation after expiration produces an expiration notice advising the user to contact the school office.
3. **Session Cleansing:** When any user logs out, `clearSession()` flushes all JWT access tokens, refresh tokens, active tenant identifiers, and cached offline state from the client device.

---

## বাংলা সংস্করণ (Bangla Version)

### ১. নিরাপত্তা ও পরিচিতি পরিচালনার মূলনীতি
এডুকেশনওএস প্ল্যাটফর্মের ব্যবহারকারী পরিচিতি ও ডেটা সুরক্ষার মূল বৈশিষ্ট্যসমূহ:
- **প্রতিষ্ঠানভিত্তিক সম্পূর্ণ নিরাপত্তা:** একটি স্কুলের ডেটা বা অ্যাকাউন্ট অন্য স্কুলের সাথে কখনোই মিশ্রিত হতে পারে না।
- **ভূমিকাভিত্তিক নিয়ন্ত্রণ (RBAC):** অ্যাডমিন, শিক্ষক, অভিভাবক ও শিক্ষার্থীর জন্য সুনির্দিষ্ট অধিকার ও পৃথক পোর্টাল।
- **স্বয়ংক্রিয় সাইন-আপ নিষিদ্ধ:** বহিরাগত কেউ সাইন-আপ করতে পারবে না; শুধুমাত্র স্কুলে তালিকাভুক্ত শিক্ষার্থী ও অভিভাবকদেরই অ্যাডমিন অনুমোদন দিতে পারবেন।
- **নিরাপদ ওয়ান-টাইম লিংক:** অ্যাক্টিভেশন ও পাসওয়ার্ড রিসেট লিংকগুলো একবার ব্যবহারের পর স্বয়ংক্রিয়ভাবে অকার্যকর হয়ে যায়।

---

### ২. অ্যাডমিন প্যানেল থেকে নিয়ন্ত্রণ পদ্ধতি

#### ক. শিক্ষার্থী পোর্টাল নিয়ন্ত্রণ (`/dashboard/students`)
- **Enable Portal:** নতুন শিক্ষার্থীর পোর্টাল অ্যাকাউন্ট চালু করে অ্যাক্টিভেশন লিংক তৈরি করে।
- **Copy Link / WhatsApp Share:** লিংকটি কপি করে সরাসরি অভিভাবকের হোয়াটসঅ্যাপে পাঠানোর সুবিধা।
- **Reset:** শিক্ষার্থী পাসওয়ার্ড ভুলে গেলে নতুন পাসওয়ার্ড তৈরির লিংক প্রদান।
- **Suspend:** প্রয়োজনবোধে শিক্ষার্থীর পোর্টাল অ্যাকাউন্ট সাময়িক বন্ধ করে দেওয়া (এতে তার একাডেমিক ডেটা অক্ষত থাকে)।
- **Reactivate:** স্থগিত অ্যাকাউন্ট পুনরায় চালু করা।

#### খ. অভিভাবক পোর্টাল নিয়ন্ত্রণ (`/dashboard/guardians`)
- **Invite New Guardian:** অভিভাবকের নাম ও ফোন নম্বর দিয়ে অ্যাকাউন্ট তৈরি এবং সন্তান সংযোগ।
- **Link Student:** একই অভিভাবকের অধীনে অন্য সন্তানকে যুক্ত করা (এক অ্যাকাউন্টে একাধিক ভাই-বোন)।
- **Unlink:** ভুলক্রমে কোনো শিক্ষার্থী যুক্ত হলে তাকে আনলিংক করা।
- **Suspend / Reactivate:** অভিভাবকের পোর্টাল সাময়িক বন্ধ বা পুনরায় চালু করা।
