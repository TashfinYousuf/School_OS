"use client";

import React from "react";
import Link from "next/link";
import { School, CheckCircle2, ArrowRight, ShieldCheck, Clock, FileSpreadsheet, Sparkles } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function SchoolsSolutionPage() {
  const workflows = [
    {
      title: "NCTB Pass/Fail Evaluation Engine",
      description: "Automate terminal exam mark calculations with exact compliance to Bangladesh National Curriculum guidelines. Generates comprehensive 7-tier GPA report cards with subject-wise practical, continuous, and written scores."
    },
    {
      title: "Teacher Voice Diary Copilot",
      description: "Teachers record daily lesson coverage, student engagement, and homework through natural Bengali or English speech. AI transcribes and structures the entry for Principal review before committing."
    },
    {
      title: "1-Tap Attendance & Parent Alerts",
      description: "Replace physical paper registers with 1-tap mobile roll call. Instant arrival and absence alerts are automatically sent to guardians via verified WhatsApp templates or SMS."
    },
    {
      title: "Cash & Online Fee Collection Ledger",
      description: "Manage tuition fees, exam fees, and annual development funds. Supports cash counter receipts with thermal printing, bKash payments, and strict double-entry ledger audits."
    },
    {
      title: "Government IPEMIS & BANBEIS Export",
      description: "Generate compliant data export payloads formatted specifically for Directorate of Primary Education (IPEMIS) and BANBEIS annual census reporting."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <School size={14} />
            <span>K-12 Formal & Model School Operating System</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 tracking-tight leading-tight">
            Built for Bangladesh Primary & Secondary Schools
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-8">
            Eliminate operational chaos with an all-in-one platform built specifically around the Bangladesh National Curriculum (NCTB), terminal exams, and guardian communication.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboard?type=school"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start 30-Day School Trial</span>
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contact?type=school_demo"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>Request Campus Demo</span>
            </Link>
          </div>
        </div>

        {/* Workflows List */}
        <div className="grid md:grid-cols-2 gap-8 mb-20">
          {workflows.map((wf, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors space-y-3"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <h3 className="text-xl font-bold text-white">{wf.title}</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed pl-8">
                {wf.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom CTA Box */}
        <div className="p-10 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 text-center space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            Ready to upgrade your school administration?
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto">
            Join hundreds of forward-thinking educators transitioning to an autonomous, paperless campus.
          </p>
          <Link
            href="/onboard?type=school"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-colors"
          >
            <span>Activate 30-Day Free Trial</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

