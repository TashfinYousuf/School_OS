"use client";

import React from "react";
import Link from "next/link";
import { School, Building2, GraduationCap, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function SolutionsOverviewPage() {
  const solutions = [
    {
      title: "SchoolOS — K-12 Formal Schools",
      href: "/solutions/schools",
      icon: School,
      badge: "K-12 Formal & Model Schools",
      description: "Designed for primary, secondary, and higher secondary schools requiring NCTB curriculum evaluation, routine collision prevention, biometric attendance, and terminal report card generation.",
      highlights: [
        "NCTB 7-Tier Pass/Fail Evaluation Engine",
        "Conflict-Free Classroom Timetable Generator",
        "Teacher Voice-to-Diary AI Copilot",
        "Daily WhatsApp & SMS Attendance Alerts",
        "Government IPEMIS & BANBEIS Export"
      ]
    },
    {
      title: "CollegeOS — Higher Secondary & Colleges",
      href: "/solutions/colleges",
      icon: Building2,
      badge: "Colleges & Multi-Shift Campuses",
      description: "Built for intermediate colleges, degree colleges, and large multi-shift campuses managing academic streams (Science, Commerce, Humanities), subject electives, and multi-branch coordination.",
      highlights: [
        "Academic Stream & Elective Course Management",
        "Multi-Shift (Morning/Day) Scheduling Engine",
        "Semester & Term Fee Installment Tracking",
        "HSC Model Test Preparation & Profiling",
        "Multi-Campus Central Administration"
      ]
    },
    {
      title: "AcademyOS — Coaching Centers & Academies",
      href: "/solutions/academies",
      icon: GraduationCap,
      badge: "Model Test & Admission Coaching",
      description: "Engineered for high-velocity coaching centers, model test programs, and university admission test academies requiring live MCQ exams, negative marking, and central merit ranking lists.",
      highlights: [
        "Dynamic Batch Allocation & Shift Management",
        "Live MCQ Exams with -0.25 Negative Marking",
        "Instant Percentile & Central Merit Lists",
        "Socratic AI Doubt Solver for Enrolled Students",
        "Camera OMR Sheet Scanner Integration"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Sparkles size={14} />
            <span>Institutional Solutions</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Tailored for Every Educational Entity
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Whether you operate a single K-12 school, a multi-shift college, or a nationwide coaching network, EducationOS provides purpose-built workflows for your exact operational model.
          </p>
        </div>

        {/* Solutions Grid */}
        <div className="space-y-10">
          {solutions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="bg-slate-900/60 border border-slate-800 rounded-3xl p-8 sm:p-12 hover:border-slate-700 transition-colors"
              >
                <div className="grid lg:grid-cols-3 gap-8 items-center">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold">
                      <Icon size={14} className="text-indigo-400" />
                      <span>{item.badge}</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                      {item.title}
                    </h2>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                      {item.description}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3 pt-2">
                      {item.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                          <span>{h}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-start lg:items-end justify-center">
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
                    >
                      <span>Explore Dedicated Workflow</span>
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

