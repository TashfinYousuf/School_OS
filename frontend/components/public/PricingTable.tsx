"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, Shield, HelpCircle, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { APPROVED_PLANS, PlanItem } from "@/lib/plans";

export type { PlanItem };
export { APPROVED_PLANS };

export default function PricingTable() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [activeCategory, setActiveCategory] = useState<"all" | "school" | "academy" | "unified">("all");
  const { t } = useLanguage();

  const filteredPlans = APPROVED_PLANS.filter(
    (p) => activeCategory === "all" || p.category === activeCategory
  );

  return (
    <div className="space-y-12">
      {/* Category & Billing Cycle Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 max-w-4xl mx-auto">
        {/* Category Pills */}
        <div className="flex items-center p-1.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-xl transition-colors ${
              activeCategory === "all"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            All Plans
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("school")}
            className={`px-4 py-2 rounded-xl transition-colors ${
              activeCategory === "school"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Formal Schools
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("academy")}
            className={`px-4 py-2 rounded-xl transition-colors ${
              activeCategory === "academy"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Coaching Academies
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("unified")}
            className={`px-4 py-2 rounded-xl transition-colors ${
              activeCategory === "unified"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Unified Campus
          </button>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
              billingCycle === "monthly"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("pricing.monthly")}
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("annual")}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              billingCycle === "annual"
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <span>{t("pricing.annual")}</span>
            <span className="text-[10px] bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded-full">
              Save ~17%
            </span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPlans.map((plan) => {
          const displayPrice =
            billingCycle === "annual"
              ? Math.round(plan.priceMonthlyBdt * (10 / 12))
              : plan.priceMonthlyBdt;
          const annualTotal = plan.priceMonthlyBdt * 10;

          return (
            <div
              key={plan.id}
              id={plan.id}
              className={`relative rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ${
                plan.popular
                  ? "bg-gradient-to-b from-slate-900 via-slate-900/90 to-indigo-950/40 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10"
                  : "bg-slate-900/60 border border-slate-800 hover:border-slate-700"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-indigo-500 text-white shadow-md shadow-indigo-500/30 flex items-center gap-1.5">
                  <Sparkles size={12} />
                  <span>Most Popular Tier</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2.5 py-1 rounded-full bg-slate-800">
                    {plan.category}
                  </span>
                </div>

                {/* Price Display */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-white font-mono">
                      ৳{displayPrice.toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-400">{t("pricing.perMonth")}</span>
                  </div>
                  {billingCycle === "annual" ? (
                    <div className="text-xs text-indigo-400 font-medium mt-1">
                      Billed annually at ৳{annualTotal.toLocaleString()}/yr (10 months charged)
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 mt-1">
                      Billed monthly with zero annual commitment
                    </div>
                  )}
                </div>

                {/* Key Capacity Badges */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <div className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
                    Max {plan.maxStudents.toLocaleString()} Students
                  </div>
                  <div className="text-xs font-medium px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    {plan.aiQuota.toLocaleString()} AI Questions/mo
                  </div>
                </div>

                {/* Feature List */}
                <ul className="space-y-3 mb-8 text-sm text-slate-300">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <Check size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Conversion CTA */}
              <div>
                <Link
                  href={`/onboard?plan=${plan.id}&cycle=${billingCycle}`}
                  className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm text-center flex items-center justify-center gap-2 transition-all ${
                    plan.popular
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                >
                  <span>{t("pricing.startTrial")}</span>
                  <ArrowRight size={16} />
                </Link>
                <div className="text-[11px] text-center text-slate-400 mt-2.5">
                  14 days free • No credit card required upfront
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Enterprise / Custom Plan Box */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
            <Shield size={14} />
            <span>Enterprise Multi-Campus Governance</span>
          </div>
          <h3 className="text-2xl font-bold text-white">Need a Custom Dedicated Deployment?</h3>
          <p className="text-slate-400 text-sm max-w-xl">
            For school districts, trust conglomerates with 5,000+ students, or institutions requiring on-premises data locality, white-label apps, and custom ERP integration.
          </p>
        </div>
        <Link
          href="/contact?type=enterprise"
          className="px-6 py-3.5 rounded-2xl bg-white text-slate-950 hover:bg-slate-200 font-bold text-sm whitespace-nowrap transition-colors"
        >
          Speak with Architecture Team
        </Link>
      </div>
    </div>
  );
}

