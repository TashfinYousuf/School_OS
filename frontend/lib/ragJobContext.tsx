// frontend/lib/ragJobContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { fetchWithTenant } from "./api-client";
import { X, RefreshCw, AlertTriangle, CheckCircle2, FileText, ChevronRight } from "lucide-react";
import Link from "next/link";

export interface RagJob {
  id: string;
  job_id: string;
  title: string;
  file_name?: string;
  status: "QUEUED" | "VALIDATING" | "PARSING" | "INDEXING" | "INDEXED" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: "queued" | "validating" | "extracting" | "chunking" | "indexing" | "completed" | "failed" | "cancelled" | "cancelling";
  progress_pct: number;
  chunks_indexed?: number;
  chunks_total?: number;
  error_message?: string;
}

interface RagJobContextType {
  activeJob: RagJob | null;
  startTrackingJob: (job: Partial<RagJob> & { id: string }) => void;
  cancelActiveJob: () => Promise<void>;
  dismissJob: () => void;
  isPolling: boolean;
}

const RagJobContext = createContext<RagJobContextType>({
  activeJob: null,
  startTrackingJob: () => {},
  cancelActiveJob: async () => {},
  dismissJob: () => {},
  isPolling: false,
});

export function RagJobProvider({ children }: { children: React.ReactNode }) {
  const [activeJob, setActiveJob] = useState<RagJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Restore on mount from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedJobId = localStorage.getItem("active_curriculum_job_id");
    if (savedJobId && !activeJob) {
      setActiveJob({
        id: savedJobId,
        job_id: savedJobId,
        title: "Processing Curriculum Document...",
        file_name: "Document Ingestion",
        status: "QUEUED",
        stage: "queued",
        progress_pct: 10,
        chunks_indexed: 0,
        chunks_total: 0,
      });
    }
  }, []);

  // Isolated background polling timer
  useEffect(() => {
    if (!activeJob?.id) {
      setIsPolling(false);
      return;
    }

    if (
      activeJob.status === "INDEXED" ||
      activeJob.status === "COMPLETED" ||
      activeJob.status === "FAILED" ||
      activeJob.status === "CANCELLED"
    ) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);
    const timer = setInterval(async () => {
      try {
        const res = await fetchWithTenant(`/api/v1/ai/curriculum/jobs/${activeJob.id}`);
        if (!res.ok) return;
        const jobData = await res.json();

        setActiveJob((prev) => ({
          ...(prev || {}),
          ...jobData,
        }));

        if (jobData.status === "INDEXED" || jobData.status === "COMPLETED") {
          localStorage.removeItem("active_curriculum_job_id");
          setIsPolling(false);
          // Keep completed banner visible for 6 seconds, then clear
          setTimeout(() => {
            setActiveJob((curr) => (curr?.status === "INDEXED" || curr?.status === "COMPLETED" ? null : curr));
          }, 6000);
        } else if (jobData.status === "FAILED" || jobData.status === "CANCELLED") {
          localStorage.removeItem("active_curriculum_job_id");
          setIsPolling(false);
        }
      } catch (err) {
        console.warn("Background RAG job poll error:", err);
      }
    }, 2200);

    return () => clearInterval(timer);
  }, [activeJob?.id, activeJob?.status]);

  const startTrackingJob = useCallback((job: Partial<RagJob> & { id: string }) => {
    const fullJob: RagJob = {
      id: job.id,
      job_id: job.job_id || job.id,
      title: job.title || "Curriculum Document",
      file_name: job.file_name,
      status: job.status || "QUEUED",
      stage: job.stage || "queued",
      progress_pct: job.progress_pct || 10,
      chunks_indexed: job.chunks_indexed || 0,
      chunks_total: job.chunks_total || 0,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("active_curriculum_job_id", job.id);
    }
    setActiveJob(fullJob);
  }, []);

  const cancelActiveJob = useCallback(async () => {
    if (!activeJob?.id || isCancelling) return;
    setIsCancelling(true);
    try {
      await fetchWithTenant(`/api/v1/ai/curriculum/jobs/${activeJob.id}/cancel`, {
        method: "POST",
      });
      setActiveJob((prev) => (prev ? { ...prev, status: "CANCELLED", stage: "cancelled" } : null));
      if (typeof window !== "undefined") {
        localStorage.removeItem("active_curriculum_job_id");
      }
    } catch (err) {
      console.warn("Failed to cancel RAG job:", err);
    } finally {
      setIsCancelling(false);
    }
  }, [activeJob, isCancelling]);

  const dismissJob = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_curriculum_job_id");
    }
    setActiveJob(null);
  }, []);

  return (
    <RagJobContext.Provider
      value={{
        activeJob,
        startTrackingJob,
        cancelActiveJob,
        dismissJob,
        isPolling,
      }}
    >
      {children}

      {/* Global Non-Blocking Floating Status Pill (Visible across ALL pages when RAG job is active) */}
      {activeJob && (
        <aside
          aria-label="Background Curriculum Ingestion"
          className="fixed bottom-5 right-5 z-999 max-w-sm w-full bg-white dark:bg-[#121216] border border-blue-200 dark:border-blue-900/60 shadow-2xl rounded-2xl p-4 transition-all animate-in slide-in-from-bottom-5"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  activeJob.status === "INDEXED" || activeJob.status === "COMPLETED"
                    ? "bg-emerald-500"
                    : activeJob.status === "FAILED"
                    ? "bg-rose-500"
                    : activeJob.status === "CANCELLED"
                    ? "bg-gray-400"
                    : "bg-blue-600 animate-pulse"
                }`}
              />
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                RAG Ingestion
              </span>
            </div>
            <button
              onClick={dismissJob}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-lg"
              title="Dismiss indicator"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {activeJob.file_name || activeJob.title}
            </p>
            <div className="flex justify-between items-center text-[11px]">
              <span className="capitalize text-blue-600 dark:text-blue-400 font-medium">
                {activeJob.stage === "queued" && "Queued in background"}
                {activeJob.stage === "validating" && "Validating structure..."}
                {activeJob.stage === "extracting" && "Extracting text streams..."}
                {activeJob.stage === "chunking" && "Creating knowledge chunks..."}
                {activeJob.stage === "indexing" && `Indexing chunks (${activeJob.chunks_indexed || 0}/${activeJob.chunks_total || 0})`}
                {(activeJob.stage === "completed" || activeJob.status === "INDEXED") && "Ingestion complete!"}
                {activeJob.stage === "cancelled" && "Job cancelled"}
                {activeJob.stage === "failed" && "Ingestion failed"}
              </span>
              <span className="font-mono font-bold">{activeJob.progress_pct}%</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  activeJob.status === "FAILED"
                    ? "bg-rose-500"
                    : activeJob.status === "INDEXED" || activeJob.status === "COMPLETED"
                    ? "bg-emerald-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${Math.max(5, activeJob.progress_pct)}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-white/5 text-[11px]">
            <Link
              href="/dashboard/academic?tab=knowledge-base"
              className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 hover:underline"
            >
              <span>View Knowledge Base</span>
              <ChevronRight size={12} />
            </Link>

            {activeJob.status !== "INDEXED" &&
              activeJob.status !== "COMPLETED" &&
              activeJob.status !== "FAILED" &&
              activeJob.status !== "CANCELLED" && (
                <button
                  onClick={cancelActiveJob}
                  disabled={isCancelling}
                  className="text-rose-600 hover:text-rose-700 font-semibold px-2 py-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  {isCancelling ? "Cancelling..." : "Cancel"}
                </button>
              )}
          </div>
        </aside>
      )}
    </RagJobContext.Provider>
  );
}

export function useRagJob() {
  return useContext(RagJobContext);
}
