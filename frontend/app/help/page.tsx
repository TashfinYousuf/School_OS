"use client";

import React, { useState } from "react";
import Link from "next/link";
import { HelpCircle, Search, ChevronDown, ChevronUp, LifeBuoy, CheckCircle2, ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function HelpCenterPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const helpTopics = [
    {
      q: "How do I reset my institutional administrator password?",
      a: "Institutional administrators can request a password reset link from the `/login` screen by clicking 'Forgot Password'. A secure, time-limited reset token will be delivered to your verified institutional email address."
    },
    {
      q: "What should teachers do when mobile internet disconnects during roll call?",
      a: "Continue taking attendance as usual. The EducationOS Progressive Web App stores attendance records securely in the local browser database. A badge will indicate 'Pending Sync', and records will automatically synchronize when connectivity returns."
    },
    {
      q: "How can parents receive report cards on their mobile devices?",
      a: "Once the principal publishes terminal exam results, parents with registered mobile numbers receive an encrypted WhatsApp or SMS link directing them to a secure, mobile-friendly report card view without needing a complex login."
    },
    {
      q: "Can we migrate our existing student Excel rosters into EducationOS?",
      a: "Yes. Our student directory includes a bulk CSV/Excel import template. Download the standard CSV template, paste your student and guardian columns, and upload. The system automatically validates data before importing."
    },
    {
      q: "What payment methods are supported for institutional subscription fees?",
      a: "We support domestic Bangladesh payment rails including bKash tokenized merchant payments, SSLCommerz gateway (Visa, Mastercard, mobile banking), and direct institutional bank transfers."
    },
    {
      q: "How does EducationOS handle SMS masking and telecom delivery costs?",
      a: "EducationOS integrates with licensed Bangladesh BTRC-approved SMS aggregators supporting both non-masking and official institutional sender masking (e.g., 'KIDSSHINE'). SMS credits can be purchased in bulk at ৳0.35/SMS with zero hidden maintenance fees."
    },
    {
      q: "Is EducationOS compliant with NCTB grading frameworks and Government IPEMIS?",
      a: "Yes. The platform natively implements the official 7-tier NCTB letter grading scale (A+ down to F) with automated GPA calculations, practical exam splits, and standardized CSV export formats aligned with Directorate of Secondary and Higher Education (DSHE) and IPEMIS guidelines."
    },
    {
      q: "Can coaching centers and model test academies use EducationOS?",
      a: "Yes. With our built-in AcademyOS workspace mode, coaching centers can manage shift routines, course batches, seat capacities, and university admission model tests with timed MCQ examinations, -0.25 negative marking, and instant merit ranking."
    },
    {
      q: "Who owns our school's data, and can we export our complete database?",
      a: "Your institution retains 100% legal ownership of all student, faculty, and financial records. Institutional administrators can export complete, unencrypted CSV and JSON archives at any time without vendor lock-in."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <HelpCircle size={14} />
            <span>Support & Help Center</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            How Can We Assist Your Campus?
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Find immediate answers to common questions about onboarding, offline usage, and school operations.
          </p>
        </div>

        {/* System Status Banner */}
        <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-emerald-300">All Core Systems Operational</span>
          </div>
          <span className="text-slate-400 text-xs font-mono">99.98% Historical Uptime</span>
        </div>

        {/* FAQ Accordion */}
        <div className="space-y-4">
          {helpTopics.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-bold text-white">{item.q}</span>
                  <span className="p-1 rounded-lg bg-slate-800 text-slate-300 shrink-0">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </button>
                {isOpen && (
                  <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-slate-800/50 pt-4">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still Need Assistance Callout */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Still need assistance?</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Our educational operations team is available to assist you with onboarding, data migration, and faculty training.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <span>Contact Support Team</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

