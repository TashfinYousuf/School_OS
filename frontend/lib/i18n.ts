// frontend/lib/i18n.tsx
export type Language = "EN" | "BN";

export interface TranslationEntry {
  en: string;
  bn: string;
}

export const DICTIONARY: Record<string, TranslationEntry> = {
  // Navigation
  "nav.brand": {
    en: "EducationOS",
    bn: "এডুকেশন ওএস",
  },
  "nav.solutions": {
    en: "Solutions",
    bn: "সমাধানসমূহ",
  },
  "nav.schools": {
    en: "K-12 Schools",
    bn: "কে-১২ স্কুল",
  },
  "nav.colleges": {
    en: "Colleges",
    bn: "কলেজ ও উচ্চ মাধ্যমিক",
  },
  "nav.academies": {
    en: "Coaching & Academies",
    bn: "কোচিং ও একাডেমি",
  },
  "nav.features": {
    en: "Features",
    bn: "ফিচারসমূহ",
  },
  "nav.pricing": {
    en: "Pricing",
    bn: "মূল্যতালিকা",
  },
  "nav.technology": {
    en: "Technology",
    bn: "প্রযুক্তি",
  },
  "nav.security": {
    en: "Security",
    bn: "নিরাপত্তা",
  },
  "nav.docs": {
    en: "Documentation",
    bn: "নির্দেশিকা",
  },
  "nav.help": {
    en: "Help Center",
    bn: "সহায়তা কেন্দ্র",
  },
  "nav.contact": {
    en: "Contact",
    bn: "যোগাযোগ",
  },
  "nav.login": {
    en: "Institutional Login",
    bn: "প্রতিষ্ঠান লগইন",
  },
  "nav.getStarted": {
    en: "Start Free Trial",
    bn: "ফ্রি ট্রায়াল শুরু করুন",
  },

  // Hero Section
  "hero.badge": {
    en: "Next-Gen Autonomous Institutional Platform",
    bn: "স্বয়ংক্রিয় শিক্ষাপ্রতিষ্ঠান ব্যবস্থাপনা প্ল্যাটফর্ম",
  },
  "hero.title": {
    en: "The Operating System for Modern Education",
    bn: "আধুনিক শিক্ষাপ্রতিষ্ঠানের নির্ভরযোগ্য অপারেটিং সিস্টেম",
  },
  "hero.subtitle": {
    en: "Unify student admissions, biometric attendance, double-entry fee collection, NCTB grading, and AI-powered lesson planning under a single secure platform.",
    bn: "শিক্ষার্থী ভর্তি, ডিজিটাল হাজিরা, হিসাবরক্ষণ ও ফি কালেকশন, এনসিটিবি গ্রেডিং এবং এআই পাঠ পরিকল্পনা—সবকিছু এক প্ল্যাটফর্মে।",
  },
  "hero.ctaTrial": {
    en: "Start 30-Day Free Trial",
    bn: "৩০ দিনের ফ্রি ট্রায়াল নিন",
  },
  "hero.ctaExplore": {
    en: "Explore Solutions",
    bn: "সমাধানগুলো দেখুন",
  },
  "hero.trustCurriculum": {
    en: "NCTB Curriculum Ready",
    bn: "এনসিটিবি কারিকুলাম বান্ধব",
  },
  "hero.trustRls": {
    en: "PostgreSQL Native RLS Isolation",
    bn: "পোস্টগ্রেসকুএল আরএলএস ডেটা নিরাপত্তা",
  },
  "hero.trustOffline": {
    en: "Offline PWA Synchronization",
    bn: "অফলাইন পিডব্লিউএ সিঙ্ক",
  },

  // Persona Selector
  "persona.title": {
    en: "Tailored for Every Educational Entity",
    bn: "প্রতিটি শিক্ষাপ্রতিষ্ঠানের জন্য সুনির্দিষ্ট সমাধান",
  },
  "persona.subtitle": {
    en: "Select your institution type to see dedicated workflows and operational benefits.",
    bn: "আপনার প্রতিষ্ঠানের ধরণ অনুযায়ী ফিচার ও সুবিধাগুলো দেখুন।",
  },
  "persona.schoolTab": {
    en: "K-12 Formal Schools",
    bn: "কে-১২ সাধারণ ও মডেল স্কুল",
  },
  "persona.collegeTab": {
    en: "Higher Secondary & Colleges",
    bn: "কলেজ ও উচ্চ মাধ্যমিক",
  },
  "persona.academyTab": {
    en: "Coaching Centers & Academies",
    bn: "কোচিং সেন্টার ও মডেল টেস্ট একাডেমি",
  },

  // Pricing
  "pricing.title": {
    en: "Transparent, Predictable Institutional Pricing",
    bn: "স্বচ্ছ ও সাশ্রয়ী প্রাতিষ্ঠানিক মূল্যতালিকা",
  },
  "pricing.subtitle": {
    en: "No hidden setup fees. Choose monthly flexibility or annual savings (12 months for the price of 10).",
    bn: "কোনো গোপন খরচ নেই। মাসিক ভিত্তিতে নিন অথবা বার্ষিক সাবস্ক্রিপশনে ২ মাস ফ্রি পান।",
  },
  "pricing.monthly": {
    en: "Monthly Billing",
    bn: "মাসিক বিলিং",
  },
  "pricing.annual": {
    en: "Annual Billing (2 Months Free)",
    bn: "বার্ষিক বিলিং (২ মাস সম্পূর্ণ ফ্রি)",
  },
  "pricing.perMonth": {
    en: "/month",
    bn: "/মাস",
  },
  "pricing.bdt": {
    en: "৳",
    bn: "৳",
  },
  "pricing.startTrial": {
    en: "Activate 30-Day Trial",
    bn: "৩০ দিনের ট্রায়াল শুরু করুন",
  },

  // ROI Calculator
  "roi.title": {
    en: "Institutional Time & Savings Estimator",
    bn: "প্রাতিষ্ঠানিক সময় ও ব্যয় সাশ্রয় ক্যালকুলেটর",
  },
  "roi.subtitle": {
    en: "Estimate hours saved in exam tabulation, fee reconciliation, and parent communication.",
    bn: "রেজাল্ট তৈরি, ফি আদায় ও অভিভাবক যোগাযোগে মাসিক কত সময় বাঁচবে তা হিসাব করুন।",
  },
  "roi.disclaimer": {
    en: "*Estimates are projected based on typical operational benchmarks and do not represent a legally guaranteed outcome.",
    bn: "*হিসাবটি সাধারণ প্রাতিষ্ঠানিক ডেটার ওপর ভিত্তি করে অনুমিত এবং কোনো নিশ্চয়তা প্রদান করে না।",
  },

  // Footer
  "footer.rights": {
    en: "All rights reserved. Built for high-performing educational institutions.",
    bn: "সর্বস্বত্ব সংরক্ষিত। উচ্চমানের শিক্ষাপ্রতিষ্ঠানের জন্য নির্মিত।",
  },
  "footer.regulatory": {
    en: "Official Bangladesh Educational Standards & Frameworks Reference Links (Non-Affiliated)",
    bn: "বাংলাদেশ শিক্ষা বোর্ড ও সরকারি শিক্ষা পোর্টাল রেফারেন্স লিংকসমূহ (অননুমোদিত বা অসম্পৃক্ত)",
  },

  // Common UI Actions & Labels
  "common.search": { en: "Search", bn: "অনুসন্ধান" },
  "common.filter": { en: "Filter", bn: "ফিল্টার" },
  "common.all": { en: "All", bn: "সকল" },
  "common.close": { en: "Close", bn: "বন্ধ করুন" },
  "common.cancel": { en: "Cancel", bn: "বাতিল" },
  "common.save": { en: "Save", bn: "সংরক্ষণ করুন" },
  "common.update": { en: "Update", bn: "আপডেট করুন" },
  "common.delete": { en: "Delete", bn: "মুছে ফেলুন" },
  "common.submit": { en: "Submit", bn: "দাখিল করুন" },
  "common.export": { en: "Export", bn: "এক্সপোর্ট" },
  "common.print": { en: "Print", bn: "প্রিন্ট করুন" },
  "common.back": { en: "Back", bn: "পূর্ববর্তী" },
  "common.next": { en: "Next", bn: "পরবর্তী" },
  "common.loading": { en: "Loading...", bn: "লোড হচ্ছে..." },
  "common.actions": { en: "Actions", bn: "পদক্ষেপ" },
  "common.status": { en: "Status", bn: "অবস্থা" },
  "common.details": { en: "Details", bn: "বিস্তারিত" },
  "common.view": { en: "View", bn: "দেখুন" },
  "common.edit": { en: "Edit", bn: "সম্পাদনা" },
  "common.active": { en: "Active", bn: "সক্রিয়" },
  "common.inactive": { en: "Inactive", bn: "নিষ্ক্রিয়" },
  "common.completed": { en: "Completed", bn: "সম্পন্ন" },
  "common.pending": { en: "Pending", bn: "অপেক্ষমান" },
  "common.failed": { en: "Failed", bn: "ব্যর্থ" },
  "common.date": { en: "Date", bn: "তারিখ" },
  "common.shift": { en: "Shift", bn: "শিফট" },
  "common.class": { en: "Class", bn: "শ্রেণি" },
  "common.section": { en: "Section", bn: "শাখা" },
  "common.roll": { en: "Roll", bn: "রোল" },
  "common.group": { en: "Group", bn: "বিভাগ" },

  // Dashboard Overview
  "dashboard.overviewTitle": { en: "Institutional Command Dashboard", bn: "প্রাতিষ্ঠানিক কমান্ড ড্যাশবোর্ড" },
  "dashboard.todayAttendance": { en: "Today's Attendance", bn: "আজকের উপস্থিতি" },
  "dashboard.monthRevenue": { en: "Monthly Fee Collection", bn: "চলতি মাসের ফি আদায়" },
  "dashboard.totalEnrolled": { en: "Total Enrolled Students", bn: "মোট সক্রিয় শিক্ষার্থী" },
  "dashboard.activeStaff": { en: "Active Faculty & Staff", bn: "সক্রিয় শিক্ষক ও কর্মী" },
  "dashboard.weeklyCadence": { en: "Weekly Cadence & Monthly Aggregation", bn: "সাপ্তাহিক হিসাব ও মাসিক একত্রীকরণ" },
  "dashboard.monthEndPreview": { en: "Month-End Admin Preview", bn: "মাসান্তিক অডিট ও ক্লোজিং প্রিভিউ" },
  "dashboard.monthEndDesc": { en: "Executive transition review & audit readiness checklist for next cycle", bn: "পরবর্তী মাসের প্রস্তুতি, হিসাব মেলানো এবং অডিট চেকলিস্ট" },
  "dashboard.viewClosingPreview": { en: "Open Month-End Preview", bn: "মাসান্তিক প্রিভিউ দেখুন" },
  "dashboard.week1": { en: "Week 1 (Days 1–7)", bn: "১ম সপ্তাহ (১–৭ তারিখ)" },
  "dashboard.week2": { en: "Week 2 (Days 8–14)", bn: "২য় সপ্তাহ (৮–১৪ তারিখ)" },
  "dashboard.week3": { en: "Week 3 (Days 15–21)", bn: "৩য় সপ্তাহ (১৫–২১ তারিখ)" },
  "dashboard.week4": { en: "Week 4+ (Days 22–End)", bn: "৪র্থ সপ্তাহ+ (২২–শেষ তারিখ)" },
  "dashboard.activeWeek": { en: "Active Week", bn: "চলমান সপ্তাহ" },
  "dashboard.quickActions": { en: "Rapid Actions", bn: "দ্রুত পদক্ষেপ" },
  "dashboard.recordAttendance": { en: "Daily Attendance", bn: "ডিজিটাল হাজিরা" },
  "dashboard.collectFee": { en: "Collect Fee", bn: "ফি গ্রহণ করুন" },
  "dashboard.publishNotice": { en: "Publish Notice", bn: "বিজ্ঞপ্তি জারি" },
  "dashboard.admitStudent": { en: "Admit Student", bn: "শিক্ষার্থী ভর্তি" },

  // Educator Classroom Dashboard
  "educator.greeting": { en: "Welcome Back, Respected Educator", bn: "স্বাগতম, শ্রদ্ধেয় শিক্ষক" },
  "educator.todayClasses": { en: "Today's Scheduled Classes", bn: "আজকের পাঠদান রুটিন" },
  "educator.assignedStudents": { en: "Assigned Students", bn: "দায়িত্বপ্রাপ্ত শিক্ষার্থী" },
  "educator.takeAttendance": { en: "Take Classroom Attendance", bn: "হাজিরা নিন" },
  "educator.submitGrades": { en: "Grading & Exam Tabulation", bn: "নম্বর ও ফলাফল প্রকাশ" },
  "educator.createQuestions": { en: "AI Question Generator", bn: "এআই প্রশ্ন প্রণয়ন" },
  "educator.curriculumRag": { en: "Curriculum Reference (RAG)", bn: "কারিকুলাম রেফারেন্স" },

  // Students Module
  "students.title": { en: "Student Directory & Registry", bn: "শিক্ষার্থী তালিকা ও রেজিস্ট্রি" },
  "students.newAdmission": { en: "New Admission (8-Step Wizard)", bn: "নতুন ভর্তি (৮-ধাপ উইজার্ড)" },
  "students.searchPlaceholder": { en: "Search by student name, roll, or admission ID...", bn: "শিক্ষার্থীর নাম, রোল বা ভর্তি আইডি দিয়ে খুঁজুন..." },
  "students.filterClass": { en: "Filter by Class", bn: "শ্রেণি অনুযায়ী ফিল্টার" },
  "students.tableId": { en: "Admission ID", bn: "ভর্তি আইডি" },
  "students.tableName": { en: "Student Name", bn: "শিক্ষার্থীর নাম" },
  "students.tableRoll": { en: "Roll No.", bn: "রোল নং" },
  "students.tableClass": { en: "Class & Section", bn: "শ্রেণি ও শাখা" },
  "students.tableGuardian": { en: "Guardian Info", bn: "অভিভাবকের তথ্য" },
  "students.tableBalance": { en: "Due Balance", bn: "বকেয়া ফি" },
  "students.tableActions": { en: "Actions", bn: "অ্যাকশন" },
  "students.view360": { en: "360° Profile", bn: "৩৬০° প্রোফাইল" },
  "students.admissionSlip": { en: "Admission Slip", bn: "ভর্তি রসিদ" },

  // Teachers Module
  "teachers.title": { en: "Faculty Directory & Academic Workload", bn: "শিক্ষক ও ফ্যাকাল্টি পরিষদ" },
  "teachers.onboard": { en: "Onboard Educator", bn: "নতুন শিক্ষক যুক্ত করুন" },
  "teachers.searchPlaceholder": { en: "Search by teacher name, ID, class, or subject...", bn: "শিক্ষকের নাম, আইডি, শ্রেণি বা বিষয় দিয়ে খুঁজুন..." },
  "teachers.allDepts": { en: "All Departments", bn: "সকল বিভাগ" },
  "teachers.workload": { en: "Workload & Schedule", bn: "কর্মভার ও রুটিন" },
  "teachers.qualifications": { en: "Qualifications & Experience", bn: "যোগ্যতা ও অভিজ্ঞতা" },
  "teachers.classroomActions": { en: "Quick Classroom Actions", bn: "দ্রুত ক্লাসরুম অ্যাকশন" },
  "teachers.profileRecords": { en: "Profile Records & Demographics", bn: "প্রোফাইল ও ডেমোগ্রাফিক তথ্য" },

  // Finance Module
  "finance.title": { en: "Financial Operations & Tuition Ledger", bn: "ফি ও হিসাবরক্ষণ ব্যবস্থাপনা" },
  "finance.collectFee": { en: "Collect Student Fee", bn: "ফি আদায় করুন" },
  "finance.dailyLedgerTab": { en: "Daily Collection Ledger", bn: "দৈনিক কালেকশন লেজার" },
  "finance.monthlyArchiveTab": { en: "Monthly Archive & Official Statements", bn: "মাসিক আর্কাইভ ও অফিশিয়াল স্টেটমেন্ট" },
  "finance.todayCollection": { en: "Today's Fee Collection", bn: "আজকের ফি আদায়" },
  "finance.monthCollection": { en: "Current Month Collection", bn: "চলতি মাসের মোট আদায়" },
  "finance.cumulativeRevenue": { en: "Cumulative All-Time Revenue", bn: "সর্বমোট আদায় (কিউমুলেটিভ)" },
  "finance.digitalRails": { en: "bKash / Nagad / Bank Rails", bn: "বিকাশ / নগদ / ব্যাংক রেইল" },
  "finance.receiptNo": { en: "Receipt / Txn Ref", bn: "রসিদ / ট্রানজ্যাকশন আইডি" },
  "finance.amount": { en: "Amount (BDT)", bn: "পরিমাণ (টাকা)" },
  "finance.paymentMethod": { en: "Payment Method", bn: "পেমেন্ট মাধ্যম" },
  "finance.viewHistory": { en: "View History", bn: "হিস্ট্রি দেখুন" },
  "finance.printStatement": { en: "Print Official Statement", bn: "অফিশিয়াল স্টেটমেন্ট প্রিন্ট" },

  // Attendance Module
  "attendance.title": { en: "Attendance & Bio-Metric Registry", bn: "ডিজিটাল ও বায়োমেট্রিক হাজিরা" },
  "attendance.markPresent": { en: "Present", bn: "উপস্থিত" },
  "attendance.markAbsent": { en: "Absent", bn: "অনুপস্থিত" },
  "attendance.markLate": { en: "Late", bn: "বিলম্ব" },
  "attendance.saveRegister": { en: "Save Daily Register", bn: "হাজিরা সংরক্ষণ করুন" },

  // Notices Module
  "notices.title": { en: "Official Notice Board & Circulars", bn: "অফিসিয়াল নোটিশ বোর্ড ও সার্কুলার" },
  "notices.createNotice": { en: "Draft New Notice", bn: "নতুন বিজ্ঞপ্তি লিখুন" },
  "notices.aiCopilot": { en: "Gemini 2.5 AI Notice Copilot", bn: "জেমিনাই ২.৫ এআই নোটিশ সহকারী" },
  "notices.targetAudience": { en: "Target Audience", bn: "টার্গেট অডিয়েন্স" },
  "notices.audienceAll": { en: "All Stakeholders", bn: "সকলের জন্য" },
  "notices.audienceParents": { en: "Guardians & Parents", bn: "শুধুমাত্র অভিভাবক" },
  "notices.audienceTeachers": { en: "Faculty & Staff", bn: "শুধুমাত্র শিক্ষক" },
  "notices.audienceStudents": { en: "Students Only", bn: "শুধুমাত্র শিক্ষার্থী" },
  "notices.printPad": { en: "Print Notice Pad (A4)", bn: "নোটিশ প্যাড প্রিন্ট (A4)" },
};

export function resolveTranslation(key: string, language: Language): string {
  const entry = DICTIONARY[key];
  if (!entry) return key;
  const langKey = language.toLowerCase() as "en" | "bn";
  return entry[langKey] || entry.en || key;
}

/**
 * Canonical BDT Currency Formatter
 */
export function formatBDT(amount: number): string {
  return `৳${Math.round(amount).toLocaleString("en-BD")}`;
}

/**
 * Canonical Bilingual Date Formatter using Intl.DateTimeFormat
 */
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
