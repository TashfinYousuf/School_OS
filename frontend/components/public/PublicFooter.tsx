"use client";

import React from "react";
import Link from "next/link";
import { School, ShieldCheck, ExternalLink, Heart } from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function PublicFooter() {
  const { t } = useLanguage();

  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-16">
          {/* Col 1: Brand Info */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <School className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl text-white tracking-tight">
                Education<span className="text-indigo-400">OS</span>
              </span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              The autonomous education operating system built for high-performing schools, colleges, and coaching academies in Bangladesh and emerging markets.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>PostgreSQL RLS Protected • Zero Third-Party Tracking</span>
            </div>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Solutions</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/solutions/schools" className="hover:text-indigo-400 transition-colors">
                  K-12 Schools
                </Link>
              </li>
              <li>
                <Link href="/solutions/colleges" className="hover:text-indigo-400 transition-colors">
                  Colleges & Higher Sec.
                </Link>
              </li>
              <li>
                <Link href="/solutions/academies" className="hover:text-indigo-400 transition-colors">
                  Coaching Academies
                </Link>
              </li>
              <li>
                <Link href="/solutions" className="hover:text-indigo-400 transition-colors">
                  All Solutions
                </Link>
              </li>
              <li>
                <Link href="/features" className="hover:text-indigo-400 transition-colors">
                  Module Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform & Docs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Platform</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/pricing" className="hover:text-indigo-400 transition-colors">
                  Pricing & ROI Calculator
                </Link>
              </li>
              <li>
                <Link href="/technology" className="hover:text-indigo-400 transition-colors">
                  Architecture & Offline
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-indigo-400 transition-colors">
                  AEGIS-X Security
                </Link>
              </li>
              <li>
                <Link href="/docs" className="hover:text-indigo-400 transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-indigo-400 transition-colors">
                  Help Center & FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Trust */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Legal & Trust</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/legal/privacy" className="hover:text-indigo-400 transition-colors">
                  Privacy Policy <span className="text-[10px] text-amber-400 font-mono">(Draft)</span>
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="hover:text-indigo-400 transition-colors">
                  Terms of Service <span className="text-[10px] text-amber-400 font-mono">(Draft)</span>
                </Link>
              </li>
              <li>
                <Link href="/legal/refund" className="hover:text-indigo-400 transition-colors">
                  Refund Policy <span className="text-[10px] text-amber-400 font-mono">(Draft)</span>
                </Link>
              </li>
              <li>
                <Link href="/legal/cancellation" className="hover:text-indigo-400 transition-colors">
                  Cancellation Terms <span className="text-[10px] text-amber-400 font-mono">(Draft)</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-indigo-400 transition-colors">
                  Contact & Campus Demo
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Regulatory & Institutional Reference Links Bar */}
        <div className="pt-8 pb-10 border-t border-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Official Curriculum & Education Standards Reference Links:
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
            <a
              href="https://moedu.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              <span>Ministry of Education (moedu.gov.bd)</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://dshe.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              <span>Directorate of Secondary & Higher Education (DSHE)</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://nctb.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              <span>National Curriculum & Textbook Board (NCTB)</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://banbeis.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              <span>BANBEIS Database Registry</span>
              <ExternalLink size={11} />
            </a>
            <a
              href="https://ipemis.dpe.gov.bd"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors"
            >
              <span>IPEMIS Primary System</span>
              <ExternalLink size={11} />
            </a>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 italic">
            Disclaimer: Official educational portal links are provided for regulatory curriculum reference. EducationOS is an independent technology platform and does not claim official government affiliation or endorsement.
          </p>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} EducationOS Technologies. {t("footer.rights")}</p>
          <div className="flex items-center gap-1">
            <span>Crafted with</span>
            <Heart size={12} className="text-rose-500 fill-rose-500" />
            <span>for high-performing educators.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

