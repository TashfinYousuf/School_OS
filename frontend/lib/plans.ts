// frontend/lib/plans.ts

export interface PlanItem {
  id: string;
  name: string;
  category: "school" | "academy" | "unified";
  priceMonthlyBdt: number;
  maxStudents: number;
  aiQuota: number;
  popular?: boolean;
  features: string[];
}

export const APPROVED_PLANS: PlanItem[] = [
  {
    id: "school_starter",
    name: "School Starter",
    category: "school",
    priceMonthlyBdt: 990,
    maxStudents: 100,
    aiQuota: 100,
    features: [
      "Up to 100 Students",
      "1-Tap Attendance Ledger",
      "Cash & bKash Fee Receipts",
      "Print-Ready A4 Report Cards",
      "100 AI Exam Questions / mo",
      "Offline Sync Support"
    ]
  },
  {
    id: "school_growth",
    name: "School Growth",
    category: "school",
    priceMonthlyBdt: 2490,
    maxStudents: 500,
    aiQuota: 500,
    popular: true,
    features: [
      "Up to 500 Students",
      "Teacher Voice Diary AI Copilot",
      "Automated WhatsApp Alerts",
      "Full NCTB Grading Engine",
      "500 AI Exam Questions / mo",
      "Admissions & Guardian Portal"
    ]
  },
  {
    id: "school_pro",
    name: "School Professional",
    category: "school",
    priceMonthlyBdt: 5990,
    maxStudents: 1500,
    aiQuota: 2000,
    features: [
      "Up to 1,500 Students",
      "Camera OMR Sheet Scanner",
      "Multi-Branch Administration",
      "Append-Only Audit Ledger",
      "2,000 AI Exam Questions / mo",
      "Priority SLA Support"
    ]
  },
  {
    id: "academy_starter",
    name: "Academy Starter",
    category: "academy",
    priceMonthlyBdt: 1490,
    maxStudents: 150,
    aiQuota: 200,
    features: [
      "Up to 150 Batch Enrollments",
      "Shifts & Timetable Scheduling",
      "Live MCQ Exams (-0.25 Negative Marking)",
      "Central Merit Ranking Lists",
      "200 AI Exam Questions / mo",
      "Offline Synchronization"
    ]
  },
  {
    id: "academy_growth",
    name: "Academy Growth",
    category: "academy",
    priceMonthlyBdt: 3990,
    maxStudents: 600,
    aiQuota: 1000,
    popular: true,
    features: [
      "Up to 600 Batch Enrollments",
      "High-Concurrency Live Exams",
      "Socratic AI Doubt Solver Studio",
      "Detailed Solution Sheet PDF Export",
      "1,000 AI Exam Questions / mo",
      "Batch Tuition Installments"
    ]
  },
  {
    id: "unified_pro",
    name: "Unified Campus Pro",
    category: "unified",
    priceMonthlyBdt: 9990,
    maxStudents: 2500,
    aiQuota: 5000,
    features: [
      "Dual Workspace: School + Academy",
      "Shared Teacher Profiles & Separated Ledgers",
      "Up to 2,500 Combined Students",
      "Dedicated OMR & AI Ingestion Pipelines",
      "AEGIS-X Sentinel Security Auditing",
      "5,000 AI Exam Questions / mo"
    ]
  }
];



// -----------------------------------------------------------------------------
// Dynamic Pricing Engine (Stage 2)
// Authoritative Client-Side Mirror & Calculator Helper
// -----------------------------------------------------------------------------
export const DYNAMIC_PRICING_VERSION = "2026.1-dynamic";
export const BASE_PLATFORM_FEE_BDT = 1500;
export const ANNUAL_DISCOUNT_PERCENT = 15;

export interface ModuleItem {
  id: string;
  name: string;
  category: "core" | "ai" | "finance" | "web" | "communication";
  priceMonthlyBdt: number;
  isCore: boolean;
  description: string;
}

export interface AddonItem {
  id: string;
  name: string;
  unitPriceBdt: number;
  unitsIncluded: number;
  unitLabel: string;
}

export const CORE_MODULES: Record<string, ModuleItem> = {
  core_admin: {
    id: "core_admin",
    name: "Institution Administration",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Multi-role RBAC, security settings, academic calendar, and campus configuration."
  },
  core_students: {
    id: "core_students",
    name: "Student Directory & Admissions",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Student 360 digital twin, enrollment records, class roster CSV import."
  },
  core_teachers: {
    id: "core_teachers",
    name: "Teacher & Staff Management",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Staff roster, class routines, subject assignment, and attendance roll call."
  },
  core_guardians: {
    id: "core_guardians",
    name: "Guardian / Parent Mobile Portal",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Secure multi-child view, attendance tracking, and fee receipt inspection."
  },
  core_academic: {
    id: "core_academic",
    name: "Academic Structure & Routines",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Classes, sections, subjects, periods, and timetable builder."
  },
  core_attendance: {
    id: "core_attendance",
    name: "Smart Attendance & Offline Sync",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "1-tap roll call, offline IndexedDB sync, CSV export, and A4 print view."
  },
  core_exams: {
    id: "core_exams",
    name: "Examinations & Grading Registry",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Exam schedules, mark sheets, NCTB/GPA calculation, and PDF report cards."
  },
  core_notices: {
    id: "core_notices",
    name: "Notices & Institutional Communication",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Official notice board, SMS push alerts, and broadcast messaging."
  },
  core_reports: {
    id: "core_reports",
    name: "Standard Operational Reports",
    category: "core",
    priceMonthlyBdt: 0,
    isCore: true,
    description: "Class-wise attendance summaries, absentee rosters, and basic metrics."
  }
};

export const OPTIONAL_MODULES: Record<string, ModuleItem> = {
  module_ai_assistant: {
    id: "module_ai_assistant",
    name: "AI Copilot & Question Paper Generator",
    category: "ai",
    priceMonthlyBdt: 1200,
    isCore: false,
    description: "Includes 250k monthly Gemini tokens, exam question composer, and syllabus chunk RAG."
  },
  module_advanced_finance: {
    id: "module_advanced_finance",
    name: "Advanced Finance & Fee Collection",
    category: "finance",
    priceMonthlyBdt: 800,
    isCore: false,
    description: "Dual-copy student fee receipts, bank/bKash ledger reconciliation, and tuition fee history."
  },
  module_school_website: {
    id: "module_school_website",
    name: "Hosted Institutional Public Website",
    category: "web",
    priceMonthlyBdt: 1000,
    isCore: false,
    description: "Templated public website with school about, notices, gallery, and admission inquiries."
  },
  module_custom_domain: {
    id: "module_custom_domain",
    name: "Custom Domain Integration & SSL",
    category: "web",
    priceMonthlyBdt: 500,
    isCore: false,
    description: "Automated DNS hostname mapping (school.edu.bd) with managed wildcard TLS certificate."
  },
  module_whatsapp_alerts: {
    id: "module_whatsapp_alerts",
    name: "Automated WhatsApp Absentee Alerts",
    category: "communication",
    priceMonthlyBdt: 600,
    isCore: false,
    description: "Instant WhatsApp message delivery to parents when child is marked absent."
  }
};

export const AVAILABLE_ADDONS: Record<string, AddonItem> = {
  sms_bundle_500: {
    id: "sms_bundle_500",
    name: "SMS Communication Credits",
    unitPriceBdt: 175,
    unitsIncluded: 500,
    unitLabel: "500 SMS Credits"
  },
  ai_tokens_500k: {
    id: "ai_tokens_500k",
    name: "Extra AI Model Tokens",
    unitPriceBdt: 250,
    unitsIncluded: 500000,
    unitLabel: "500k Tokens Pack"
  }
};

export function calculateStudentCharge(count: number): number {
  if (count <= 0) return 0;
  let total = 0;
  let remaining = count;

  // Tier 1: up to 300 @ 12 BDT
  const t1 = Math.min(remaining, 300);
  total += t1 * 12;
  remaining -= t1;

  // Tier 2: 301 to 800 @ 10 BDT (up to 500 students)
  if (remaining > 0) {
    const t2 = Math.min(remaining, 500);
    total += t2 * 10;
    remaining -= t2;
  }

  // Tier 3: 801+ @ 8 BDT
  if (remaining > 0) {
    total += remaining * 8;
  }

  return total;
}

export interface DynamicQuoteCalculation {
  institutionType: string;
  studentCount: number;
  billingCycle: "monthly" | "annual";
  basePlatformFeeBdt: number;
  studentChargeBdt: number;
  modulesSubtotalBdt: number;
  addonsSubtotalBdt: number;
  monthlyGrossBdt: number;
  discountPercent: number;
  discountAmountBdt: number;
  monthlyNetBdt: number;
  totalDueBdt: number;
  billingPeriodMonths: number;
  selectedModules: string[];
  selectedAddons: Record<string, number>;
  isPilot: boolean;
}

export function calculateDynamicQuote(params: {
  institutionType?: string;
  studentCount: number;
  selectedModules: string[];
  add_ons?: Record<string, number>;
  billingCycle: "monthly" | "annual";
  pilotCode?: string;
}): DynamicQuoteCalculation {
  const institutionType = params.institutionType || "school";
  const studentCount = Math.max(0, params.studentCount);
  const billingCycle = params.billingCycle;
  const isPilot = Boolean(params.pilotCode && params.pilotCode.trim().toUpperCase() === "KIDSSHINE");

  const basePlatformFeeBdt = BASE_PLATFORM_FEE_BDT;
  const studentChargeBdt = calculateStudentCharge(studentCount);

  let modulesSubtotalBdt = 0;
  for (const modId of params.selectedModules) {
    if (OPTIONAL_MODULES[modId]) {
      modulesSubtotalBdt += OPTIONAL_MODULES[modId].priceMonthlyBdt;
    }
  }

  let addonsSubtotalBdt = 0;
  const selectedAddons = params.add_ons || {};
  for (const [addonId, qty] of Object.entries(selectedAddons)) {
    if (AVAILABLE_ADDONS[addonId] && qty > 0) {
      addonsSubtotalBdt += AVAILABLE_ADDONS[addonId].unitPriceBdt * qty;
    }
  }

  const monthlyGrossBdt = basePlatformFeeBdt + studentChargeBdt + modulesSubtotalBdt + addonsSubtotalBdt;
  const isAnnual = billingCycle === "annual";
  const billingPeriodMonths = isAnnual ? 12 : 1;
  const discountPercent = isAnnual ? ANNUAL_DISCOUNT_PERCENT : 0;

  let discountAmountBdt = 0;
  let totalDueBdt = monthlyGrossBdt;

  if (isAnnual) {
    const annualGross = monthlyGrossBdt * 12;
    discountAmountBdt = Math.round(annualGross * (discountPercent / 100));
    totalDueBdt = annualGross - discountAmountBdt;
  }

  let monthlyNetBdt = Math.round(totalDueBdt / billingPeriodMonths);

  if (isPilot) {
    totalDueBdt = 0;
    monthlyNetBdt = 0;
  }

  return {
    institutionType,
    studentCount,
    billingCycle,
    basePlatformFeeBdt,
    studentChargeBdt,
    modulesSubtotalBdt,
    addonsSubtotalBdt,
    monthlyGrossBdt,
    discountPercent,
    discountAmountBdt,
    monthlyNetBdt,
    totalDueBdt,
    billingPeriodMonths,
    selectedModules: params.selectedModules,
    selectedAddons,
    isPilot
  };
}
