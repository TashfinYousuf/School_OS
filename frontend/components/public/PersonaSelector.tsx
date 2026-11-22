"use client";

import React, { useState } from "react";
import Link from "next/link";
import { School, GraduationCap, Building2, CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/providers";

interface PersonaData {
  id: string;
  tabLabel: string;
  icon: typeof School;
  headline: string;
  description: string;
  features: string[];
  ctaLink: string;
  ctaText: string;
}

const PERSONAS: PersonaData[] = [
  {
    id: "schools",
    tabLabel: "K-12 Formal Schools",
    icon: School,
    headline: "Engineered for K-12 General & Model Schools",
    description: "Designed specifically for Bangladeshi formal schools needing automated NCTB report cards, teacher conflict-free routine scheduling, 1-tap roll call, and seamless government IPEMIS payload export.",
    features: [
      "NCTB 7-Tier Pass/Fail & GPA Evaluation Engine",
      "Teacher Voice-to-Diary Copilot (Auto-drafts daily progress)",
      "Daily biometric / mobile attendance with WhatsApp alert to parents",
      "Term-wise fees, waivers, and double-entry receipt audit ledger",
      "Government IPEMIS & BANBEIS data sync export"
    ],
    ctaLink: "/solutions/schools",
    ctaText: "Explore SchoolOS Workflows"
  },
  {
    id: "colleges",
    tabLabel: "Colleges & Higher Secondary",
    icon: Building2,
    headline: "Scale Higher Secondary & Multi-Shift Campuses",
    description: "Optimize high-volume student enrollments, elective subject selection, multi-shift teacher timetables, and campus branch administration under unified oversight.",
    features: [
      "Science, Commerce, Humanities elective stream management",
      "Multi-shift scheduling (Morning / Day) preventing room & faculty collisions",
      "Monthly tuition fee installments & online payment gateway",
      "HSC test exam tabulation & progress profiling",
      "Multi-campus administration with hierarchical permissions"
    ],
    ctaLink: "/solutions/colleges",
    ctaText: "Explore College Workflows"
  },
  {
    id: "academies",
    tabLabel: "Coaching Centers & Academies",
    icon: GraduationCap,
    headline: "High-Velocity Model Tests & Batch Management",
    description: "Built for competitive coaching centers, university admission test academies, and HSC model test programs requiring negative marking, instant percentiles, and batch tracking.",
    features: [
      "Dynamic batch allocation & shift management",
      "Live MCQ exams with -0.25 negative marking and instant merit ranks",
      "Socratic AI Doubt Solver Studio for enrolled students",
      "Camera OMR scanner grading 50 questions in under 2 seconds",
      "Installment fee tracking & automated due date reminders"
    ],
    ctaLink: "/solutions/academies",
    ctaText: "Explore AcademyOS Workflows"
  }
];

export default function PersonaSelector() {
  const [activeTab, setActiveTab] = useState<string>("schools");
  const { t } = useLanguage();

  const current = PERSONAS.find((p) => p.id === activeTab) || PERSONAS[0];
  const IconComponent = current.icon;

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 max-w-3xl mx-auto p-1.5 rounded-2xl bg-slate-900 border border-slate-800">
        {PERSONAS.map((p) => {
          const TabIcon = p.icon;
          const isActive = activeTab === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveTab(p.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                isActive
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <TabIcon size={16} />
              <span>{p.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Persona Showcase Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl backdrop-blur-md">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
              <IconComponent size={14} />
              <span>{current.tabLabel} Focus</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-snug">
              {current.headline}
            </h3>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              {current.description}
            </p>

            <ul className="space-y-3">
              {current.features.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2">
              <Link
                href={current.ctaLink}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/25"
              >
                <span>{current.ctaText}</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>

          {/* Visual Showcase Panel */}
          <div className="rounded-2xl bg-slate-950 border border-slate-800/80 p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                EducationOS {activeTab === "academies" ? "Academy Core" : "School Core"}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex justify-between items-center">
                <span className="text-slate-400">Active Campus Protocol:</span>
                <span className="text-emerald-400 font-bold">PostgreSQL RLS Isolated</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex justify-between items-center">
                <span className="text-slate-400">Curriculum Compliance:</span>
                <span className="text-indigo-400 font-bold">NCTB / National Framework</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex justify-between items-center">
                <span className="text-slate-400">Network Fallback:</span>
                <span className="text-blue-400 font-bold">Offline PWA Sync (Active)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 flex justify-between items-center">
                <span className="text-slate-400">AI Supervision:</span>
                <span className="text-purple-400 font-bold">Human-in-the-Loop Locked</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

