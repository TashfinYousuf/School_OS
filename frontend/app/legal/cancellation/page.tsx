"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function CancellationPolicyPage() {
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
            Subscription Cancellation Policy
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Version 1.0 (Draft) • Effective Date: November 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none text-slate-300 space-y-6 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. Cancellation Terms & Procedure</h2>
          <p>
            An institutional administrator may cancel the institution&apos;s recurring subscription at any time directly through the institutional dashboard under Settings &gt; Billing or by emailing billing@schoolos.app.
          </p>

          <h2 className="text-xl font-bold text-white">2. Effect of Cancellation</h2>
          <p>
            Upon cancellation, your subscription remains active with full write and read privileges until the conclusion of the currently paid billing period. No further automated renewals or recurring invoices will be charged.
          </p>

          <h2 className="text-xl font-bold text-white">3. Data Export & Sovereign Retention</h2>
          <p>
            Following the end of the paid period, the account transitions to read-only status for ninety (90) days. During this period, administrators can export all student records, fee ledgers, and academic marks into standard CSV and Excel formats.
          </p>

          <h2 className="text-xl font-bold text-white">4. Account Reactivation</h2>
          <p>
            Cancelled accounts may be reactivated at any time during the 90-day retention period without loss of historic data, student profiles, or historical ledger audit records by settling a new subscription invoice.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

