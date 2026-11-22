"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, FileCheck, AlertTriangle, Building2, UploadCloud, Loader2, Sparkles } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { fetchWithTenant } from "@/lib/api-client";

export default function GovernmentCopilotPage() {
  const { language } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetchWithTenant("/api/v1/government/ipemis/readiness");
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleGeneratePayload = () => {
    setGenerating(true);
    setTimeout(() => setGenerating(false), 2000);
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-teal-500" size={32} /></div>;
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-500">
        <AlertTriangle className="text-red-500" size={48} />
        <p className="text-gray-500 dark:text-gray-400">Failed to load Gov Copilot data. Please ensure the backend is running.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
            <Building2 className="text-teal-600 dark:text-teal-400" />
            {language === "EN" ? "Government Data Copilot" : "গভর্নমেন্ট ডেটা কো-পাইলট"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {language === "EN" ? "Seamless mapping and validation for IPEMIS and Education Board systems." : "IPEMIS এবং এডুকেশন বোর্ডের জন্য ডেটা ম্যাপিং এবং ভ্যালিডেশন।"}
          </p>
        </div>
        
        <button 
          onClick={handleGeneratePayload}
          disabled={generating || data?.overall_readiness < 100}
          className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 shadow-sm border border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
          {language === "EN" ? "Generate Official Payload" : "অফিসিয়াল পেলোড তৈরি করুন"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Readiness Overview */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#0f0f11] rounded-3xl p-8 border border-gray-200 dark:border-white/[0.08] shadow-sm flex flex-col items-center text-center">
            <div className="w-32 h-32 rounded-full border-8 flex items-center justify-center mb-4 transition-all border-teal-500/20 dark:border-teal-500/30 relative">
              <div className="absolute inset-0 rounded-full border-8 border-teal-500" style={{ clipPath: `inset(${100 - data.overall_readiness}% 0 0 0)` }}></div>
              <span className="text-3xl font-bold text-gray-900 dark:text-white">{data.overall_readiness}%</span>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IPEMIS Readiness</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {data.overall_readiness === 100 ? "Ready for submission!" : "Some fields require attention before final generation."}
            </p>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/20 dark:to-transparent border border-teal-100 dark:border-teal-500/20 rounded-3xl p-6 relative overflow-hidden">
            <Sparkles className="absolute top-4 right-4 text-teal-500/30" size={48} />
            <h3 className="font-semibold text-teal-900 dark:text-teal-300 flex items-center gap-2 mb-2">
              <ShieldCheck size={18} /> AI Mapper Status
            </h3>
            <p className="text-sm text-teal-800 dark:text-teal-100/70 leading-relaxed relative z-10">
              {data.ai_recommendation}
            </p>
          </div>
        </div>

        {/* Details Checklist */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-[#0f0f11] rounded-3xl border border-gray-200 dark:border-white/[0.08] shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {language === "EN" ? "Annual Statistics Validator (2025-26)" : "বার্ষিক পরিসংখ্যান যাচাইকরণ (২০২৫-২৬)"}
              </h3>
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {data.insights.map((insight: any, idx: number) => (
                <div key={idx} className="p-6 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                  
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl border ${insight.missing_fields === 0 ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-600 dark:text-green-400" : "bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20 text-orange-600 dark:text-orange-400"}`}>
                      {insight.missing_fields === 0 ? <FileCheck size={20} /> : <AlertTriangle size={20} />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{insight.category}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {insight.verified_records} of {insight.total_records} records verified
                      </p>
                    </div>
                  </div>

                  {insight.missing_fields > 0 ? (
                    <div className="text-left sm:text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300 uppercase tracking-wider">
                        {insight.missing_fields} Needs Attention
                      </span>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{insight.action_required}</p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300 uppercase tracking-wider">
                      Verified
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}