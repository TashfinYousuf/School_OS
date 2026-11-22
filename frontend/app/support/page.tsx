"use client";

import React from "react";
import Link from "next/link";
import { LifeBuoy, BookOpen, MessageSquare, AlertCircle, Phone, Mail, ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <LifeBuoy size={14} />
            <span>Support Triage & Help Desk</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            How to Reach EducationOS Technical Support
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Fast resolution channels for institutional administrators, faculty, and IT coordinators.
          </p>
        </div>

        {/* Support Channels Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <BookOpen size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">Self-Serve Knowledge Base</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Step-by-step documentation on CSV student roster imports, NCTB GPA formulas, attendance offline sync, and printer setup.
            </p>
            <div className="pt-2">
              <Link
                href="/docs"
                className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold inline-flex items-center gap-1"
              >
                <span>Browse Documentation</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Mail size={24} />
            </div>
            <h2 className="text-xl font-bold text-white">Institutional Support Desk</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Send priority diagnostic reports, billing inquiries, or data migration requests directly to our Tier-2 engineering staff.
            </p>
            <div className="pt-2">
              <a
                href="mailto:support@schoolos.app"
                className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold inline-flex items-center gap-1 font-mono"
              >
                <span>support@schoolos.app</span>
                <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </div>

        {/* Support Ticket Roadmap Notice (Stage 12.8 Compliance) */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800/80 flex items-start gap-4">
          <AlertCircle size={20} className="text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-1">
            <div className="font-bold text-white">Support Ticket Tracking Portal Status:</div>
            <p>
              In strict accordance with the Stage 12.5 specifications, in-app automated support ticket submission will activate upon the release of the Stage 12.8 Customer Operations suite. For urgent institutional requests today, please reach our team via <span className="text-indigo-400 font-mono">support@schoolos.app</span> or call <span className="text-indigo-400 font-mono">+880 1700-000000</span>.
            </p>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

