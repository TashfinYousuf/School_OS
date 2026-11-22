"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, CheckCircle2, ArrowRight, Zap, Target, Award, Cpu } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function AcademiesSolutionPage() {
  const capabilities = [
    {
      title: "Batch & Shift Management",
      description: "Organize students across dynamic batches, morning/evening shifts, and targeted crash programs with automated seat capacity caps."
    },
    {
      title: "Live MCQ Exams & -0.25 Negative Marking",
      description: "Host high-concurrency model tests simulating Medical (MAT), Engineering (BUET), and Varsity (DU KA/KHA) admission examinations with strict time limits and negative marking."
    },
    {
      title: "Instant Merit Ranks & Percentile Analysis",
      description: "Publish central merit lists within seconds of test completion. Provide candidates with percentile ranks, question-wise accuracy heatmaps, and solution sheets."
    },
    {
      title: "Camera OMR Scanner Integration",
      description: "Scan and grade paper OMR answer sheets using any standard camera or phone in under 2 seconds, uploading scores directly to candidate profiles."
    },
    {
      title: "Socratic AI Doubt Solver Studio",
      description: "Equip students with 24/7 AI-guided doubt resolution that teaches problem-solving methods step-by-step rather than simply providing answers."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
            <GraduationCap size={14} />
            <span>Coaching Centers & Model Test Academies</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            High-Velocity Exam & Batch Management
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Built for competitive coaching centers, university admission test programs, and model test networks requiring instant merit ranks, negative marking, and automated batch dues tracking.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboard?type=academy"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start Academy Trial</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact?type=academy_demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>Schedule Academy Demo</span>
            </Link>
          </div>
        </div>

        {/* Capabilities Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {capabilities.map((c, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 transition-colors space-y-3"
            >
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 size={18} />
                <h3 className="text-lg font-bold text-white">{c.title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {c.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

