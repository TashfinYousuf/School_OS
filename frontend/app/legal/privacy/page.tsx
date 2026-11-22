"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, AlertCircle } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-12">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-4">
            <AlertCircle size={14} />
            <span>DRAFT — Subject to Final Legal Counsel Review</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
            Institutional Privacy Policy
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Version 1.0 (Draft) • Last Updated: November 2026
          </p>
        </div>

        {/* Legal Text */}
        <div className="prose prose-invert max-w-none text-slate-300 space-y-6 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. Scope and Institutional Data Ownership</h2>
          <p>
            EducationOS Technologies (&quot;EducationOS&quot;, &quot;we&quot;, &quot;platform&quot;) operates as a Data Processor on behalf of the subscriber institution (&quot;School&quot;, &quot;College&quot;, &quot;Academy&quot;, &quot;Data Controller&quot;). The institution retains exclusive, sovereign ownership over all uploaded student rosters, guardian contact information, attendance records, academic marks, and financial transaction histories.
          </p>

          <h2 className="text-xl font-bold text-white">2. Strict Zero-Advertising and No-Monetization Pledge</h2>
          <p>
            We strictly enforce that student, guardian, and faculty personal information is <strong>never sold, licensed, rented, or monetized</strong> to third-party commercial brokers or advertising networks. We do not use student profiles or behavioral telemetry to serve targeted commercial advertising.
          </p>

          <h2 className="text-xl font-bold text-white">3. Information Collected and Processed</h2>
          <p>To provide core institutional workflows, EducationOS processes:</p>
          <ul className="list-disc pl-6 space-y-1.5 text-slate-400">
            <li><strong>Institutional Profile Data:</strong> Institution name, campus address, curriculum classification, administrator contact credentials.</li>
            <li><strong>Student & Guardian Records:</strong> Student full name, roll number, class section, guardian mobile number (used strictly for attendance and fee notifications).</li>
            <li><strong>Academic & Evaluation Data:</strong> Exam scores, terminal grades, teacher diary lesson entries, and attendance timestamps.</li>
            <li><strong>Financial Metadata:</strong> Fee invoices, receipts, and waiver approvals (Payment credentials such as bKash PINs or bank details are handled strictly by certified payment gateways and never stored on our servers).</li>
          </ul>

          <h2 className="text-xl font-bold text-white">4. Technical Security Controls</h2>
          <p>
            All tenant records are logically and mathematically isolated using PostgreSQL native Row Level Security (RLS). Communications are encrypted under TLS 1.3 in transit, and database backups are encrypted at rest with AES-256 standards.
          </p>

          <h2 className="text-xl font-bold text-white">5. Data Retention and Archival</h2>
          <p>
            Upon subscription cancellation or expiration, institutional records are preserved in read-only status for ninety (90) calendar days to facilitate renewal or data export. Following this grace period, unrenewed institutional databases enter an immutable retention schedule before automated purge.
          </p>

          <h2 className="text-xl font-bold text-white">6. Privacy Inquiries</h2>
          <p>
            For privacy compliance inquiries or data controller requests, please contact our Data Governance Officer at <span className="text-indigo-400 font-mono">privacy@schoolos.app</span>.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

