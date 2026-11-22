# EducationOS — Bilingual Localization & Cultural Adaptation Audit
**Languages Supported:** English (EN) & Bengali (BN / বাংলা)  
**Timezone / Locale:** `Asia/Dhaka` / `bn-BD` & `en-GB`  
**Currency:** Bangladeshi Taka (BDT / ৳)  
**File:** `frontend/lib/i18n.ts`  
**Date:** November 2026

---

## 1. Localization Architecture

EducationOS provides native, instantaneous bilingual switching across all administrative and portal routes without requiring full page reloads.

### Core Architecture Components
1. **Canonical Dictionary (`DICTIONARY` in `frontend/lib/i18n.ts`):** Over 120 key-value pairs mapping semantic identifiers to English and Bengali translations.
2. **Translation Resolver (`resolveTranslation(key, language)`):** Safely retrieves the target language string, falling back to English or the raw key if a translation is missing.
3. **BDT Currency Formatter (`formatBDT(amount)`):**
   ```typescript
   export function formatBDT(amount: number): string {
     return `৳${Math.round(amount).toLocaleString("en-BD")}`;
   }
   ```
4. **Bilingual Date Formatter (`formatDate(date, language)`):**
   ```typescript
   export function formatDate(date: Date | string, language: Language = "EN"): string {
     const d = typeof date === "string" ? new Date(date) : date;
     if (isNaN(d.getTime())) return "";
     const locale = language === "BN" ? "bn-BD" : "en-GB";
     return new Intl.DateTimeFormat(locale, {
       year: "numeric",
       month: "short",
       day: "numeric",
     }).format(d);
   }
   ```

---

## 2. Module Coverage Breakdown

| Module | English Examples | Bengali Translation | Status |
|---|---|---|---|
| **Platform Navigation** | Solutions, Pricing, Technology, Documentation | সমাধানসমূহ, মূল্যতালিকা, প্রযুক্তি, নির্দেশিকা | **100% Covered** |
| **Dashboard Overview** | Institutional Command Dashboard, Today's Attendance | প্রাতিষ্ঠানিক কমান্ড ড্যাশবোর্ড, আজকের উপস্থিতি | **100% Covered** |
| **Weekly Cadence** | Week 1 (Days 1–7), Month-End Admin Preview | ১ম সপ্তাহ (১–৭ তারিখ), মাসান্তিক অডিট ও ক্লোজিং প্রিভিউ | **100% Covered** |
| **Students Module** | Student Directory & Registry, New Admission | শিক্ষার্থী তালিকা ও রেজিস্ট্রি, নতুন ভর্তি (৮-ধাপ উইজার্ড) | **100% Covered** |
| **Teachers Module** | Faculty Directory & Workload, Onboard Educator | শিক্ষক ও ফ্যাকাল্টি পরিষদ, নতুন শিক্ষক যুক্ত করুন | **100% Covered** |
| **Finance Module** | Financial Operations & Tuition Ledger, Collect Fee | ফি ও হিসাবরক্ষণ ব্যবস্থাপনা, ফি আদায় করুন | **100% Covered** |
| **Attendance Module** | Attendance & Bio-Metric Registry, Present, Absent | ডিজিটাল ও বায়োমেট্রিক হাজিরা, উপস্থিত, অনুপস্থিত | **100% Covered** |
| **Notices Module** | Official Notice Board, Gemini 2.5 AI Notice Copilot | অফিসিয়াল নোটিশ বোর্ড ও সার্কুলার, জেমিনাই ২.৫ এআই সহকারী | **100% Covered** |
| **Guardian Portal** | Guardian Portal & Ward Overview, Total Fees Paid | অভিভাবক পোর্টাল ও সন্তানের তথ্য, মোট পরিশোধিত ফি | **100% Covered** |
| **Student IAM** | Portal Access & Credentials, Generate Activation Link | পোর্টাল এক্সেস ও পরিচয়পত্র, এক্টিভেশন লিংক তৈরি করুন | **100% Covered** |

---

## 3. Financial & Receipts Localization

All monetary displays across `/dashboard/finance` adhere to official Bangladeshi accounting formats:
- Cleared Receipt Badge: `{language === "EN" ? "Cleared" : "পরিশোধিত"}`
- Money Receipt Print Pad:
  * "Total Fees Paid": "মোট জমা ফি"
  * "Outstanding Balance Due": "বর্তমান মোট বকেয়া"
  * "All dues fully cleared": "কোনো বকেয়া নেই"
  * "Payment Method": "পেমেন্ট মাধ্যম" (Cash, bKash, Nagad, Bank Deposit)
  * "Verified money receipts cleared": "জমা সম্পন্ন হওয়া রসিদ"

---

## 4. Automated Verification Results

In `frontend/tests/test_stage12_5_public_website.test.ts`:
- `should resolve known keys in English and Bengali`: **PASSED**
- `should fallback gracefully to key or English when key is missing`: **PASSED**
- `should verify essential navigation and legal translation dictionary entries`: **PASSED**
- `should format currency in BDT and dates bilingually using Intl.DateTimeFormat`: **PASSED**
