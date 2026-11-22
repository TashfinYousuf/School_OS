"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function TermsOfServicePage() {
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
            Institutional Terms of Service
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Version 1.0 (Draft) • Effective Date: November 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none text-slate-300 space-y-6 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. Service Description & Parties</h2>
          <p>
            These Terms of Service govern the subscription agreement between EducationOS Technologies (&quot;Provider&quot;) and the subscriber educational institution (&quot;Subscriber&quot;, &quot;Institution&quot;). By creating an institutional tenant workspace or executing a payment, the Institution agrees to these Terms.
          </p>

          <h2 className="text-xl font-bold text-white">2. Service Level Agreement (SLA) & Uptime Commitment</h2>
          <p>
            EducationOS commits to providing 99.9% scheduled application availability during academic operating periods (Sunday through Thursday). Maintenance windows are scheduled outside primary academic hours with 48-hour prior notice. Offline PWA capabilities ensure operational continuity during local broadband outages.
          </p>

          <h2 className="text-xl font-bold text-white">3. Authorized Institutional Use & Fair Quotas</h2>
          <p>
            Subscriptions are provisioned with defined student capacity tiers and monthly AI question generation quotas. Institutions agree not to reverse engineer, attempt SQL injection, or share administrative authentication tokens with unauthorized third parties.
          </p>

          <h2 className="text-xl font-bold text-white">4. Non-Destructive Account Suspension & Dunning</h2>
          <p>
            In the event of an overdue subscription invoice, the account enters a 7-day grace period with full functionality. Following expiration of the grace period without settlement, the account transitions to <strong>non-destructive read-only suspension</strong>. Academic data remains safe and viewable, while write operations (new admissions, grade entry) are locked until payment.
          </p>

          <h2 className="text-xl font-bold text-white">5. Governing Law and Jurisdiction</h2>
          <p>
            This agreement is governed by the laws of the People&apos;s Republic of Bangladesh. Any dispute arising out of or related to this agreement shall be settled through amicable mediation or submitted to competent commercial arbitration in Dhaka, Bangladesh.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

