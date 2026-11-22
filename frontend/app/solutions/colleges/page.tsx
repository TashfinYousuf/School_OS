"use client";

import React from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ArrowRight, Layers, Clock, Users } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function CollegesSolutionPage() {
  const features = [
    {
      title: "Science, Business Studies & Humanities Streams",
      description: "Manage elective subject selections (Higher Math, Biology, Finance, Logic) with automatic validation of mandatory credit combinations under Higher Secondary Education Board guidelines."
    },
    {
      title: "Multi-Shift Campus Coordination",
      description: "Eliminate classroom scheduling collisions between morning and day shifts. Track faculty workloads, shared laboratory allocations, and lecture hall capacity in real-time."
    },
    {
      title: "HSC Model Test & Progress Profiling",
      description: "Conduct standardized pre-test and test examinations. Analyze student grade trajectories across subjects to flag underperforming candidates before board exam registration."
    },
    {
      title: "Semester Fee Schedules & Online Pay",
      description: "Publish flexible term-wise and monthly installment fee schedules. Parents pay securely via bKash, cards, or bank deposits with automatic receipt generation."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-4">
            <Building2 size={14} />
            <span>Colleges & Higher Secondary Campuses</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Scale Higher Secondary Academic Administration
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Manage high-volume enrollments, elective course combinations, multi-shift faculty timetables, and board exam eligibility with enterprise precision.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboard?type=college"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start College Trial</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact?type=college_demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>Schedule College Consultation</span>
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {features.map((f, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-blue-400 shrink-0" />
                <h3 className="text-xl font-bold text-white">{f.title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed pl-8">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

