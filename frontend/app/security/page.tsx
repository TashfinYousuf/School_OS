"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Database, FileCheck, AlertTriangle, ArrowRight } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function SecurityPage() {
  const pillars = [
    {
      icon: Database,
      title: "PostgreSQL Native Row Level Security (RLS)",
      description: "Data isolation is not left to application code. Every query is filtered at the database kernel level using PostgreSQL RLS policies, ensuring absolute tenant boundaries between schools."
    },
    {
      icon: Lock,
      title: "End-to-End Cryptographic Standards",
      description: "Passwords are protected with salted bcrypt hashing (cost factor 12). Webhook callbacks use HMAC-SHA256 signatures, and communications are strictly encrypted under TLS 1.3."
    },
    {
      icon: ShieldCheck,
      title: "Zero Student PII Monetization",
      description: "Student, guardian, and staff records are owned exclusively by the institution. EducationOS never sells, licenses, or targets advertising against student data."
    },
    {
      icon: FileCheck,
      title: "Immutable Append-Only Audit Ledgers",
      description: "All critical mutations—such as fee collection, grade modifications, waiver approvals, and subscription status transitions—are recorded in append-only audit tables."
    },
    {
      icon: AlertTriangle,
      title: "Anti-Prompt-Injection AI Firewalls",
      description: "EducationOS AI Gateway sanitizes all LLM inputs against OWASP Top 10 for LLM risks (prompt injections, jailbreaks, and sensitive financial data leakage)."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
            <ShieldCheck size={14} />
            <span>AEGIS-X Sentinel Architecture</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Security & Data Protection by Design
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            EducationOS protects sensitive institutional data, student grade records, and financial ledgers with military-grade defense in depth.
          </p>
        </div>

        {/* Security Pillars Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {pillars.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/30 transition-colors space-y-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Icon size={24} />
                </div>
                <h3 className="text-xl font-bold text-white">{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {p.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Responsible Disclosure & Compliance Box */}
        <div className="p-8 sm:p-12 rounded-3xl bg-slate-900/40 border border-slate-800 space-y-4">
          <h2 className="text-2xl font-bold text-white">Security Vulnerability Disclosure</h2>
          <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
            EducationOS welcomes independent security research. If you discover a potential vulnerability, please report it directly to our security engineering team at <span className="text-indigo-400 font-mono">security@schoolos.app</span>. We respond to all verified security reports within 24 hours.
          </p>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

