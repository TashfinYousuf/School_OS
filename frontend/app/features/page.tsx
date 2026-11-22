"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, 
  Search, 
  Check, 
  Layers, 
  School, 
  DollarSign, 
  Cpu, 
  ShieldCheck, 
  Smartphone, 
  FileText,
  ArrowRight
} from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

interface FeatureItem {
  id: string;
  name: string;
  category: "academic" | "exams" | "finance" | "ai" | "governance" | "offline";
  description: string;
  planAvailability: string;
  highlight?: boolean;
}

const ALL_FEATURES: FeatureItem[] = [
  {
    id: "f-nctb",
    name: "NCTB 7-Tier Grading Engine",
    category: "academic",
    description: "Official 7-tier letter grading (A+ to F), GPA 5.0 scale, and automatic terminal pass/fail threshold computation.",
    planAvailability: "All School Plans",
    highlight: true
  },
  {
    id: "f-attendance",
    name: "1-Tap Attendance & WhatsApp Hub",
    category: "academic",
    description: "Daily mobile roll call with real-time absentee tracking and 1-click telephone or WhatsApp parent communication.",
    planAvailability: "Growth & Above"
  },
  {
    id: "f-diary",
    name: "Teacher Voice-to-Diary Copilot",
    category: "ai",
    description: "Voice-driven classroom lesson logging. Teachers speak in Bengali or English; AI extracts covered topics and homework.",
    planAvailability: "Growth & Above",
    highlight: true
  },
  {
    id: "f-routine",
    name: "Conflict-Free Routine Scheduler",
    category: "academic",
    description: "Automated timetable generator preventing double-booking of teachers, shared classrooms, and science labs.",
    planAvailability: "All Plans"
  },
  {
    id: "f-omr",
    name: "OMR & MCQ Answer Sheet Evaluation",
    category: "exams",
    description: "Automated MCQ scoring and merit leaderboard generation with negative marking; mobile camera scanner available in Enterprise beta.",
    planAvailability: "Professional & Unified",
    highlight: true
  },
  {
    id: "f-live-mcq",
    name: "Live MCQ Exams (-0.25 Negative Marking)",
    category: "exams",
    description: "Timed online examinations with configurable negative marking, random question shuffling, and instant merit ranking.",
    planAvailability: "All Academy Plans"
  },
  {
    id: "f-merit",
    name: "Central Merit Ranking & Percentiles",
    category: "exams",
    description: "Automated leaderboard generator calculating rank, percentile standing, and topic accuracy heatmaps.",
    planAvailability: "All Academy Plans"
  },
  {
    id: "f-finance-ledger",
    name: "Double-Entry Student Fee Ledger",
    category: "finance",
    description: "Immutable accounting ledger tracking monthly tuition, exam charges, transport fees, and partial payments.",
    planAvailability: "All Plans",
    highlight: true
  },
  {
    id: "f-cash-receipts",
    name: "Cash Counter Thermal Receipts",
    category: "finance",
    description: "Instant print-ready thermal vouchers with QR verification, counter audit summaries, and cash collection locks.",
    planAvailability: "All Plans"
  },
  {
    id: "f-socratic-ai",
    name: "Socratic AI Doubt Solver Studio",
    category: "ai",
    description: "Interactive learning assistant that guides students toward problem-solving methodology without revealing direct answers.",
    planAvailability: "Academy Growth & Unified"
  },
  {
    id: "f-offline-sync",
    name: "Offline-First PWA Synchronization",
    category: "offline",
    description: "Operate core attendance and grading workflows during network blackouts. Queued in IndexedDB with auto-sync.",
    planAvailability: "All Plans",
    highlight: true
  },
  {
    id: "f-rls-security",
    name: "PostgreSQL Row Level Security (RLS)",
    category: "governance",
    description: "Kernel-level database isolation ensuring complete multi-tenant boundaries and zero cross-school data leakage.",
    planAvailability: "Enterprise Standard"
  },
  {
    id: "f-ipemis",
    name: "BANBEIS & Census-Ready Exporter",
    category: "governance",
    description: "1-click export of student enrollment census and attendance ledgers pre-formatted for Bangladesh Ministry of Education portal upload.",
    planAvailability: "School Growth & Pro"
  },
  {
    id: "f-multi-campus",
    name: "Multi-Campus Branch Administration",
    category: "governance",
    description: "Centrally administer multiple branch locations, campuses, or shifts with role-based administrative delegation.",
    planAvailability: "Professional & Unified"
  }
];

export default function FeaturesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = [
    { id: "all", label: "All Modules" },
    { id: "academic", label: "Academic & NCTB" },
    { id: "exams", label: "Exams & OMR" },
    { id: "finance", label: "Finance & Receipts" },
    { id: "ai", label: "AI Copilots" },
    { id: "offline", label: "Offline Resilience" },
    { id: "governance", label: "Governance & Security" }
  ];

  const filtered = ALL_FEATURES.filter((item) => {
    const matchesCat = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Layers size={14} />
            <span>Complete Module Catalog</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Designed for Educational Operational Mastery
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Every feature in EducationOS is engineered to solve authentic daily challenges faced by Bangladeshi campus administrators, faculty, and accountants.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-12">
          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-2 rounded-xl transition-colors ${
                  selectedCategory === c.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search features (e.g. OMR, NCTB)..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-8 rounded-3xl flex flex-col justify-between transition-all ${
                item.highlight
                  ? "bg-gradient-to-b from-slate-900 to-indigo-950/30 border border-indigo-500/30 shadow-xl shadow-indigo-500/5"
                  : "bg-slate-900/60 border border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                    {item.category}
                  </span>
                  <span className="text-xs text-slate-400">{item.planAvailability}</span>
                </div>
                <h3 className="text-xl font-bold text-white">{item.name}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-6 border-t border-slate-800/60 mt-6 flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium flex items-center gap-1">
                  <Check size={14} /> Available Now
                </span>
                <Link
                  href="/onboard"
                  className="text-slate-400 hover:text-white font-semibold flex items-center gap-1"
                >
                  <span>Test in Trial</span>
                  <ArrowRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 bg-slate-900/40 border border-slate-800 rounded-3xl">
            <p className="text-slate-400 text-sm">No modules found matching &quot;{searchQuery}&quot;.</p>
          </div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

