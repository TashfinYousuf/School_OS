// frontend/app/offline/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, ArrowLeft, ShieldCheck } from "lucide-react";

export default function OfflineFallbackPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOnlineStatus(navigator.onLine);
      const handleOnline = () => setOnlineStatus(true);
      const handleOffline = () => setOnlineStatus(false);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const handleRetry = () => {
    setIsChecking(true);
    if (typeof window !== "undefined") {
      if (navigator.onLine) {
        window.location.reload();
      } else {
        setTimeout(() => {
          setIsChecking(false);
        }, 800);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6 text-amber-400">
        <WifiOff className="w-10 h-10 animate-pulse" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">
        ইন্টারনেট সংযোগ বিচ্ছিন্ন (Offline Mode)
      </h1>
      
      <p className="text-zinc-400 max-w-md text-sm sm:text-base mb-6 leading-relaxed">
        EducationOS বর্তমানে অফলাইন মোডে চলছে। আপনার পূর্বে সংরক্ষিত ক্লাসরুম রুটিন ও অফলাইন হাজিরা নিরাপদে আপনার ডিভাইসে সংরক্ষিত রয়েছে।
      </p>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 max-w-md w-full mb-8 text-left text-xs text-zinc-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-zinc-200">অফলাইন নিরাপত্তা গ্যারান্টি:</span>
          <p className="mt-1">
            আপনার অফলাইন ডেটা লোকাল ডিভাইসে সুরক্ষিত আছে। ইন্টারনেট সংযোগ পুনঃস্থাপিত হলে ব্যাকগ্রাউন্ডে স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হয়ে যাবে।
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-xs">
        <button
          onClick={handleRetry}
          disabled={isChecking}
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isChecking ? "animate-spin" : ""}`} />
          {isChecking ? "পরীক্ষা করা হচ্ছে..." : "পুনরায় চেষ্টা করুন"}
        </button>

        <Link
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          ড্যাশবোর্ডে ফিরুন
        </Link>
      </div>
    </div>
  );
}

