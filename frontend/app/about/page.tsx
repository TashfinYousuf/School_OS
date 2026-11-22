"use client";

import React from "react";
import Link from "next/link";
import { School, Heart, Target, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-16">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <School size={14} />
            <span>About EducationOS</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight leading-tight">
            Built by Educators & Engineers for Modern Campuses
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            EducationOS was founded to resolve the chronic administrative fragmentation, cash leakages, and manual paper bureaucracy that burden institutions across Bangladesh.
          </p>
        </div>

        {/* Narrative Section */}
        <div className="prose prose-invert max-w-none text-slate-300 space-y-6 leading-relaxed text-base">
          <h2 className="text-2xl font-bold text-white">Our Founding Story</h2>
          <p>
            Across Bangladesh, hundreds of thousands of dedicated teachers spend hours every day handwriting attendance registers, manually calculating terminal exam percentages, and tracking fee slips across disparate paper notebooks. Traditional school software failed because it was brittle, required continuous high-speed broadband, or exposed student data to unauthorized third parties.
          </p>
          <p>
            We set out to engineer an uncompromising institutional operating system: one that runs smoothly on low-end Android phones and desktop browsers, works completely offline when cellular towers drop, and guarantees mathematical security using kernel-level PostgreSQL Row Level Security.
          </p>

          <h2 className="text-2xl font-bold text-white pt-4">Engineering Principles</h2>
          <div className="grid sm:grid-cols-2 gap-6 not-prose pt-2">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h3 className="font-bold text-white text-base">1. Offline Resilience First</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Intermittent internet should never stop education. Teachers take roll call and mark scores offline; data queues sync seamlessly upon reconnection.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h3 className="font-bold text-white text-base">2. Kernel-Level Tenant Isolation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We believe institutional data privacy is a fundamental human right. Multi-tenant boundaries are locked at the database layer.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h3 className="font-bold text-white text-base">3. Human-in-the-Loop AI</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI assists educators by drafting routines and lesson diaries, but never modifies official student grades or accounts without administrative approval.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2">
              <h3 className="font-bold text-white text-base">4. Zero Advertising Monetization</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                We do not sell ads, student contact lists, or academic profiles. Our revenue model is transparent, subscription-based SaaS.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <h2 className="text-2xl font-bold text-white">Join the EducationOS Journey</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Discover how your campus can save hundreds of administrative hours while elevating academic outcomes.
          </p>
          <Link
            href="/onboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <span>Start Free Trial</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

