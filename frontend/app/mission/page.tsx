"use client";

import React from "react";
import Link from "next/link";
import { Target, Compass, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function MissionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Target size={14} />
            <span>Mission & Vision 2030</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            Our Mission: Autonomous Empowerment for Every Campus
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            Transforming education across Bangladesh and developing nations by replacing paper bureaucracy with intelligent, equitable, and privacy-first digital infrastructure.
          </p>
        </div>

        {/* Vision Statements */}
        <div className="space-y-8">
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Compass className="text-indigo-400" />
              <span>Vision 2030: The Digital Twin Campus</span>
            </h2>
            <p className="text-slate-300 leading-relaxed text-sm sm:text-base">
              By 2030, our goal is to empower over 10,000 schools, madrasas, and coaching academies to operate as autonomous digital ecosystems. We envision an educational environment where:
            </p>
            <ul className="space-y-3 pt-2 text-sm text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Teachers are freed from repetitive administrative tasks, spending 100% of their energy mentoring students.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Principals have real-time visibility into fee collections, faculty lesson coverage, and attendance trends on their smartphones.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Guardians, regardless of digital literacy, receive instant updates on their child&apos;s welfare and academic progress via simple WhatsApp messages.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>Educational data is sovereign, protected against cyber threats, and never exploited for corporate advertising.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Be Part of the Future of Education</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Experience the platform that is redefining educational leadership and campus operations.
          </p>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <span>Activate 30-Day Free Trial</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

