"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/providers";
import { 
  Users, UserCheck, UserX, GraduationCap, 
  Clock, Plus, FileText, CheckSquare, MessageSquare, AlertCircle, Loader2 
} from "lucide-react";

interface DashboardMetrics {
  total_students: number;
  present_today: number;
  absent_today: number;
  total_teachers: number;
  pending_approvals: number;
  system_status: string;
}

export default function DailyOperationsDashboard() {
  const { language } = useLanguage();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://127.0.0.1:8000/api/v1/dashboard/metrics", {
          headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
          }
        });
        
        if (!res.ok) {
          throw new Error("Failed to load real-time school metrics");
        }
        
        const data = await res.json();
        setMetrics(data);
      } catch (err: any) {
        setError(err.message || "Failed to communicate with school server");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        <Loader2 className="animate-spin text-blue-600 dark:text-purple-400" size={32} />
        <p className="text-sm font-medium">Syncing school records...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-center gap-4 text-red-700 dark:text-red-400">
        <AlertCircle size={24} />
        <div>
          <h3 className="font-semibold">Live Operational Engine Disconnected</h3>
          <p className="text-sm">{error || "Could not retrieve live database statistics."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {language === "EN" ? "Today's School Operations" : "আজকের প্রাতিষ্ঠানিক কার্যক্রম"}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kids Shine International School • {new Date().toLocaleDateString(language === "EN" ? "en-US" : "bn-BD", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 text-xs font-semibold text-green-700 dark:text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          {metrics.system_status}
        </div>
      </div>

      {/* Core Real Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        
        <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{language === "EN" ? "Students" : "শিক্ষার্থী"}</span>
            <Users size={16} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.total_students}</div>
          <p className="text-[11px] text-gray-400 mt-1">{language === "EN" ? "Enrolled Base" : "মোট নথিভুক্ত"}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-green-600 dark:text-green-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{language === "EN" ? "Present" : "উপস্থিত"}</span>
            <UserCheck size={16} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.present_today}</div>
          <p className="text-[11px] text-gray-400 mt-1">{language === "EN" ? "Today's Check-ins" : "আজকে উপস্থিত"}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-red-600 dark:text-red-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{language === "EN" ? "Absent" : "অনুপস্থিত"}</span>
            <UserX size={16} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.absent_today}</div>
          <p className="text-[11px] text-gray-400 mt-1">{language === "EN" ? "Requires Follow-up" : "অনুপস্থিত আজ"}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{language === "EN" ? "Teachers" : "শিক্ষক"}</span>
            <GraduationCap size={16} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.total_teachers}</div>
          <p className="text-[11px] text-gray-400 mt-1">{language === "EN" ? "Active Educators" : "সক্রিয় শিক্ষক"}</p>
        </div>

        <div className="p-5 bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between text-orange-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{language === "EN" ? "Approvals" : "অনুমোদন"}</span>
            <Clock size={16} />
          </div>
          <div className="text-3xl font-extrabold text-gray-900 dark:text-white">{metrics.pending_approvals}</div>
          <p className="text-[11px] text-gray-400 mt-1">{language === "EN" ? "Action Center Queue" : "অপেক্ষমাণ কাজ"}</p>
        </div>

      </div>

      {/* Quick Actions (Core Operations) */}
      <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] rounded-3xl p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">
          {language === "EN" ? "⚡ Direct Operational Shortcuts" : "⚡ দৈনন্দিন অপারেশনাল শর্টকাট"}
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link href="/dashboard/students" className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-purple-500 transition-colors flex flex-col gap-2 group">
            <Plus className="text-blue-600 dark:text-purple-400 group-hover:scale-110 transition-transform" size={20} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{language === "EN" ? "New Admission" : "নতুন ভর্তি"}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Add student & link guardian</span>
          </Link>

          <Link href="/dashboard/attendance" className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-purple-500 transition-colors flex flex-col gap-2 group">
            <CheckSquare className="text-green-600 group-hover:scale-110 transition-transform" size={20} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{language === "EN" ? "Take Attendance" : "হাজিরা গ্রহণ"}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Class ledger replacement</span>
          </Link>

          <Link href="/dashboard/approvals" className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-purple-500 transition-colors flex flex-col gap-2 group">
            <FileText className="text-orange-500 group-hover:scale-110 transition-transform" size={20} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{language === "EN" ? "Action Center" : "অ্যাকশন সেন্টার"}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{metrics.pending_approvals} tasks awaiting review</span>
          </Link>

          <Link href="/dashboard/communication" className="p-4 rounded-2xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-purple-500 transition-colors flex flex-col gap-2 group">
            <MessageSquare className="text-teal-500 group-hover:scale-110 transition-transform" size={20} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{language === "EN" ? "Guardian Inbox" : "অভিভাবক ইনবক্স"}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">View & reply to queries</span>
          </Link>
        </div>
      </div>

    </div>
  );
}