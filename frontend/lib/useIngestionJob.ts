import { useCallback, useEffect, useRef, useState } from "react";

export interface IngestionJob {
  id: string; title?: string; file_name?: string; status: string; stage?: string;
  progress_pct?: number; chunks_count?: number; chunks_indexed?: number; chunks_total?: number;
  error_message?: string | null;
}

const TERMINAL = new Set(["INDEXED", "COMPLETED", "READY", "FAILED", "CANCELLED", "CANCELED"]);
export const isTerminal = (s?: string) => TERMINAL.has((s || "").toUpperCase());
const MAX_TRACK_MS = 30 * 60 * 1000;   // 30 min, tar por UI ar infinite wait kore na

export function useIngestionJob(fetchApi: (url: string, init?: RequestInit) => Promise<Response>) {
  const [activeJob, setActiveJob] = useState<IngestionJob | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopped = useRef(true);
  const startedAt = useRef(0);
  const failures = useRef(0);

  const stop = useCallback(() => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const fail = useCallback((message: string) => {
    setActiveJob((j) => (j ? { ...j, status: "FAILED", error_message: message } : j));
    stop();
  }, [stop]);

  const poll = useCallback(async (id: string) => {
    if (stopped.current) return;
    if (Date.now() - startedAt.current > MAX_TRACK_MS) {
      fail("Server er response paoa jachche na. Pore Retry chapo ba job list dekho.");
      return;
    }
    try {
      const res = await fetchApi(`/api/v1/ai/curriculum/jobs/${id}`);
      if (res.status === 404) { setActiveJob(null); stop(); return; }
      if (res.status === 401 || res.status === 403) { fail("Session expired ba permission nei."); return; }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      failures.current = 0;
      setActiveJob((prev) => ({ ...(prev ?? { id, status: "QUEUED" }), ...data, id }));
      if (isTerminal(data.status)) { stop(); return; }
    } catch {
      failures.current += 1;
      if (failures.current >= 8) { fail("Server e connect kora jachche na."); return; }
    }
    const delay = Math.min(10000, 1500 + failures.current * 1500 + Math.floor((Date.now() - startedAt.current) / 20000) * 500);
    timer.current = setTimeout(() => void poll(id), delay);
  }, [fetchApi, stop, fail]);

  const startTrackingJob = useCallback((job: Partial<IngestionJob> & { job_id?: string }) => {
    const id = String(job.job_id ?? job.id ?? "");
    if (!id) return;
    stop();
    stopped.current = false;
    startedAt.current = Date.now();
    failures.current = 0;
    setActiveJob({ status: "QUEUED", ...job, id } as IngestionJob);
    void poll(id);
  }, [poll, stop]);

  const cancelActiveJob = useCallback(async () => {
    if (!activeJob?.id) return;
    await fetchApi(`/api/v1/ai/curriculum/jobs/${activeJob.id}/cancel`, { method: "POST" });
  }, [activeJob?.id, fetchApi]);

  useEffect(() => stop, [stop]);       // unmount e polling bondho

  return { activeJob, startTrackingJob, cancelActiveJob };
}