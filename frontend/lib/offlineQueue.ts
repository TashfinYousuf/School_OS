// frontend/lib/offlineQueue.ts
// Stage 11: Bridged to Durable IndexedDB MutationQueue & SyncCoordinator

import { mutationQueue } from "./offline/mutation-queue.ts";
import { syncCoordinator } from "./offline/sync-coordinator.ts";

export interface QueuedAttendanceSubmission {
  queueId?: string;
  className: string;
  attendanceDate: string;
  records: Array<{
    student_id: string;
    status: string;
    remarks?: string;
    idempotency_key?: string;
  }>;
  queuedAt?: string;
}

function getContext(): { tenantId: string; userId: string } {
  if (typeof window === "undefined") {
    return { tenantId: "global", userId: "anonymous" };
  }
  const tenantId = localStorage.getItem("tenant_id") || "global";
  const userId = localStorage.getItem("user_id") || "anonymous";
  return { tenantId, userId };
}

export async function saveToOfflineAttendanceQueue(payload: QueuedAttendanceSubmission): Promise<void> {
  const { tenantId, userId } = getContext();
  await mutationQueue.enqueue(
    tenantId,
    userId,
    "ATTENDANCE_MARK",
    `ATT_${payload.className}_${payload.attendanceDate}`,
    {
      date: payload.attendanceDate,
      class_name: payload.className,
      records: payload.records.map((r) => ({
        student_id: r.student_id,
        status: r.status,
        notes: r.remarks,
      })),
    }
  );
}

export async function getOfflineAttendanceQueue(): Promise<any[]> {
  const { tenantId, userId } = getContext();
  const pending = await mutationQueue.getPending(tenantId, userId);
  return pending.map((m) => ({
    queueId: m.idempotency_key,
    className: m.payload.class_name,
    attendanceDate: m.payload.date,
    records: m.payload.records,
    queuedAt: m.created_at,
    syncStatus: m.sync_status,
    retryCount: m.retry_count,
  }));
}

export async function flushOfflineAttendanceQueue(): Promise<number> {
  const { tenantId, userId } = getContext();
  const result = await syncCoordinator.syncAll(tenantId, userId);
  return result.synced;
}
