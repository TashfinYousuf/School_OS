"use client";

import React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function RefundPolicyPage() {
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
            Subscription Refund Policy
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Version 1.0 (Draft) • Effective Date: November 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none text-slate-300 space-y-6 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white">1. 14-Day Free Trial Protection</h2>
          <p>
            EducationOS provides a 14-day free trial on Starter and Growth plans with no payment method required upfront. We encourage every institution to thoroughly test attendance, fee vouchers, and report card generation during this evaluation window.
          </p>

          <h2 className="text-xl font-bold text-white">2. Initial Subscription 14-Day Money-Back Guarantee</h2>
          <p>
            If within fourteen (14) calendar days of an initial paid subscription payment, an institution is not satisfied with the software, the institution may request a full refund by contacting billing@schoolos.app. Upon review, the full subscription amount paid (in BDT) will be refunded to the original payment source (bKash or bank account) within 5–7 business days.
          </p>

          <h2 className="text-xl font-bold text-white">3. Annual Plan Proration</h2>
          <p>
            Annual subscriptions that are cancelled after the initial 14-day window are eligible for prorated credit based on remaining full unused months, calculated using standard non-discounted monthly rates.
          </p>

          <h2 className="text-xl font-bold text-white">4. Add-on Services Exclusion</h2>
          <p>
            Consumable add-on purchases (such as WhatsApp template delivery credits or bulk SMS units that have already been transmitted over telecommunications networks) are non-refundable once delivered.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

