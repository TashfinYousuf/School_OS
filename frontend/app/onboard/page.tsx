"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  School,
  Building2,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Layers,
  Loader2,
  Lock,
  Mail,
  Phone,
  MapPin,
  User,
  AlertCircle,
  Calculator,
  Check,
  Tag,
  ChevronDown,
  ChevronUp,
  Info,
  X,
  SlidersHorizontal,
  Eye,
  ExternalLink
} from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";
import {
  calculateDynamicQuote,
  CORE_MODULES,
  OPTIONAL_MODULES,
  APPROVED_PLANS,
  ModuleItem,
  PlanItem,
  DynamicQuoteCalculation
} from "@/lib/plans";
import { fetchWithTenant } from "@/lib/api-client";
import RoiCalculator from "@/components/public/RoiCalculator";

const DRAFT_STORAGE_KEY = "educationos_onboarding_draft";

function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Password must be at least 10 characters.";
  if (new TextEncoder().encode(pw).length > 72) return "Password is too long (max 72 bytes).";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Password must contain both letters and digits.";
  return null;
}

function OnboardForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Query parameter defaults from pricing calculator
  const initialType = (searchParams.get("type") as "school" | "college" | "academy") || "school";
  const initialStudents = parseInt(searchParams.get("students") || "250", 10);
  const initialCycle = (searchParams.get("cycle") as "monthly" | "annual") || "monthly";
  const initialModules = searchParams.get("modules") 
    ? searchParams.get("modules")!.split(",").filter(Boolean)
    : ["module_ai_assistant", "module_advanced_finance"];

  const [institutionType, setInstitutionType] = useState<"school" | "college" | "academy">(initialType);
  const [studentCount, setStudentCount] = useState<number>(initialStudents);
  const [selectedModules, setSelectedModules] = useState<string[]>(initialModules);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">(initialCycle);

  const [schoolName, setSchoolName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [provisionedData, setProvisionedData] = useState<{
    tenant_id: string;
    school_code: string;
    admin_name: string;
  } | null>(null);

  // Module Inspection & Plan Selection State
  const [showCoreAccordion, setShowCoreAccordion] = useState(false);
  const [activeModalModule, setActiveModalModule] = useState<ModuleItem | null>(null);
  const [showPlanCompareModal, setShowPlanCompareModal] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const toggleModule = (modId: string) => {
    setSelectedModules((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleSelectPrepackagedPlan = (plan: PlanItem) => {
    setStudentCount(plan.maxStudents);
    setSelectedPlanId(plan.id);
    if (plan.id === "school_starter") {
      setSelectedModules([]);
    } else if (plan.id === "school_growth") {
      setSelectedModules(["module_ai_assistant", "module_whatsapp_alerts"]);
    } else if (plan.id === "school_pro") {
      setSelectedModules(["module_ai_assistant", "module_advanced_finance", "module_whatsapp_alerts"]);
    } else if (plan.id === "academy_starter") {
      setSelectedModules([]);
    } else if (plan.id === "academy_growth") {
      setSelectedModules(["module_ai_assistant", "module_advanced_finance"]);
    } else if (plan.id === "unified_pro") {
      setSelectedModules(["module_ai_assistant", "module_advanced_finance", "module_school_website", "module_custom_domain", "module_whatsapp_alerts"]);
    }
    setShowPlanCompareModal(false);
  };

  // Restore draft from sessionStorage if available
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.schoolName) setSchoolName(parsed.schoolName);
          if (parsed.adminName) setAdminName(parsed.adminName);
          if (parsed.adminEmail) setAdminEmail(parsed.adminEmail);
          if (parsed.contactPhone) setContactPhone(parsed.contactPhone);
          if (parsed.address) setAddress(parsed.address);
          if (parsed.inviteCode) setInviteCode(parsed.inviteCode);
          if (parsed.institutionType) setInstitutionType(parsed.institutionType);
          if (parsed.studentCount) setStudentCount(parsed.studentCount);
          if (parsed.billingCycle) setBillingCycle(parsed.billingCycle);
          if (parsed.selectedModules) setSelectedModules(parsed.selectedModules);
        }
      } catch {
        // Ignore parse error
      }
    });
  }, []);

  // Sync draft to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          schoolName,
          adminName,
          adminEmail,
          contactPhone,
          address,
          inviteCode,
          institutionType,
          studentCount,
          billingCycle,
          selectedModules
        })
      );
    } catch {
      // Ignore quota error
    }
  }, [
    schoolName,
    adminName,
    adminEmail,
    contactPhone,
    address,
    inviteCode,
    institutionType,
    studentCount,
    billingCycle,
    selectedModules
  ]);

  const [backendQuote, setBackendQuote] = useState<DynamicQuoteCalculation | null>(null);

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
        billing_cycle: billingCycle,
        pilot_code: inviteCode || undefined,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
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
          selectedAddons: {},
          isPilot: Boolean(data.is_complimentary_pilot),
        });
      })
      .catch(() => {
        if (active) setBackendQuote(null);
      });
    return () => {
      active = false;
    };
  }, [institutionType, studentCount, selectedModules, billingCycle, inviteCode]);

  // Compute dynamic quote based on authoritative backend quote (fallback draft offline)
  const quote: DynamicQuoteCalculation = useMemo(() => {
    if (backendQuote) return backendQuote;
    return calculateDynamicQuote({
      institutionType,
      studentCount,
      selectedModules,
      billingCycle,
      pilotCode: inviteCode
    });
  }, [backendQuote, institutionType, studentCount, selectedModules, billingCycle, inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pwError = passwordProblem(adminPassword);
    if (pwError) {
      setErrorMsg(pwError);
      return;
    }

    setSubmitting(true);

    const payload = {
      school_name: schoolName.trim(),
      admin_name: adminName.trim(),
      admin_email: adminEmail.trim().toLowerCase(),
      admin_password: adminPassword,
      contact_phone: contactPhone.trim(),
      address: address.trim() || "Main Campus, Bangladesh",
      invite_code: inviteCode.trim() || undefined,
      plan_id: selectedPlanId || undefined,
      selected_modules: selectedModules,
      billing_cycle: billingCycle,
    };

    try {
      const res = await fetchWithTenant("/api/v1/auth/register-school", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const detail = data?.detail;
        let msg = "Institutional registration failed. Please check your information.";
        if (typeof detail === "string") msg = detail;
        else if (Array.isArray(detail)) {
          msg = detail.map((d: { msg?: string }) => d.msg || "Invalid field").join(" • ");
        }
        throw new Error(msg);
      }

      // Successful registration & session provisioning
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);

      if (data.access_token) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("access_token", data.access_token);
        if (data.refresh_token) localStorage.setItem("refresh_token", data.refresh_token);
        localStorage.setItem("user_role", "admin");
        localStorage.setItem("user_name", data.name || adminName);
        localStorage.setItem("tenant_id", String(data.tenant_id));
        localStorage.setItem("school_name", schoolName);

        window.dispatchEvent(new Event("auth-changed"));
      }

      setProvisionedData({
        tenant_id: data.tenant_id,
        school_code: data.school_code || "ACTIVE",
        admin_name: data.name || adminName
      });

      // Automatically transition to dashboard after brief confirmation
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "An unexpected error occurred during onboarding.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-10">
      
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
          <ShieldCheck size={14} />
          <span>Canonical Institutional Onboarding</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Register Your Institution
        </h1>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
          Provision your secure multi-tenant campus portal. Take attendance, publish NCTB grades, and manage tuition fees with dedicated database isolation.
        </p>
      </div>

      {/* Institution Type Selector */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setInstitutionType("school")}
          className={`p-4 rounded-2xl border text-center transition-all ${
            institutionType === "school"
              ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-bold"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <School className="mx-auto mb-2 text-indigo-400" size={24} />
          <div className="text-xs">K-12 School</div>
        </button>

        <button
          type="button"
          onClick={() => setInstitutionType("college")}
          className={`p-4 rounded-2xl border text-center transition-all ${
            institutionType === "college"
              ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-bold"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <Building2 className="mx-auto mb-2 text-sky-400" size={24} />
          <div className="text-xs">College / Intermediate</div>
        </button>

        <button
          type="button"
          onClick={() => setInstitutionType("academy")}
          className={`p-4 rounded-2xl border text-center transition-all ${
            institutionType === "academy"
              ? "bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 font-bold"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          <GraduationCap className="mx-auto mb-2 text-emerald-400" size={24} />
          <div className="text-xs">Academy / Coaching</div>
        </button>
      </div>



      {/* Interactive Pricing, Modules & Transparency Hub */}
      <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Calculator size={18} className="text-indigo-400" />
              <h2 className="text-base font-bold text-white">Commercial Configuration & Quotas</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Select student scale, toggle specialized modules, and preview transparent pricing breakdown.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPlanCompareModal(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal size={14} />
            <span>Compare Pre-Packaged Plans</span>
          </button>
        </div>

        {/* Capacity & Cycle Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-300">Enrolled Student Capacity</span>
              <span className="font-mono font-bold text-indigo-400">{studentCount} Students</span>
            </div>
            <input
              type="range"
              min={50}
              max={1500}
              step={25}
              value={studentCount}
              onChange={(e) => setStudentCount(parseInt(e.target.value, 10))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>50</span>
              <span>500</span>
              <span>1,000</span>
              <span>1,500+</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <span className="block text-xs font-semibold text-slate-300">Billing Cycle</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                  billingCycle === "monthly"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 ${
                  billingCycle === "annual"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/30"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <span>Annual</span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                  Save 15%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Expandable Included Core Modules Accordion (9 Modules) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowCoreAccordion(!showCoreAccordion)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">
                  Included Core Platform Modules (9 Core Operations)
                </span>
                <span className="text-[11px] text-slate-400">
                  Included free with every active EducationOS subscription at ৳0 add-on cost
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ৳0 Included
              </span>
              {showCoreAccordion ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </div>
          </button>

          {showCoreAccordion && (
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/90 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in duration-200">
              {Object.values(CORE_MODULES).map((mod) => (
                <div key={mod.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-white">{mod.name}</span>
                      <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">FREE</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{mod.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveModalModule(mod)}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 pt-1"
                  >
                    <Info size={11} />
                    <span>Inspect details</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Customizable Optional Modules (5 Modules) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Customize Optional Modules ({selectedModules.length} Active)</span>
            </span>
            <span className="text-[11px] text-slate-500">Toggle on/off to adapt to your school budget</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(OPTIONAL_MODULES).map((mod) => {
              const isSelected = selectedModules.includes(mod.id);
              return (
                <div
                  key={mod.id}
                  onClick={() => toggleModule(mod.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between select-none ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500/60 shadow-lg shadow-indigo-600/10"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "border-slate-700 bg-slate-900"
                        }`}>
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className={`text-xs font-semibold ${isSelected ? "text-white" : "text-slate-300"}`}>
                          {mod.name}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-indigo-300 shrink-0">
                        +৳{mod.priceMonthlyBdt.toLocaleString()}/mo
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-6 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>

                  <div className="pt-2 pl-6 flex justify-end">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveModalModule(mod);
                      }}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                    >
                      <Info size={11} />
                      <span>Learn more</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Quotation Summary Bar */}
        <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-bold text-white">
              <span>Estimated Billing Summary:</span>
              <span className="text-indigo-300">
                {billingCycle === "annual" ? "Annual Prepaid (15% Off)" : "Monthly Flexible"}
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Base Platform (৳{quote.basePlatformFeeBdt.toLocaleString()}) + Students (৳{quote.studentChargeBdt.toLocaleString()}) + Optional Modules (৳{quote.modulesSubtotalBdt.toLocaleString()})
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="font-mono text-xl font-black text-indigo-300">
              {quote.isPilot ? "৳0.00 (Pilot Pass Active)" : `৳${quote.totalDueBdt.toLocaleString()}`}
            </div>
            <span className="text-[10px] text-emerald-400 block font-semibold">
              {quote.isPilot ? "60-Day Complimentary Pilot Pass" : "Includes 14-Day Free Evaluation"}
            </span>
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border border-slate-800">
        {provisionedData ? (
          <div className="text-center py-8 space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Institution Provisioned!</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Welcome, <span className="text-white font-semibold">{provisionedData.admin_name}</span>. Your workspace for <span className="text-white font-semibold">{schoolName}</span> is active with full administrative authority.
            </p>
            <div className="p-3 bg-slate-950 rounded-xl max-w-xs mx-auto border border-slate-800 text-xs font-mono text-slate-400">
              Campus Code: <strong className="text-indigo-400">{provisionedData.school_code}</strong>
            </div>
            <div className="pt-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all hover:scale-105"
              >
                <span>Enter Institution Dashboard</span>
                <ArrowRight size={16} />
              </Link>
            </div>
            <p className="text-xs text-slate-500">Redirecting automatically in a moment...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Building2 size={16} className="text-indigo-400" />
                <span>1. Institution Information</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Official School Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Dhaka Model Academy"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Campus Contact Phone <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Campus Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Sector 4, Uttara, Dhaka"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <User size={16} className="text-sky-400" />
                <span>2. Principal / Administrator Account</span>
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Administrator Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Headmaster Ahmed"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Official Admin Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@school.edu.bd"
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Secure Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-3.5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="At least 10 characters with letters & numbers"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Minimum 10 characters with letters and numbers.</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Tag size={16} className="text-emerald-400" />
                  <span>3. Institutional Invitation or Pilot Code</span>
                </h2>
                <span className="text-[11px] text-slate-500">Optional</span>
              </div>

              <div className="space-y-1.5">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. KIDSSHINE (for 60-day approved pilot access)"
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs uppercase font-mono tracking-wider placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <p className="text-[11px] text-slate-500">
                  Approved partner institutions can enter their promo or pilot pass code here.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Provisioning Institution & Workspaces...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Registration & Launch Workspace</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>

            <div className="text-center pt-2 border-t border-slate-800">
              <p className="text-xs text-slate-400">
                Already have an active institution account?{" "}
                <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold underline">
                  Sign in here
                </Link>
              </p>
            </div>
          </form>
        )}
      </div>

      {/* MODULE DETAILS MODAL / DRAWER */}
      {activeModalModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {activeModalModule.category} Module
                </div>
                <h3 className="text-lg font-bold text-white">{activeModalModule.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalModule(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Monthly Commercial Charge:</span>
              <span className="font-mono text-sm font-bold text-indigo-300">
                {activeModalModule.isCore ? "Included in Base Platform (৳0)" : `+৳${activeModalModule.priceMonthlyBdt.toLocaleString()} / mo`}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Functional Overview</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeModalModule.description}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Platform Safeguards & SLA</h4>
              <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside">
                <li>Isolated multi-tenant PostgreSQL schema boundaries with RLS enforcement.</li>
                <li>Full audit trail logging for all administrative modifications.</li>
                <li>Offline-resilient IndexedDB synchronizer with conflict auto-resolution.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveModalModule(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Close Specification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PLAN COMPARISON MODAL */}
      {showPlanCompareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6 my-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-white">Compare Pre-Packaged Institutional Plans</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Choose a fixed-tier bundle or return to customize modules à la carte.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlanCompareModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {APPROVED_PLANS.filter((p) => p.category === "school").map((plan) => (
                <div
                  key={plan.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between space-y-4 ${
                    plan.popular
                      ? "bg-indigo-950/40 border-indigo-500 shadow-xl shadow-indigo-600/10 ring-1 ring-indigo-500/50"
                      : "bg-slate-950 border-slate-800"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white">{plan.name}</span>
                      {plan.popular && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          POPULAR
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-mono text-2xl font-black text-indigo-300">
                        ৳{plan.priceMonthlyBdt.toLocaleString()}
                        <span className="text-xs text-slate-500 font-normal"> / mo</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Up to {plan.maxStudents} students</span>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                      {plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectPrepackagedPlan(plan)}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                        : "bg-slate-800 hover:bg-slate-700 text-white"
                    }`}
                  >
                    Select {plan.name}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPlanCompareModal(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-colors"
              >
                Return to Customizer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function OnboardEntryPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />
      <Suspense fallback={<div className="pt-36 text-center text-slate-400">Loading onboarding wizard...</div>}>
        <OnboardForm />
      </Suspense>
      <PublicFooter />
    </div>
  );
}
