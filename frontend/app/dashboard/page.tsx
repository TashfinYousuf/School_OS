"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/providers";
import { Users, GraduationCap, TrendingUp, Sparkles, AlertTriangle, ArrowRight, Activity, Loader2 } from "lucide-react";

export default function DashboardOverview() {
  const { language } = useLanguage();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://127.0.0.1:8000/api/v1/analytics/overview", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) setStats(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32} /></div>;
  }

  // Safety check to prevent white screen
  if (!stats) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <AlertTriangle size={48} className="text-red-500 mb-4 opacity-50" />
        <p>Analytics Engine Offline. Check backend connection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 blur-[80px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2">
            {language === "EN" ? "Welcome to the Future of Education." : "শিক্ষার ভবিষ্যতে স্বাগতম।"}
          </h1>
          <p className="text-blue-100 text-lg mb-8">
            {language === "EN" ? "Your AI Operating System is actively monitoring campus operations." : "আপনার এআই অপারেটিং সিস্টেম সক্রিয়ভাবে ক্যাম্পাস পর্যবেক্ষণ করছে।"}
          </p>
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-sm font-mono font-semibold">
            <span className="flex w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Tenant ID: kidsshine
          </div>
        </div>
      </div>

      {/* Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl"><Users className="text-blue-600 dark:text-blue-400" size={20} /></div>
            <span className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-500/10 px-2 py-1 rounded-lg"><TrendingUp size={12} /> +12%</span>
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === "EN" ? "Total Enrolled" : "মোট শিক্ষার্থী"}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.total_students}</h3>
        </div>

        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 rounded-xl"><GraduationCap className="text-purple-600 dark:text-purple-400" size={20} /></div>
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === "EN" ? "Active Educators" : "সক্রিয় শিক্ষক"}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.total_teachers}</h3>
        </div>

        <div className="bg-white dark:bg-[#0f0f11] border border-gray-200 dark:border-white/[0.08] p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-teal-50 dark:bg-teal-500/10 rounded-xl"><Activity className="text-teal-600 dark:text-teal-400" size={20} /></div>
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{language === "EN" ? "Campus Attendance" : "ক্যাম্পাস উপস্থিতি"}</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.attendance_rate}%</h3>
        </div>
      </div>

      {/* AI Predictive Analytics Card */}
      <div className="bg-gradient-to-br from-purple-50 to-white dark:from-[#150c25] dark:to-[#0f0f11] border border-purple-200 dark:border-purple-500/20 rounded-3xl p-8 relative overflow-hidden shadow-sm">
        <Sparkles className="absolute top-6 right-6 text-purple-500/20 animate-pulse" size={64} />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider text-xs mb-3">
              <BrainCircuitIcon /> Predictive Intelligence
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-snug">
              {stats.predictive_insight}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              Recommended Action: {stats.action_required}
            </p>
          </div>
          
          <button className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition-all shadow-md shadow-purple-500/20 flex items-center gap-2">
            Execute Strategy <ArrowRight size={18} />
          </button>
        </div>
      </div>

    </div>
  );
}

// Inline Icon Helper
function BrainCircuitIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3 2.5 2.5 0 0 0-1.32 4.24 3 3 0 0 0 .34 5.58 2.5 2.5 0 0 0 2.96 3.08 2.5 2.5 0 0 0 4.91.05L12 20V4.5Z"/><path d="M16 8V5c0-1.1.9-2 2-2"/><path d="M12 13h4"/><path d="M12 18h6a2 2 0 0 1 2 2v1"/><path d="M22 5h-4"/><path d="M22 9h-4"/><path d="M22 14h-4"/></svg>
  )
}