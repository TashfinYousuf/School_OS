"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calculator, ArrowRight, Clock, DollarSign, FileSpreadsheet, ShieldAlert } from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function RoiCalculator() {
  const [studentCount, setStudentCount] = useState<number>(350);
  const [institutionType, setInstitutionType] = useState<"school" | "academy">("school");
  const { t } = useLanguage();

  // Benchmark calculations based on student size
  const hoursAttendance = Math.round((studentCount / 100) * 8);
  const hoursExamTabulation = Math.round((studentCount / 100) * 16);
  const hoursFeeReconciliation = Math.round((studentCount / 100) * 10);
  const totalHoursSaved = hoursAttendance + hoursExamTabulation + hoursFeeReconciliation;

  // Financial estimates (in BDT)
  const paperPrintingSaved = Math.round(studentCount * 35); // ৳35 per student/mo saved on paper report cards & tokens
  const feeRecoveryEstimate = Math.round(studentCount * 120); // Dues tracking recovers ~৳120 per student in lost cash/unpaid dues

  // Suggested Plan Tier
  let suggestedPlan = "SchoolOS Starter";
  let planPrice = 990;
  if (institutionType === "academy") {
    if (studentCount <= 150) {
      suggestedPlan = "AcademyOS Starter";
      planPrice = 1490;
    } else {
      suggestedPlan = "AcademyOS Growth";
      planPrice = 3990;
    }
  } else {
    if (studentCount <= 100) {
      suggestedPlan = "SchoolOS Starter";
      planPrice = 990;
    } else if (studentCount <= 500) {
      suggestedPlan = "SchoolOS Growth";
      planPrice = 2490;
    } else {
      suggestedPlan = "SchoolOS Professional";
      planPrice = 5990;
    }
  }

  const netMonthlyBenefit = paperPrintingSaved + feeRecoveryEstimate - planPrice;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
            <Calculator size={14} />
            <span>Interactive Operational Benchmark</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {t("roi.title")}
          </h2>
          <p className="text-slate-400 text-sm">
            {t("roi.subtitle")}
          </p>
        </div>

        {/* Inputs */}
        <div className="space-y-6 mb-10">
          {/* Institution Type Toggle */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Institution Category
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInstitutionType("school")}
                className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  institutionType === "school"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                K-12 Formal School / College
              </button>
              <button
                type="button"
                onClick={() => setInstitutionType("academy")}
                className={`py-3 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  institutionType === "academy"
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                Coaching Center / Model Test
              </button>
            </div>
          </div>

          {/* Student Slider */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label htmlFor="student-count-slider" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Active Student Enrollment
              </label>
              <span className="text-xl font-extrabold text-indigo-400 font-mono">
                {studentCount.toLocaleString()} Students
              </span>
            </div>
            <input
              id="student-count-slider"
              type="range"
              min="50"
              max="2500"
              step="25"
              value={studentCount}
              onChange={(e) => setStudentCount(Number(e.target.value))}
              className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Student Enrollment Slider"
            />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1">
              <span>50 Students</span>
              <span>1,250 Students</span>
              <span>2,500 Students</span>
            </div>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mb-1">
              ~{totalHoursSaved} hrs
            </div>
            <div className="text-xs text-slate-400">Monthly Faculty Hours Saved</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono mb-1">
              ৳{paperPrintingSaved.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Stationery & Printing Saved / mo</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <DollarSign size={20} />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mb-1">
              +৳{netMonthlyBenefit.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400">Net Estimated Monthly Value</div>
          </div>
        </div>

        {/* Suggested Plan Callout */}
        <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
              Recommended Plan for {studentCount} Students:
            </div>
            <div className="text-lg font-bold text-white flex items-center gap-2">
              <span>{suggestedPlan}</span>
              <span className="text-sm font-normal text-slate-400 font-mono">
                (৳{planPrice.toLocaleString()}/mo)
              </span>
            </div>
          </div>
          <Link
            href={`/pricing#${suggestedPlan.toLowerCase().replace(/\s+/g, "_")}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors whitespace-nowrap"
          >
            <span>Review Plan Details</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        {/* Disclaimer (Section C3 Mandatory Requirement) */}
        <div className="flex items-start gap-2.5 text-[11px] text-slate-400 bg-slate-950/40 p-3.5 rounded-xl border border-slate-800/50">
          <ShieldAlert size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p>{t("roi.disclaimer")}</p>
        </div>
      </div>
    </div>
  );
}

