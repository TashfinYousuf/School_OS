"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Search,
  ArrowRight,
  FileText,
  CheckCircle2,
  ChevronRight,
  Shield,
  Users,
  GraduationCap,
  Terminal,
  X,
  Languages
} from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

interface ManualCard {
  title: string;
  titleBn: string;
  role: string;
  description: string;
  descriptionBn: string;
  icon: any;
  contentEn: string[];
  contentBn: string[];
}

const MANUALS: ManualCard[] = [
  {
    title: "Principal & Administrator Manual",
    titleBn: "অধ্যক্ষ ও প্রতিষ্ঠান প্রধান পরিচালনা সহায়িকা",
    role: "Leadership & Administration",
    description: "Complete operational manual for academic year setup, NCTB grade scale configuration, faculty delegation, and fee governance.",
    descriptionBn: "শিক্ষাবর্ষ নির্ধারণ, জাতীয় কারিকুলাম গ্রেডিং স্কেল কনফিগারেশন, শিক্ষক পরিষদ নিয়ন্ত্রণ এবং ফি ব্যবস্থাপনার পূর্ণাঙ্গ গাইড।",
    icon: Shield,
    contentEn: [
      "1. Onboarding & Workspace Provisioning: Navigate to /onboard to establish isolated multi-tenant database partitions.",
      "2. NCTB Curriculum & Routine Engine: Auto-seeds Class 1-10 grade levels with deterministic teacher, room, and period collision engines.",
      "3. Student Directory & Excel Migration: Bulk CSV import normalizing 11-digit Bangladeshi mobile numbers and guardian linkages.",
      "4. Double-Entry Tuition Ledger: Thermal cash receipt printing (POS 58mm/80mm) with bKash/Nagad auto-reconciliation.",
      "5. Examination & Post-Publication Lock: Enforces 7-tier NCTB letter grading with immutable audit-logged marks publication."
    ],
    contentBn: [
      "১. প্রতিষ্ঠান রেজিস্ট্রেশন ও ওয়ার্কস্পেস: /onboard থেকে নতুন প্রতিষ্ঠান যুক্ত করুন যা সম্পূর্ণ ডেটাবেস আইসোলেশন নিশ্চিত করে।",
      "২. কারিকুলাম ও সংঘর্ষহীন রুটিন: ১ম থেকে ১০ম শ্রেণি স্বয়ংক্রিয়ভাবে লোড হয় এবং শিক্ষক ও রুমের সময় সংঘর্ষ আটকে দেয়।",
      "৩. এক্সেল ও সিএসভি ডেটা মাইগ্রেশন: শত শত শিক্ষার্থীর তথ্য এবং ১১ ডিজিটের অভিভাবক নম্বর এক ক্লিকে আপলোড করুন।",
      "৪. ক্যাশ কাউন্টার ও রসিদ প্রিন্ট: থার্মাল পিওএস প্রিন্টারে ফি রসিদ এবং বিকাশ/নগদে ফি আদায়ের তাৎক্ষণিক খতিয়ান।",
      "৫. পরীক্ষা ও ফলাফল প্রকাশনা: জাতীয় ৭-স্তরের গ্রেডিং স্কেল অনুযায়ী ট্রান্সক্রিপ্ট প্রকাশ এবং ফলাফল লক করার ব্যবস্থা।"
    ]
  },
  {
    title: "Faculty & Teacher User Manual",
    titleBn: "শিক্ষক ও শিক্ষিকা পরিচালনা নির্দেশিকা",
    role: "Academic Faculty",
    description: "Step-by-step guidance for 1-tap mobile roll call, offline attendance caching, continuous evaluation, and lesson logging.",
    descriptionBn: "মোবাইলে ১ ক্লিকে হাজিরা গ্রহণ, ইন্টারনেটহীন অফলাইন মোড, ধারাবাহিক মূল্যায়ন ও পাঠদান ডায়েরি লেখার নিয়মাবলী।",
    icon: GraduationCap,
    contentEn: [
      "1. 1-Tap Attendance: Open Attendance, tap any absent student to toggle, and submit. Parents receive automated SMS alerts.",
      "2. Offline Synchronization: When cellular data disconnects, attendance saves locally in IndexedDB and syncs automatically when reconnected.",
      "3. Subject Marks Tabulation: Enter CQ, MCQ, and Practical marks with boundary checks preventing invalid ranges.",
      "4. Daily Lesson & Homework Diary: Record topics taught and assign homework visible instantly on parent portals.",
      "5. Voice-to-Diary Assistant: Speak lesson summaries in natural Bengali or English; AI parses topics and homework automatically."
    ],
    contentBn: [
      "১. এক ক্লিকে হাজিরা: ক্লাসরুমে উপস্থিত শিক্ষার্থী বাদে অনুপস্থিতদের ট্যাপ করুন এবং সংরক্ষণ করুন; অভিভাবক সঙ্গে সঙ্গে এসএমএস পাবেন।",
      "২. অফলাইন সিঙ্ক সুবিধা: ইন্টারনেট সংযোগ বিচ্ছিন্ন হলেও হাজিরা বন্ধ হবে না, সংযোগ ফিরলেই স্বয়ংক্রিয়ভাবে সার্ভারে সিঙ্ক হবে।",
      "৩. পরীক্ষার নম্বর প্রদান: সৃজনশীল, বহুনির্বাচনী ও ব্যবহারিক নম্বর সহজে এন্ট্রি দিন; সর্বোচ্চ নম্বরের বেশি ইনপুট স্বয়ংক্রিয়ভাবে ব্লক হবে।",
      "৪. দৈনিক পাঠপরিকল্পনা ও বাড়ির কাজ: কোন অধ্যায় পড়ানো হলো এবং কী হোমওয়ার্ক দেওয়া হলো তা অ্যাপে রেকর্ড করুন।",
      "৫. ভয়েস ডায়েরি এআই: বাংলায় কথা বলেই দৈনিক পাঠদান ও বাড়ির কাজ স্বয়ংক্রিয়ভাবে নোট করুন।"
    ]
  },
  {
    title: "Guardian & Student Portal Guide",
    titleBn: "অভিভাবক ও শিক্ষার্থী ব্যবহার নির্দেশিকা",
    role: "Parents & Students",
    description: "Simple passwordless phone login, terminal report card downloads, attendance calendars, and digital fee payment via bKash.",
    descriptionBn: "পাসওয়ার্ডবিহীন সহজ মোবাইল লগইন, অনলাইন প্রগ্রেস রিপোর্ট কার্ড, হাজিরা ক্যালেন্ডার এবং বিকাশে বেতন পরিশোধের নিয়ম।",
    icon: Users,
    contentEn: [
      "1. Frictionless Guardian Login: Log in instantly using student admission number and registered 11-digit mobile number.",
      "2. Attendance Tracker: Color-coded calendar showing daily present, absent, late, or leave records.",
      "3. Official Report Cards: View published terminal exam transcripts with GPA, subject letter grades, and teacher remarks.",
      "4. Digital Tuition Payments: Review pending dues and pay securely via bKash, Nagad, or debit cards with instant digital receipts.",
      "5. Digital Homework & Circulars: View daily school circulars, exam routines, and emergency holiday notices."
    ],
    contentBn: [
      "১. সহজ অভিভাবক লগইন: সন্তানের ভর্তি নম্বর এবং আপনার ১১ ডিজিটের মোবাইল নম্বর দিয়েই সহজে লগইন করুন।",
      "২. উপস্থিতি ক্যালেন্ডার: সন্তান প্রতিদিন স্কুলে উপস্থিত ছিল কি না তা ক্যালেন্ডারে সবুজ ও লাল রঙে দেখুন।",
      "৩. ডিজিটাল রিপোর্ট কার্ড: প্রতিটি পরীক্ষার ফলাফল, জিপিএ, প্রাপ্ত গ্রেড এবং শিক্ষকের মন্তব্য ঘরে বসেই দেখুন।",
      "৪. বিকাশ ও অনলাইনে ফি পরিশোধ: স্কুলের বকেয়া বেতন ঘরে বসেই নিরাপদে পরিশোধ করুন এবং ডিজিটাল রসিদ ডাউনলোড করুন।",
      "৫. বাড়ির কাজ ও নোটিশ: দৈনিক হোমওয়ার্ক এবং স্কুলের জরুরি ছুটির নোটিশ সরাসরি মোবাইলে দেখুন।"
    ]
  },
  {
    title: "IT Administrator & Operations Runbook",
    titleBn: "আইটি অ্যাডমিনিস্ট্রেটর ও অপারেশন ম্যানুয়াল",
    role: "DevOps & Engineering",
    description: "Custom domain mapping, PostgreSQL RLS audit verification, Point-in-Time backups, and credential security.",
    descriptionBn: "কাস্টম ডোমেন বাইন্ডিং, পোস্টগ্রেসকিউএল রো-লেভেল সিকিউরিটি অডিট, ডেটা ব্যাকআপ ও নিরাপত্তা নির্দেশিকা।",
    icon: Terminal,
    contentEn: [
      "1. PostgreSQL Row-Level Security: All database queries enforce SET LOCAL app.current_tenant_id preventing cross-tenant leakage.",
      "2. Custom Apex Domain Binding: Map portal.schoolname.edu.bd with automated Let's Encrypt SSL provisioning.",
      "3. Continuous Backups: Automated point-in-time recovery (PITR) with encrypted off-site disaster recovery snapshots.",
      "4. Brute-Force Rate Limiting: Sliding-window credential throttle locks repeated unauthorized login attempts.",
      "5. Audit Log Inspection: Cryptographically immutable audit records capturing every financial adjustment and grade override."
    ],
    contentBn: [
      "১. রো-লেভেল সিকিউরিটি: ডেটাবেসের প্রতিটি টেবিলে টেন্যান্ট ফিল্টারিং সক্রিয়, ফলে এক প্রতিষ্ঠানের ডেটা অন্য প্রতিষ্ঠানে যাওয়ার সুযোগ নেই।",
      "২. কাস্টম ডোমেন ও এসএসএল: আপনার প্রতিষ্ঠানের নিজস্ব ডোমেন (যেমন portal.school.edu.bd) এ অটোমেটিক এসএসএল সহ যুক্ত করুন।",
      "৩. নিরবচ্ছিন্ন ক্লাউড ব্যাকআপ: প্রতিদিনের ডেটা স্বয়ংক্রিয়ভাবে এনক্রিপ্ট হয়ে ক্লাউড সার্ভারে নিরাপদে সংরক্ষিত থাকে।",
      "৪. ব্রুট-ফোর্স প্রতিরোধ: বারবার ভুল পাসওয়ার্ড দিয়ে অনুপ্রবেশের চেষ্টা করলে সিস্টেম স্বয়ংক্রিয়ভাবে আইপি ব্লক করে দেয়।",
      "৫. পূর্ণাঙ্গ অডিট লগ: পরীক্ষার নম্বর পরিবর্তন কিংবা আর্থিক ডিসকাউন্টের প্রতিটি পদক্ষেপ টাইমস্ট্যাম্পসহ সংরক্ষিত থাকে।"
    ]
  }
];

interface DocArticle {
  title: string;
  category: string;
  readTime: string;
  summary: string;
  details: string[];
}

const ARTICLES: DocArticle[] = [
  {
    title: "Quick-Start: Institution Setup & Onboarding",
    category: "Getting Started",
    readTime: "4 min read",
    summary: "Step-by-step guide to provisioning your school or academy, setting up academic sessions, and inviting faculty.",
    details: [
      "1. Navigate to /onboard to start the setup wizard.",
      "2. Enter institutional details (Formal Name, Board/Affiliation, Contact Info).",
      "3. Choose your operating modality: School (K-12 NCTB) or Academy (Coaching Center).",
      "4. The system provisions your tenant schema and initial administrator credentials immediately."
    ]
  },
  {
    title: "Bulk Student & Guardian Import via CSV",
    category: "Student Directory",
    readTime: "5 min read",
    summary: "How to format Excel and CSV rosters to import hundreds of students, class sections, and emergency guardian numbers in minutes.",
    details: [
      "1. Download the standard CSV template from Students > Import.",
      "2. Ensure student admission numbers are unique across your institution.",
      "3. Format phone numbers as 11-digit Bangladeshi mobile numbers (e.g. 01711000000).",
      "4. Upload the file; the validator will highlight any formatting errors before database commit."
    ]
  },
  {
    title: "Configuring Bangladesh NCTB 7-Tier Grading",
    category: "Academics & Exams",
    readTime: "6 min read",
    summary: "Detailed overview of configuring passing mark thresholds, GPA formulas, practical exam splits, and A4 terminal report card layouts.",
    details: [
      "1. EducationOS implements standard NCTB 80%=A+ (5.00), 70%=A (4.00), 60%=A- (3.50), etc.",
      "2. Supports multi-component exam configurations (CQ + MCQ + Practical).",
      "3. F-grade in any compulsory component flags the terminal result as unfulfilled according to board criteria.",
      "4. Generates single-page print-ready report cards with official institution headers."
    ]
  },
  {
    title: "1-Tap Attendance & WhatsApp Alert Dispatch",
    category: "Attendance",
    readTime: "3 min read",
    summary: "Conducting morning roll calls on mobile or tablet and managing automated WhatsApp and SMS alerts to parents.",
    details: [
      "1. Open the Attendance module on any mobile smartphone or tablet.",
      "2. Select class and section; students default to Present.",
      "3. Tap absent students once to toggle them to Absent.",
      "4. Hit Submit. Automated SMS/WhatsApp notifications are immediately queued for parents of absent students."
    ]
  },
  {
    title: "Double-Entry Tuition Fees & Cash Vouchers",
    category: "Finance",
    readTime: "7 min read",
    summary: "Issuing thermal cash receipts, collecting bKash payments, setting up installment plans, and reconciling counter registers.",
    details: [
      "1. Define recurring monthly fee schedules and special annual charges.",
      "2. Search student by roll or name at the fee counter to view current dues and past arrears.",
      "3. Accept cash, card, or bKash payments and print duplicate thermal money receipts (58mm/80mm).",
      "4. Close daily shift registers with automated cash-in-hand reconciliation."
    ]
  },
  {
    title: "Coaching Center MCQ Model Tests & Negative Marking",
    category: "AcademyOS",
    readTime: "5 min read",
    summary: "Setting up university admission model tests with timed live exams, -0.25 negative marking, and automated merit ranking.",
    details: [
      "1. Switch workspace mode to AcademyOS.",
      "2. Define exam subject, question count, and negative mark deduction (e.g., -0.25 for BUET/Medical prep).",
      "3. Students submit answers online or via OMR sheet batch upload.",
      "4. The system calculates weighted scores, generates instant merit ranks, and SMSes percentiles to parents."
    ]
  }
];

export default function DocsPage() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeManual, setActiveManual] = useState<ManualCard | null>(null);
  const [manualLang, setManualLang] = useState<"EN" | "BN">("EN");
  const [expandedArticle, setExpandedArticle] = useState<DocArticle | null>(null);

  const categories = [
    { id: "all", label: "All Topics" },
    { id: "manuals", label: "Role Manuals" },
    { id: "Getting Started", label: "Onboarding" },
    { id: "Academics & Exams", label: "Academics & Exams" },
    { id: "Attendance", label: "Attendance" },
    { id: "Finance", label: "Finance & Fees" },
    { id: "AcademyOS", label: "Academy & Coaching" }
  ];

  const filteredArticles = ARTICLES.filter((a) => {
    const matchesQuery =
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.summary.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase());
    const matchesCategory =
      selectedCategory === "all" ||
      selectedCategory === "manuals" ||
      a.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <BookOpen size={14} />
            <span>Platform Documentation & Manuals</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            EducationOS Knowledge Base & User Manuals
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Comprehensive step-by-step documentation and bilingual operating manuals for school principals, teachers, guardians, and system administrators.
          </p>

          {/* Search Bar */}
          <div className="relative max-w-lg mx-auto">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation (e.g. NCTB, Attendance, Fees, CSV)..."
              className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedCategory === c.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section 1: Role-Based Operational Manuals (Highlighted) */}
        {(selectedCategory === "all" || selectedCategory === "manuals") && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Official Role-Based User Manuals</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Complete bilingual operating guidelines prepared for daily institutional workflows.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400">
                <Languages size={14} className="text-indigo-400" /> English & বাংলা
              </span>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {MANUALS.map((manual, idx) => {
                const Icon = manual.icon;
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setActiveManual(manual);
                      setManualLang("EN");
                    }}
                    className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/80 transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                        <Icon size={20} />
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                        {manual.role}
                      </span>
                      <h3 className="text-lg font-bold text-white leading-snug group-hover:text-indigo-300 transition-colors">
                        {manual.title}
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {manual.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-800/60 mt-4 flex items-center justify-between text-xs text-indigo-400 font-bold">
                      <span>Read Manual</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2: Step-by-Step Technical Articles */}
        {(selectedCategory !== "manuals") && (
          <div className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-2xl font-bold text-white">Operational & Setup Guides</h2>
              <p className="text-sm text-slate-400 mt-1">
                Detailed guides on specific features, NCTB compliance, and double-entry accounting.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredArticles.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => setExpandedArticle(item)}
                  className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900/80 transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-400 uppercase tracking-wider">
                        {item.category}
                      </span>
                      <span className="text-slate-400">{item.readTime}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-snug group-hover:text-indigo-300 transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{item.summary}</p>
                  </div>

                  <div className="pt-6 border-t border-slate-800/60 mt-6">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      <span>View Detailed Instructions</span>
                      <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Role Manual Interactive Reader Modal */}
        {activeManual && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                    {activeManual.role}
                  </span>
                  <h3 className="text-xl font-bold text-white">
                    {manualLang === "EN" ? activeManual.title : activeManual.titleBn}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  {/* Language Toggle */}
                  <div className="flex items-center bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button
                      onClick={() => setManualLang("EN")}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        manualLang === "EN" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      English
                    </button>
                    <button
                      onClick={() => setManualLang("BN")}
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        manualLang === "BN" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      বাংলা
                    </button>
                  </div>

                  <button
                    onClick={() => setActiveManual(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
                <p className="text-slate-400 italic">
                  {manualLang === "EN" ? activeManual.description : activeManual.descriptionBn}
                </p>

                <div className="space-y-3 pt-2">
                  {(manualLang === "EN" ? activeManual.contentEn : activeManual.contentBn).map((step, sIdx) => (
                    <div key={sIdx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
                      <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center text-xs text-slate-400">
                <span>EducationOS Standard Operational Manual v2.0</span>
                <button
                  onClick={() => setActiveManual(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition-colors"
                >
                  Close Manual
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Article Reader Modal */}
        {expandedArticle && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                <div>
                  <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-bold">
                    {expandedArticle.category} • {expandedArticle.readTime}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{expandedArticle.title}</h3>
                </div>
                <button
                  onClick={() => setExpandedArticle(null)}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed">
                <p className="text-slate-300 font-medium">{expandedArticle.summary}</p>
                <div className="space-y-3 pt-2">
                  {expandedArticle.details.map((step, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                <button
                  onClick={() => setExpandedArticle(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
