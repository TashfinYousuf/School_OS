"use client";

import React from "react";
import Link from "next/link";
import { Cpu, Database, Globe, Smartphone, Zap, ArrowRight, Layers } from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";

export default function TechnologyPage() {
  const stack = [
    {
      category: "Backend Engine",
      icon: Zap,
      tech: "Python 3.12 & FastAPI",
      description: "High-performance asynchronous REST API architecture capable of sub-50ms endpoint latencies and concurrent request handling."
    },
    {
      category: "Database & Storage",
      icon: Database,
      tech: "PostgreSQL & SQLAlchemy",
      description: "Relational persistence with transaction-isolated connection pools, Alembic migration version control, and native Row Level Security."
    },
    {
      category: "Frontend Architecture",
      icon: Globe,
      tech: "Next.js App Router & TypeScript",
      description: "Strictly typed React 19 interface with server-side rendering, instant client hydration, and zero layout shift."
    },
    {
      category: "Offline & PWA Subsystem",
      icon: Smartphone,
      tech: "Service Worker v4 & IndexedDB",
      description: "Offline mutation queue with bounded exponential backoff retries, multi-tenant storage partitioning, and conflict quarantine."
    },
    {
      category: "AI & Intelligence",
      icon: Cpu,
      tech: "Multi-Model AI Gateway",
      description: "Fault-tolerant inference gateway orchestrating Google Gemini 2.5 and Groq fallbacks with strict token budgets per institution."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <PublicNavbar />

      <main className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-20">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Cpu size={14} />
            <span>Architecture & Infrastructure</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tight">
            Engineered for Resilience & Scale
          </h1>
          <p className="text-slate-400 text-base sm:text-lg leading-relaxed">
            A breakdown of the modern, fault-tolerant technology stack powering EducationOS across low-bandwidth mobile networks and desktop browsers.
          </p>
        </div>

        {/* Stack Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stack.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                    <Icon size={24} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2.5 py-1 rounded-full bg-slate-800">
                    {item.category}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white">{item.tech}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

