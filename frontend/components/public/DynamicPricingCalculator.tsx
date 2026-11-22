"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Calculator,
  Building2,
  Users,
  Layers,
  Sparkles,
  Check,
  ShieldCheck,
  ArrowRight,
  Info,
  DollarSign,
  HelpCircle,
  Plus
} from "lucide-react";
import {
  BASE_PLATFORM_FEE_BDT,
  CORE_MODULES,
  OPTIONAL_MODULES,
  AVAILABLE_ADDONS,
  ANNUAL_DISCOUNT_PERCENT,
  calculateDynamicQuote,
  DynamicQuoteCalculation
} from "@/lib/plans";
import { useLanguage } from "@/components/providers";

export default function DynamicPricingCalculator() {
  const { language } = useLanguage();

  const [institutionType, setInstitutionType] = useState<"school" | "college" | "academy">("school");
  const [studentCount, setStudentCount] = useState<number>(250);
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "module_ai_assistant",
    "module_advanced_finance"
  ]);
  const [addons, setAddons] = useState<Record<string, number>>({
    sms_bundle_500: 1,
    ai_tokens_500k: 0
  });
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [backendQuote, setBackendQuote] = useState<DynamicQuoteCalculation | null>(null);
  const [isOwnerApproved, setIsOwnerApproved] = useState<boolean>(false);

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const updateAddon = (id: string, delta: number) => {
    setAddons((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  // Authoritative quote synced from backend Decimal PricingEngine
  useEffect(() => {
    let active = true;
    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
    fetch(`${base}/api/v1/billing/calculate-quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        institution_type: institutionType,
        student_count: studentCount,
        selected_modules: selectedModules,
        add_ons: addons,
        billing_cycle: billingCycle,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        setIsOwnerApproved(Boolean(data.is_owner_approved));
        setBackendQuote({
          institutionType: data.institution_type,
          studentCount: data.student_count,
          billingCycle: data.billing_cycle,
          basePlatformFeeBdt: data.base_platform_fee_bdt,
          studentChargeBdt: data.student_charge_bdt,
          modulesSubtotalBdt: data.modules_subtotal_bdt,
          addonsSubtotalBdt: data.addons_subtotal_bdt,
          monthlyGrossBdt: data.monthly_gross_bdt,
          discountPercent: data.discount_percent,
          discountAmountBdt: data.discount_amount_bdt,
          monthlyNetBdt: data.monthly_net_bdt,
          totalDueBdt: data.total_due_bdt,
          billingPeriodMonths: data.billing_period_months ?? (billingCycle === "annual" ? 12 : 1),
          selectedModules,
          selectedAddons: addons,
          isPilot: Boolean(data.is_complimentary_pilot),
        });
      })
      .catch(() => {
        if (active) setBackendQuote(null);
      });
    return () => {
      active = false;
    };
  }, [institutionType, studentCount, selectedModules, addons, billingCycle]);

  const quote: DynamicQuoteCalculation = useMemo(() => {
    if (backendQuote) return backendQuote;
    return calculateDynamicQuote({
      institutionType,
      studentCount,
      selectedModules,
      add_ons: addons,
      billingCycle
    });
  }, [backendQuote, institutionType, studentCount, selectedModules, addons, billingCycle]);

  // Generate safe query string to pass configuration directly to /onboard
  const onboardHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("type", institutionType);
    params.set("students", String(studentCount));
    params.set("cycle", billingCycle);
    if (selectedModules.length > 0) {
      params.set("modules", selectedModules.join(","));
    }
    return `/onboard?${params.toString()}`;
  }, [institutionType, studentCount, billingCycle, selectedModules]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-10">
      
      {/* Calculator Header & Controls */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <Calculator size={14} />
          <span>{language === "EN" ? "Dynamic Institutional Pricing Engine" : "ডাইনামিক প্রাতিষ্ঠানিক মূল্য নির্ধারণ ক্যালকুলেটর"}</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          {language === "EN" ? "Custom Capacity & Module Pricing" : "আপনার প্রতিষ্ঠানের সঠিক ধারণক্ষমতা অনুযায়ী স্বচ্ছ মূল্য"}
        </h2>
        <p className="text-slate-400 text-sm max-w-2xl mx-auto">
          {language === "EN" 
            ? "Configure your student volume, included core tools, and optional modules. Zero hidden fees, no forced package tiers." 
            : "শিক্ষার্থী সংখ্যা ও প্রয়োজনীয় মডিউল নির্বাচন করুন। কোনো গোপন ফি বা অপ্রয়োজনীয় প্যাকেজ চাপিয়ে দেওয়া হবে না।"}
        </p>
      </div>

      {/* Main Grid: Controls on Left, Real-time Quote Card on Right */}
      <div className="grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (Inputs & Selections) - 7 cols */}
        <div className="lg:col-span-7 space-y-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8">
          
          {/* Step 1: Institution Type */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 size={16} className="text-indigo-400" />
              <span>1. {language === "EN" ? "Institution Type" : "প্রতিষ্ঠানের ধরন"}</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: "school", label: language === "EN" ? "School" : "স্কুল" },
                  { id: "college", label: language === "EN" ? "College" : "কলেজ" },
                  { id: "academy", label: language === "EN" ? "Academy / Coaching" : "একাডেমি / কোচিং" }
                ] as const
              ).map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setInstitutionType(type.id)}
                  className={`py-3 px-3 rounded-2xl text-xs font-bold border transition-all ${
                    institutionType === type.id
                      ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Student Capacity Slider */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} className="text-indigo-400" />
                <span>2. {language === "EN" ? "Billable Active Students" : "সক্রিয় শিক্ষার্থীর সংখ্যা"}</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={5000}
                  value={studentCount}
                  onChange={(e) => setStudentCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-right font-mono font-bold text-indigo-400 text-sm focus:outline-none focus:border-indigo-500"
                />
                <span className="text-xs text-slate-400">{language === "EN" ? "Students" : "শিক্ষার্থী"}</span>
              </div>
            </div>

            <input
              type="range"
              min={25}
              max={2500}
              step={25}
              value={studentCount}
              onChange={(e) => setStudentCount(parseInt(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />

            <div className="flex justify-between text-[11px] text-slate-500">
              <span>25 ({language === "EN" ? "Pilot" : "পাইলট"})</span>
              <span>250 ({language === "EN" ? "Average School" : "সাধারণ স্কুল"})</span>
              <span>750 ({language === "EN" ? "Large Campus" : "বড় ক্যাম্পাস"})</span>
              <span>2,500+ ({language === "EN" ? "Multi-Branch" : "মাল্টি-ব্রাঞ্চ"})</span>
            </div>
          </div>

          {/* Step 3: Core Included Modules (Informational) */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-400" />
                <span>3. {language === "EN" ? "Core Platform Modules" : "মূল প্ল্যাটফর্ম মডিউলসমূহ"}</span>
              </label>
              <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {language === "EN" ? "Included with Base Platform" : "বেস ফি-র অন্তর্ভুক্ত"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px] text-slate-300">
              {Object.values(CORE_MODULES).map((mod) => (
                <div key={mod.id} className="flex items-center gap-2 p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{mod.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Optional Paid Modules */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers size={16} className="text-indigo-400" />
              <span>4. {language === "EN" ? "Optional Value-Add Modules" : "ঐচ্ছিক পেইড মডিউল"}</span>
            </label>
            <div className="space-y-2.5">
              {Object.values(OPTIONAL_MODULES).map((mod) => {
                const isSelected = selectedModules.includes(mod.id);
                return (
                  <div
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                      isSelected
                        ? "bg-indigo-950/30 border-indigo-500/60 text-white"
                        : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                        isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-700 bg-slate-900"
                      }`}>
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div>
                        <div className="text-xs font-bold">{mod.name}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{mod.description}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-indigo-400">
                        +৳{mod.priceMonthlyBdt.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-slate-500">/mo</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 5: Add-ons & Usage Bundles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              <span>5. {language === "EN" ? "Service Usage Credits" : "সার্ভিস ক্রেডিট ও অ্যাড-অন"}</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.values(AVAILABLE_ADDONS).map((addon) => {
                const count = addons[addon.id] || 0;
                return (
                  <div key={addon.id} className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold text-white">{addon.name}</span>
                      <span className="text-xs font-mono font-bold text-amber-400">৳{addon.unitPriceBdt}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400">{addon.unitLabel}</span>
                      <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => updateAddon(addon.id, -1)}
                          className="text-slate-400 hover:text-white px-1 font-bold text-sm"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs text-white min-w-[20px] text-center font-bold">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateAddon(addon.id, 1)}
                          className="text-slate-400 hover:text-white px-1 font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column (Dynamic Quote Breakdown Card) - 5 cols */}
        <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-28">
          
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/30 shadow-2xl space-y-6 relative overflow-hidden">
            
            <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Billing Cycle Selector */}
            <div className="flex items-center justify-between p-1 bg-slate-950 border border-slate-800 rounded-2xl">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                  billingCycle === "monthly"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {language === "EN" ? "Monthly" : "মাসিক"}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>{language === "EN" ? "Annual" : "বার্ষিক"}</span>
                <span className="text-[10px] bg-emerald-500 text-black font-extrabold px-1.5 py-0.5 rounded-full">
                  -15%
                </span>
              </button>
            </div>

            {/* Total Price Display */}
            <div className="space-y-1">
              <div className="text-xs text-slate-400 font-semibold">
                {billingCycle === "annual" 
                  ? (language === "EN" ? "Total Annual Investment (12 Months)" : "মোট বার্ষিক বিনিয়োগ (১২ মাস)")
                  : (language === "EN" ? "Estimated Monthly Recurring Fee" : "মাসিক সাবস্ক্রিপশন ফি")}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                  ৳{quote.totalDueBdt.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400">
                  {billingCycle === "annual" ? "/year" : "/month"}
                </span>
              </div>
              {billingCycle === "annual" && (
                <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1 pt-1">
                  <Check size={14} />
                  <span>
                    {language === "EN" 
                      ? `Includes 15% annual discount (saved ৳${quote.discountAmountBdt.toLocaleString()})`
                      : `১৫% বার্ষিক ছাড় অন্তর্ভুক্ত (সাশ্রয় ৳${quote.discountAmountBdt.toLocaleString()})`}
                  </span>
                </div>
              )}
            </div>

            {/* Itemized Line-Items Breakdown */}
            <div className="space-y-3 pt-4 border-t border-slate-800 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>{language === "EN" ? "Base Platform Fee" : "বেস প্ল্যাটফর্ম ফি"}</span>
                <span className="font-mono text-white">৳{quote.basePlatformFeeBdt.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>
                  {language === "EN" 
                    ? `Student Capacity (${quote.studentCount} active)` 
                    : `শিক্ষার্থী ধারণক্ষমতা (${quote.studentCount} জন)`}
                </span>
                <span className="font-mono text-white">৳{quote.studentChargeBdt.toLocaleString()}</span>
              </div>
              {quote.modulesSubtotalBdt > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>{language === "EN" ? `Add-on Modules (${selectedModules.length})` : `পেইড মডিউলসমূহ (${selectedModules.length}টি)`}</span>
                  <span className="font-mono text-white">+৳{quote.modulesSubtotalBdt.toLocaleString()}</span>
                </div>
              )}
              {quote.addonsSubtotalBdt > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>{language === "EN" ? "Usage Credits" : "সার্ভিস ক্রেডিট"}</span>
                  <span className="font-mono text-white">+৳{quote.addonsSubtotalBdt.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* CTA Button */}
            <Link
              href={onboardHref}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02]"
            >
              <span>{language === "EN" ? "Start Onboarding with This Plan" : "এই প্ল্যানে অনবোর্ডিং শুরু করুন"}</span>
              <ArrowRight size={16} />
            </Link>

            {/* Transparent Disclaimers */}
            <div className="space-y-1.5 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Info size={12} className="text-blue-400 shrink-0" />
                <span>{language === "EN" ? "Transparent Institutional Governance" : "স্বচ্ছ প্রাতিষ্ঠানিক নীতিমালা"}</span>
              </div>
              <p>
                {language === "EN"
                  ? "Billable count reflects enrolled students with active attendance or fee records in the billing month. Graduated and withdrawn students are automatically excluded."
                  : "শুধুমাত্র চলতি মাসে নিয়মিত শিক্ষার্থী সংখ্যার ওপর ফি প্রযোজ্য হবে। পাস করা বা প্রত্যাহারকৃত শিক্ষার্থীদের কোনো চার্জ নেওয়া হয় না।"}
              </p>
              <div className="pt-1 text-[10px] text-amber-400/90 italic">
                {isOwnerApproved
                  ? "* Authoritative commercial pricing verified."
                  : "* Staged configurable draft pricing pending formal owner ratification."}
              </div>
            </div>

          </div>

          {/* Pilot Institution Direct Help Card */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 text-xs space-y-2">
            <div className="font-bold text-white flex items-center gap-2">
              <Building2 size={14} className="text-indigo-400" />
              <span>Institutional Pilot Program</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Are you part of the pilot group? Enter your institution code during onboarding to receive 60-day complimentary trial access.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}

