"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Check, HelpCircle, Shield, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";
import DynamicPricingCalculator from "@/components/public/DynamicPricingCalculator";
import PricingTable from "@/components/public/PricingTable";
import RoiCalculator from "@/components/public/RoiCalculator";

export default function PricingPage() {
  const [showPresets, setShowPresets] = useState(false);

  const addOns = [
    {
      name: "Extra AI Exam Question Credits",
      price: "৳250",
      unit: "per 500,000 tokens",
      description: "Expand AI question generation quota for high-volume terminal examinations and practice question paper drafting."
    },
    {
      name: "WhatsApp Notification Alerts",
      price: "৳0.80",
      unit: "per verified alert",
      description: "Direct WhatsApp parent notifications for real-time absence alerts, fee reminders, and terminal report card links."
    },
    {
      name: "Custom School Domain & Managed SSL",
      price: "৳500",
      unit: "/month",
      description: "Automated DNS hostname mapping for your official domain (e.g. school.edu.bd) with managed certificates."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-24">
        
        {/* Dynamic Pricing Engine Calculator (Primary Experience) */}
        <div>
          <DynamicPricingCalculator />
        </div>

        {/* Collapsible Preset Plan Reference */}
        <div className="pt-6 border-t border-slate-800 text-center">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            <span>{showPresets ? "Hide Preset Reference Packages" : "Looking for standard preset tiers? View reference catalogue"}</span>
            {showPresets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showPresets && (
            <div className="mt-12 text-left animate-in fade-in duration-300">
              <PricingTable />
            </div>
          )}
        </div>

        {/* Granular Add-ons */}
        <div className="space-y-8">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Flexible Capacity Add-ons
            </h2>
            <p className="text-slate-400 text-sm">
              Scale communication, AI questions, and domain services independently as your campus expands.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {addOns.map((addon, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3"
              >
                <h3 className="font-bold text-white text-base">{addon.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-indigo-400 font-mono">
                    {addon.price}
                  </span>
                  <span className="text-xs text-slate-400">{addon.unit}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {addon.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Interactive ROI Calculator */}
        <div>
          <RoiCalculator />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
