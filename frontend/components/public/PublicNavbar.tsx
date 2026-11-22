"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  School, 
  Menu, 
  X, 
  ChevronDown, 
  ShieldCheck, 
  Cpu, 
  BookOpen, 
  Building2, 
  GraduationCap, 
  Sparkles,
  Languages
} from "lucide-react";
import { useLanguage } from "@/components/providers";

export default function PublicNavbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsOpen(false);
    setSolutionsOpen(false);
  }, [pathname]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-slate-950/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/40"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg p-1"
            aria-label="EducationOS Homepage"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <School className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl tracking-tight text-white flex items-center gap-1.5">
                Education<span className="text-indigo-400">OS</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  Enterprise
                </span>
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
            {/* Solutions Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSolutionsOpen(!solutionsOpen)}
                onBlur={() => setTimeout(() => setSolutionsOpen(false), 200)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-expanded={solutionsOpen}
                aria-haspopup="true"
              >
                <span>{t("nav.solutions")}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${solutionsOpen ? "rotate-180" : ""}`}
                />
              </button>

              {solutionsOpen && (
                <div className="absolute top-full left-0 w-72 mt-2 p-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95">
                  <Link
                    href="/solutions/schools"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500/20">
                      <School size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t("nav.schools")}</div>
                      <div className="text-xs text-slate-400">K-12 formal schools, routines & NCTB grading</div>
                    </div>
                  </Link>

                  <Link
                    href="/solutions/colleges"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                      <Building2 size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t("nav.colleges")}</div>
                      <div className="text-xs text-slate-400">Intermediate & higher secondary campuses</div>
                    </div>
                  </Link>

                  <Link
                    href="/solutions/academies"
                    className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                      <GraduationCap size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{t("nav.academies")}</div>
                      <div className="text-xs text-slate-400">Batches, model tests & negative marking</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/features"
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/features"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("nav.features")}
            </Link>

            <Link
              href="/pricing"
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/pricing"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("nav.pricing")}
            </Link>

            <Link
              href="/technology"
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/technology"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("nav.technology")}
            </Link>

            <Link
              href="/security"
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/security"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("nav.security")}
            </Link>

            <Link
              href="/docs"
              className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/docs"
                  ? "text-indigo-400 bg-indigo-500/10"
                  : "text-slate-300 hover:text-white hover:bg-white/5"
              }`}
            >
              {t("nav.docs")}
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-900 border border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label={`Switch language to ${language === "EN" ? "Bangla" : "English"}`}
            >
              <Languages size={13} className="text-indigo-400" />
              <span>{language === "EN" ? "বাংলা" : "EN"}</span>
            </button>

            {/* Login Link */}
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-slate-200 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              {t("nav.login")}
            </Link>

            {/* Start Trial CTA */}
            <Link
              href="/onboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-md shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={14} className="text-indigo-200" />
              <span>{t("nav.getStarted")}</span>
            </Link>
          </div>

          {/* Mobile Menu Hamburger Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={toggleLanguage}
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-900 border border-slate-700 text-slate-300"
              aria-label="Toggle language"
            >
              {language === "EN" ? "বাংলা" : "EN"}
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-expanded={isOpen}
              aria-label="Toggle mobile menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="lg:hidden bg-slate-950/95 border-b border-slate-800 px-4 pt-3 pb-6 space-y-3 backdrop-blur-xl animate-in slide-in-from-top-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 py-1">
              {t("nav.solutions")}
            </div>
            <Link
              href="/solutions/schools"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.schools")}
            </Link>
            <Link
              href="/solutions/colleges"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.colleges")}
            </Link>
            <Link
              href="/solutions/academies"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.academies")}
            </Link>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-1">
            <Link
              href="/features"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.features")}
            </Link>
            <Link
              href="/pricing"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href="/technology"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.technology")}
            </Link>
            <Link
              href="/security"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.security")}
            </Link>
            <Link
              href="/docs"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.docs")}
            </Link>
            <Link
              href="/help"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.help")}
            </Link>
            <Link
              href="/contact"
              className="block px-3 py-2 text-base font-medium text-slate-200 hover:bg-white/5 rounded-lg"
            >
              {t("nav.contact")}
            </Link>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-900 border border-slate-700"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/onboard"
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-blue-600"
            >
              {t("nav.getStarted")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

