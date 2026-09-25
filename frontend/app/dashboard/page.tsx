"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/providers";
import { safeFetch } from "@/lib/apiClient";
import { 
  Users, CheckCircle2, XCircle, GraduationCap, ShieldCheck, 
  ArrowUpRight, Fingerprint, BookOpen, Trophy, Plus, 
  Sparkles, Wallet, Clock, Bot, FileText, Check
} from "lucide-react";

export default function DashboardOverviewPage() {
  const router = useRouter();
  const { language } = useLanguage();
  
  const [userRole, setUserRole] = useState<string>("admin");
  const [userName, setUserName] = useState<string>("User");
  const [metrics, setMetrics] = useState({
    total_students: 0,
    present_today: 0,
    absent_today: 0,
    total_teachers: 0,
    pending_approvals: 0
  });
  const [kpiData, setKpiData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    const role = (localStorage.getItem("user_role") || "admin").toLowerCase();
    const name = localStorage.getItem("user_name") || "User";
    setUserRole(role);
    setUserName(name);

    const fetchOverviewData = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // 🚀 safeFetch ব্যবহার করা হলো, যা অফলাইনে ক্যাশ থেকে ডেটা তুলে আনবে (কোনো ক্র্যাশ বা এরর নেই)
        const [metRes, kpiRes] = await Promise.all([
          safeFetch<any>("http://127.0.0.1:8000/api/v1/dashboard/metrics", { headers }),
          safeFetch<any>("http://127.0.0.1:8000/api/v1/dashboard/operational-kpi", { headers })
        ]);

        if (metRes.data) setMetrics(metRes.data);
        if (kpiRes.data) setKpiData(kpiRes.data);

        if (metRes.isOffline || kpiRes.isOffline) {
          setIsOfflineMode(true);
        }
      } catch (err) {
        console.error("Dashboard overview fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverviewData();
  }, []);


  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Offline Mode Indicator Banner */}
      {isOfflineMode && (
        <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 font-medium">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span> অফলাইন মোড সক্রিয়: সর্বশেষ ক্যাশ করা ডেটা দেখানো হচ্ছে</span>
          </div>
          <span className="font-mono text-[10px] bg-amber-500/20 px-2 py-0.5 rounded">Cached Session</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TEACHER VIEW                                                           */}
      {/* ========================================================================= */}
      {userRole === "teacher" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Class Students</span>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">{metrics.total_students}</div>
              <p className="text-[11px] text-gray-500 mt-1">Enrolled In Your Sections</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Present Today</span>
              <div className="text-3xl font-black text-green-600 dark:text-green-400 mt-1">{metrics.present_today}</div>
              <p className="text-[11px] text-gray-500 mt-1">Marked Present In Morning Roll</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Absent Today</span>
              <div className="text-3xl font-black text-red-600 dark:text-red-400 mt-1">{metrics.absent_today}</div>
              <p className="text-[11px] text-gray-500 mt-1">Follow-up via WhatsApp Hub</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Daily Teaching Status</span>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-1.5">
                <Check size={20} /> Active On Duty
              </div>
              <p className="text-[11px] text-gray-500 mt-1">NCTB Curriculum Stream</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Teacher Classroom Command Center</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/attendance" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all group shadow-sm">
                <Fingerprint className="text-blue-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Take Attendance</h4>
                <p className="text-xs text-gray-500 mt-1">1-Click digital roll call & absence alert</p>
              </Link>

              <Link href="/dashboard/results" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-amber-500/50 transition-all group shadow-sm">
                <Trophy className="text-amber-500 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Results & Grading</h4>
                <p className="text-xs text-gray-500 mt-1">Record term marks & compute NCTB GPA</p>
              </Link>

              <Link href="/dashboard/exams" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all group shadow-sm">
                <BookOpen className="text-purple-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Question Paper AI</h4>
                <p className="text-xs text-gray-500 mt-1">Draft & print exam papers in 2 minutes</p>
              </Link>

              <Link href="/dashboard/academic" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all group shadow-sm">
                <Clock className="text-green-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Class Timetable</h4>
                <p className="text-xs text-gray-500 mt-1">Today's assigned periods and room schedule</p>
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. STUDENT VIEW                                                           */}
      {/* ========================================================================= */}
      {userRole === "student" && (
        <>
          <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent border border-blue-200 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-purple-400">
                  Student Digital Twin Workspace
                </span>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white mt-1">
                  Welcome to Study Room, {userName}!
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Access live NCTB lecture sheets, check your term rankings, and review exam progress cards.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                  Session 2026
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200/50 dark:border-white/5">
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Attendance Rate</span>
                <div className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">96.4%</div>
                <span className="text-[10px] text-gray-500">Regular attendance</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Term GPA</span>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">5.00 (A+)</div>
                <span className="text-[10px] text-gray-500">Highest standing</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">Today's Periods</span>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">5 Classes</div>
                <span className="text-[10px] text-gray-500">09:00 AM - 01:30 PM</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block uppercase font-bold">AI Companion</span>
                <div className="text-xl font-bold text-amber-500 mt-0.5">Active 24/7</div>
                <span className="text-[10px] text-gray-500">Press ⌘K to ask</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/dashboard/results" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all shadow-sm group">
              <Trophy className="text-blue-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Academic Marksheet & Ranking</h4>
              <p className="text-xs text-gray-500 mt-1">Download official A4 progress card and competency report</p>
            </Link>

            <Link href="/dashboard/academic" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all shadow-sm group">
              <Clock className="text-purple-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Daily Class Routine</h4>
              <p className="text-xs text-gray-500 mt-1">View periods, subject breakdown, and room timetable</p>
            </Link>

            <Link href="/dashboard/notices" className="p-6 rounded-3xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all shadow-sm group">
              <FileText className="text-green-600 mb-3 group-hover:scale-110 transition-transform" size={24} />
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Official Notice Board</h4>
              <p className="text-xs text-gray-500 mt-1">Institutional memos, exam schedules, and holiday bulletins</p>
            </Link>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. ADMIN / PRINCIPAL VIEW                                                 */}
      {/* ========================================================================= */}
      {userRole === "admin" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Students</span>
              <div className="text-3xl font-black text-gray-900 dark:text-white mt-1">{metrics.total_students}</div>
              <p className="text-[11px] text-gray-500 mt-1">Active Enrollment Base</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-green-500">Present Today</span>
              <div className="text-3xl font-black text-green-600 dark:text-green-400 mt-1">{metrics.present_today}</div>
              <p className="text-[11px] text-gray-500 mt-1">Daily Biometric & App Ingestion</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Absent</span>
              <div className="text-3xl font-black text-red-600 dark:text-red-400 mt-1">{metrics.absent_today}</div>
              <p className="text-[11px] text-gray-500 mt-1">Automated WhatsApp Alert Ready</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Active Faculty</span>
              <div className="text-3xl font-black text-purple-600 dark:text-purple-400 mt-1">{metrics.total_teachers}</div>
              <p className="text-[11px] text-gray-500 mt-1">Educators On Duty</p>
            </div>

            <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 p-5 rounded-3xl shadow-sm">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Action Center</span>
              <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{metrics.pending_approvals}</div>
              <p className="text-[11px] text-gray-500 mt-1">L2 Approvals Pending</p>
            </div>
          </div>

          {kpiData && (
            <div className="bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-transparent border border-blue-200 dark:border-white/10 rounded-3xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-purple-400">
                    Phase 12 Operational Metric • SchoolOS Efficiency Engine
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1">
                    {kpiData.total_hours_saved} Hours Saved This Session
                  </h2>
                  <p className="text-xs text-gray-500 mt-1 max-w-xl">
                    Cumulative staff time saved across digital attendance, AI question blueprints, instant NCTB grading, and multi-channel notices.
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 rounded-2xl text-center min-w-[130px]">
                  <span className="text-[10px] text-gray-400 font-bold block uppercase">Paperless Savings</span>
                  <span className="text-lg font-mono font-bold text-green-600 dark:text-green-400">
                    ৳{kpiData.estimated_cost_saved_bdt.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Direct Administrative Pipelines</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link href="/dashboard/students" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-blue-500/50 transition-all shadow-sm">
                <Plus className="text-blue-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">New Admission</h4>
                <p className="text-xs text-gray-500 mt-1">Onboard student & print official slip</p>
              </Link>

              <Link href="/dashboard/finance" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-green-500/50 transition-all shadow-sm">
                <Wallet className="text-green-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Fee Ledger</h4>
                <p className="text-xs text-gray-500 mt-1">Collect tuition fee (Cash/bKash/Crypto)</p>
              </Link>

              <Link href="/dashboard/approvals" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-amber-500/50 transition-all shadow-sm">
                <ShieldCheck className="text-amber-500 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Action Center</h4>
                <p className="text-xs text-gray-500 mt-1">Review AI guardrails & approvals</p>
              </Link>

              <Link href="/dashboard/communication" className="p-5 rounded-2xl bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/10 hover:border-purple-500/50 transition-all shadow-sm">
                <Users className="text-purple-600 mb-3" size={24} />
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">Guardian Inbox</h4>
                <p className="text-xs text-gray-500 mt-1">WhatsApp & SMS triage queue</p>
              </Link>
            </div>
          </div>
        </>
      )}

    </div>
  );
}