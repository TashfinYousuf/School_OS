"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  Sparkles, 
  School, 
  ShieldCheck, 
  Database, 
  Cpu, 
  Zap, 
  CheckCircle2, 
  Clock, 
  FileSpreadsheet, 
  Smartphone, 
  Lock, 
  ChevronDown,
  ChevronUp,
  Layers,
  GraduationCap
} from "lucide-react";
import PublicNavbar from "@/components/public/PublicNavbar";
import PublicFooter from "@/components/public/PublicFooter";
import PersonaSelector from "@/components/public/PersonaSelector";
import PricingTable from "@/components/public/PricingTable";
import RoiCalculator from "@/components/public/RoiCalculator";
import PublicSupportAssistant from "@/components/public/PublicSupportAssistant";
import { useLanguage } from "@/components/providers";

export default function HomePage() {
  const { t, language } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: language === "EN" 
        ? "How does EducationOS enforce tenant data isolation between schools?" 
        : "এডুকেশন ওএস কীভাবে বিভিন্ন স্কুলের ডেটা আলাদা ও নিরাপদ রাখে?",
      a: language === "EN"
        ? "EducationOS implements PostgreSQL Row Level Security (RLS) directly at the database engine level. Every database query automatically applies tenant context. One school's administrators, teachers, or students can never query, read, or mutate another school's data."
        : "এডুকেশন ওএস ডাটাবেজ স্তরে পোস্টগ্রেসকুএল রো লেভেল সিকিউরিটি (RLS) প্রয়োগ করে। প্রতিটি কোয়েরিতে স্বয়ংক্রিয়ভাবে স্কুলের আইডি ভ্যালিডেট করা হয়। ফলে এক স্কুলের অ্যাডমিন, শিক্ষক বা শিক্ষার্থী কখনোই অন্য স্কুলের ডেটা দেখতে বা পরিবর্তন করতে পারে না।"
    },
    {
      q: language === "EN"
        ? "Does the system support Bangladesh NCTB curriculum grading rules?"
        : "সিস্টেমটি কি বাংলাদেশ এনসিটিবি কারিকুলাম ও গ্রেডিং নিয়ম সমর্থন করে?",
      a: language === "EN"
        ? "Yes. EducationOS includes a dedicated NCTB evaluation engine supporting official 7-tier letter grades (A+, A, A-, B, C, D, F), pass/fail mark boundaries, continuous assessment weightage, and instant generation of formatted A4 terminal report cards."
        : "হ্যাঁ। এডুকেশন ওএসে অফিসিয়াল এনসিটিবি ৭-স্তরের লেটার গ্রেড (A+, A, A-, B, C, D, F), পাস/ফেল সীমানা, ধারাবাহিক মূল্যায়ন (CA) এবং তাৎক্ষণিক এ৪ সাইজ টার্মিনাল প্রগ্রেস রিপোর্ট কার্ড প্রিন্ট করার পূর্ণ সুবিধা রয়েছে।"
    },
    {
      q: language === "EN"
        ? "Can teachers take attendance and record grades without internet connectivity?"
        : "শিক্ষকরা কি ইন্টারনেট সংযোগ ছাড়া হাজিরা ও মূল্যায়ন রেকর্ড করতে পারবেন?",
      a: language === "EN"
        ? "Yes. EducationOS is built as an offline-first Progressive Web App (PWA). Attendance records and teacher diary logs are safely stored in local browser storage (IndexedDB) and automatically synchronize when mobile or Wi-Fi connectivity is restored."
        : "হ্যাঁ। এডুকেশন ওএস একটি অফলাইন-ফার্স্ট প্রগ্রেসিভ ওয়েব অ্যাপ (PWA)। ইন্টারনেট না থাকলেও লোকাল স্টোরেজে (IndexedDB) হাজিরা ও শিক্ষক ডায়েরির তথ্য জমা থাকে এবং নেটওয়ার্ক পাওয়ার সাথে সাথে নিরাপদে ক্লাউডে সিঙ্ক হয়ে যায়।"
    },
    {
      q: language === "EN"
        ? "How does the negative marking system work for coaching model tests?"
        : "কোচিংয়ের মডেল টেস্টের জন্য নেগেটিভ মার্কিং কীভাবে কাজ করে?",
      a: language === "EN"
        ? "For coaching academies and university admission test batches, AcademyOS supports configurable negative marking (e.g., -0.25 marks per incorrect MCQ answer), instant percentile computation, and central merit ranking lists."
        : "কোচিং একাডেমি ও বিশ্ববিদ্যালয় ভর্তি পরীক্ষার ব্যাচের জন্য প্রতিটি ভুল উত্তরের বিপরীতে কাস্টমাইজযোগ্য নেগেটিভ মার্কিং (যেমন -০.২৫), তাৎক্ষণিক পার্সেন্টাইল হিসাব ও কেন্দ্রীয় মেধা তালিকা প্রকাশের ব্যবস্থা রয়েছে।"
    },
    {
      q: language === "EN"
        ? "Does EducationOS monetize or advertise against student or guardian data?"
        : "এডুকেশন ওএস কি শিক্ষার্থী বা অভিভাবকের ডেটা বিজ্ঞাপনে ব্যবহার করে?",
      a: language === "EN"
        ? "Never. EducationOS maintains a strict zero-third-party-monetization policy. Student, teacher, and guardian personal information is owned entirely by the institution. We never sell, license, or target ads using student records."
        : "কখনোই নয়। এডুকেশন ওএস কঠোরভাবে জিরো-মনিটাইজেশন নীতি অনুসরণ করে। শিক্ষার্থীর তথ্য, অভিভাবকের নম্বর এবং শিক্ষকদের রেকর্ড সম্পূর্ণভাবে প্রতিষ্ঠানের নিজস্ব সম্পত্তি। আমরা কখনোই কোনো তৃতীয় পক্ষের কাছে ডেটা বিক্রি বা বিজ্ঞাপন দিই না।"
    },
    {
      q: language === "EN"
        ? "Can an institution start with a free trial without adding payment details?"
        : "পেমেন্ট তথ্য ছাড়া কি প্রতিষ্ঠান ফ্রি ট্রায়াল শুরু করতে পারে?",
      a: language === "EN"
        ? "Yes. Every institution can activate a 14-day free trial on the Starter or Growth tier without providing a credit card or payment authorization. Institutional data remains preserved when upgrading to an active plan."
        : "হ্যাঁ। যেকোনো শিক্ষাপ্রতিষ্ঠান কোনো ক্রেডিট কার্ড বা পেমেন্ট ছাড়াই ১৪ দিনের পূর্ণ ফ্রি ট্রায়াল চালু করতে পারে। পেইড প্ল্যানে আপগ্রেড করার সময় প্রতিষ্ঠানের সমস্ত ডেটা অক্ষত ও সংরক্ষিত থাকে।"
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {/* Top Navigation */}
      <PublicNavbar />

      {/* ================= 1. HERO SECTION ================= */}
      <section className="relative pt-36 pb-20 md:pt-44 md:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-indigo-600/20 via-blue-600/15 to-purple-600/10 blur-[130px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-8 shadow-inner">
            <Sparkles size={14} className="text-indigo-400" />
            <span>{t("hero.badge")}</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.1]">
            The Operating System for{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Modern Education
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-slate-300 mb-10 max-w-3xl mx-auto leading-relaxed">
            {t("hero.subtitle")}
          </p>

          {/* Dual CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/onboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{t("hero.ctaTrial")}</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/solutions"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-slate-300 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>{t("hero.ctaExplore")}</span>
            </Link>
          </div>

          {/* Trust Badges Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto pt-6 border-t border-slate-900 text-xs font-medium text-slate-400">
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <span>{t("hero.trustCurriculum")}</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <ShieldCheck size={16} className="text-indigo-400" />
              <span>{t("hero.trustRls")}</span>
            </div>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-900/40 border border-slate-800/60">
              <Smartphone size={16} className="text-blue-400" />
              <span>{t("hero.trustOffline")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. PERSONA SELECTOR ================= */}
      <section id="solutions" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950/60 border-t border-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              {t("persona.title")}
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              {t("persona.subtitle")}
            </p>
          </div>

          <PersonaSelector />
        </div>
      </section>

      {/* ================= 3. CORE CAPABILITIES SHOWCASE ================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
              <Layers size={14} />
              <span>Unified Platform Capabilities</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-4">
              Everything Your Institution Needs
            </h2>
            <p className="text-slate-400 text-base max-w-2xl mx-auto">
              Built specifically to eliminate operational fragmentation across Bangladesh academic entities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <Clock size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Attendance & WhatsApp Alerts</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                1-tap digital roll call from mobile or tablet. Instantly dispatches automated arrival and absent notices to parents via WhatsApp or SMS.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <FileSpreadsheet size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Fee Ledgers & Cash Receipts</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Prevents cash leakages with double-entry accounting. Supports cash counter receipts, bKash payments, monthly installments, and waiver approvals.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                <GraduationCap size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">NCTB Evaluation & Report Cards</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Configurable GPA assessment strictly aligned with Bangladesh National Curriculum guidelines. Generates print-ready A4 terminal report cards.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                <Cpu size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">AI Voice-to-Diary Copilot</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Teachers speak their daily classroom progress in Bengali or English; AI parses topics, homework, and syllabus completion with Human-in-the-Loop review.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Zap size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">Live MCQ & Negative Marking</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                High-concurrency model tests for university admission coaching with -0.25 negative marking, instant percentiles, and central merit ranking lists.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 transition-colors space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <ShieldCheck size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">PostgreSQL RLS Security</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enterprise security with kernel-level Row Level Security. Guarantees zero cross-institution data leakage and immutable audit logging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 4. PRICING & ROI CALCULATOR SECTION ================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-950/40 border-t border-slate-900">
        <div className="max-w-7xl mx-auto space-y-20">
          <div className="text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-3">
              {t("pricing.title")}
            </h2>
            <p className="text-slate-400 text-base max-w-2xl mx-auto">
              {t("pricing.subtitle")}
            </p>
          </div>

          {/* Pricing Grid */}
          <PricingTable />

          <div className="text-center pt-2">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 text-indigo-400 hover:text-white hover:border-slate-700 text-sm font-semibold transition-all hover:scale-[1.02]"
            >
              <span>{language === "EN" ? "View Full Pricing Matrix, Add-ons & Capacity Breakdown" : "সম্পূর্ণ প্রাইসিং ম্যাট্রিক্স ও এড-অন তালিকা দেখুন"}</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {/* ROI Calculator */}
          <div className="pt-10">
            <RoiCalculator />
          </div>
        </div>
      </section>

      {/* ================= 5. FAQ SECTION ================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-3">
              {language === "EN" ? "Frequently Asked Questions" : "সাধারণ জিজ্ঞাসা ও প্রশ্নোত্তর"}
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              {language === "EN"
                ? "Clear answers regarding technology, data privacy, and institutional migration."
                : "প্রযুক্তি, ডেটা নিরাপত্তা ও প্রতিষ্ঠান পরিচালনা সম্পর্কিত প্রয়োজনীয় তথ্যাদি।"}
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    aria-expanded={isOpen}
                  >
                    <span className="text-base font-bold text-white">{faq.q}</span>
                    <span className="p-1 rounded-lg bg-slate-800 text-slate-300 shrink-0">
                      {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-slate-800/50 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= 6. FINAL CONVERSION CTA ================= */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950 border-t border-slate-900 text-center">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            {language === "EN" ? "Ready to Modernize Your Campus?" : "আপনার শিক্ষাপ্রতিষ্ঠানকে আধুনিক করতে প্রস্তুত?"}
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            {language === "EN"
              ? "Activate your 14-day institutional trial in under 15 minutes. Experience the security, speed, and intelligence of EducationOS."
              : "১৫ মিনিটের মধ্যেই আপনার প্রতিষ্ঠানের ১৪ দিনের ফ্রি ট্রায়াল চালু করুন। এডুকেশন ওএসের গতি, নিরাপত্তা ও এআই সুবিধার অভিজ্ঞতা নিন।"}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>{t("hero.ctaTrial")}</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-colors"
            >
              <span>{language === "EN" ? "Schedule Campus Demo" : "ক্যাম্পাস ডেমো শিডিউল করুন"}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Public Footer */}
      <PublicFooter />

      {/* Public Support AI Assistant Widget */}
      <PublicSupportAssistant />
    </div>
  );
}
