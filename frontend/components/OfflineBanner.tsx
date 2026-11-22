"use client";

import React, { useEffect, useState, useCallback } from "react";
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/components/providers";
import { fetchWithTenant } from "@/lib/api-client";
import { flushOfflineAttendanceQueue, getOfflineAttendanceQueue } from "@/lib/offlineQueue";

export default function OfflineBanner() {
  const { language } = useLanguage();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Helper to count all pending offline submissions across storage keys
  const updatePendingCount = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      const v2Queue = await getOfflineAttendanceQueue();
      const legacyRaw = localStorage.getItem("offline_attendance_queue");
      const legacyQueue = legacyRaw ? JSON.parse(legacyRaw) : [];
      setPendingCount((Array.isArray(v2Queue) ? v2Queue.length : 0) + (Array.isArray(legacyQueue) ? legacyQueue.length : 0));
    } catch {
      setPendingCount(0);
    }
  }, []);

  // Sync logic for flushing offline records to cloud
  const handleSyncAll = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      let totalSynced = 0;

      // 1. Flush v2 Attendance Queue
      const v2Synced = await flushOfflineAttendanceQueue();
      totalSynced += v2Synced;

      // 2. Flush legacy attendance queue if present
      const legacyRaw = localStorage.getItem("offline_attendance_queue");
      if (legacyRaw) {
        const legacyQueue = JSON.parse(legacyRaw);
        if (Array.isArray(legacyQueue) && legacyQueue.length > 0) {
          for (const item of legacyQueue) {
            try {
              const res = await fetchWithTenant("/api/v1/attendance/sync-offline", {
                method: "POST",
                body: JSON.stringify(item),
              });
              if (res.ok) totalSynced++;
            } catch (err) {
              console.warn("Failed syncing item from legacy queue", err);
            }
          }
          localStorage.removeItem("offline_attendance_queue");
        }
      }

      updatePendingCount();
      window.dispatchEvent(new Event("offline-queue-updated"));

      const successText =
        language === "EN"
          ? totalSynced > 0
            ? `Successfully synced ${totalSynced} offline record(s) to cloud database.`
            : "All offline records are in sync with cloud."
          : totalSynced > 0
          ? `${totalSynced}টি অফলাইন রেকর্ড ক্লাউড ডেটাবেসে সফলভাবে সিঙ্ক হয়েছে।`
          : "সব অফলাইন রেকর্ড ক্লাউডের সাথে হালনাগাদ রয়েছে।";

      setSyncSuccessMsg(successText);
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Auto-sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, language, updatePendingCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Set initial online status
    setIsOnline(navigator.onLine);
    updatePendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-trigger sync when reconnection occurs
      handleSyncAll();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updatePendingCount();
    };

    const handleQueueChange = () => {
      updatePendingCount();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-updated", handleQueueChange);

    // Periodic check every 10 seconds for storage changes
    const interval = setInterval(() => {
      updatePendingCount();
      if (navigator.onLine !== isOnline) {
        setIsOnline(navigator.onLine);
      }
    }, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-updated", handleQueueChange);
      clearInterval(interval);
    };
  }, [handleSyncAll, isOnline, updatePendingCount]);

  // If online, no pending items and no success message, keep banner unmounted
  if (isOnline && pendingCount === 0 && !syncSuccessMsg && !isSyncing) {
    return null;
  }

  // 1. Just synced message banner (Green)
  if (isOnline && syncSuccessMsg) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="w-full bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-800 dark:text-emerald-200 px-4 py-2.5 flex items-center justify-between text-xs font-medium z-30 transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{syncSuccessMsg}</span>
        </div>
      </div>
    );
  }

  // 2. Currently syncing banner (Blue)
  if (isOnline && isSyncing) {
    return (
      <div 
        role="status"
        aria-live="polite"
        className="w-full bg-blue-500/15 border-b border-blue-500/30 text-blue-800 dark:text-blue-200 px-4 py-2.5 flex items-center justify-between text-xs font-medium z-30 transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
          <span>
            {language === "EN"
              ? "Reconnected to Internet. Syncing offline records to cloud database..."
              : "ইন্টারনেট পুনঃসংযুক্ত হয়েছে। অফলাইন রেকর্ড ক্লাউড ডেটাবেসে সিঙ্ক হচ্ছে..."}
          </span>
        </div>
      </div>
    );
  }

  // 3. Online with unsynced pending records (Amber prompt)
  if (isOnline && pendingCount > 0) {
    return (
      <div 
        role="alert"
        className="w-full bg-amber-500/15 border-b border-amber-500/30 text-amber-800 dark:text-amber-200 px-4 py-2.5 flex items-center justify-between text-xs font-medium z-30 transition-all duration-300"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            {language === "EN"
              ? `You have ${pendingCount} pending offline record(s) ready to sync.`
              : `আপনার কাছে ${pendingCount}টি অফলাইন রেকর্ড ক্লাউডে পাঠানোর অপেক্ষায় আছে।`}
          </span>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          <span>{language === "EN" ? "Sync Now" : "এখনই সিঙ্ক করুন"}</span>
        </button>
      </div>
    );
  }

  // 4. Offline Banner (Amber warning banner)
  return (
    <div 
      role="alert"
      className="w-full bg-amber-500/20 border-b border-amber-500/40 text-amber-900 dark:text-amber-100 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-medium z-30 shadow-sm transition-all duration-300"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <div>
          <span className="font-bold">
            {language === "EN" ? "Offline Mode Active" : "অফলাইন মোড সক্রিয়"}
          </span>
          <span className="mx-2 text-amber-500 dark:text-amber-400">•</span>
          <span className="text-amber-800 dark:text-amber-200 font-normal">
            {language === "EN"
              ? "Viewing cached data. New submissions will queue locally and auto-sync when connection restores."
              : "সংরক্ষিত ক্যাশ ডেটা দেখানো হচ্ছে। নতুন এন্ট্রি অফলাইনে জমা থাকবে এবং ইন্টারনেট পেলে অটো সিঙ্ক হবে।"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {pendingCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-semibold border border-amber-300/60 dark:border-amber-700/60">
            {language === "EN"
              ? `${pendingCount} Queued`
              : `${pendingCount}টি অফলাইন অপেক্ষমাণ`}
          </span>
        )}
      </div>
    </div>
  );
}

