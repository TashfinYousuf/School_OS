export interface QueuedAttendanceSubmission {
  queueId: string;
  className: string;
  attendanceDate: string;
  records: Array<{
    student_id: string;
    status: string;
    remarks?: string;
    idempotency_key: string;
  }>;
  queuedAt: string;
}

const QUEUE_KEY = "eduos_attendance_offline_queue";

export function getOfflineAttendanceQueue(): QueuedAttendanceSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveToOfflineAttendanceQueue(payload: QueuedAttendanceSubmission): void {
  const currentQueue = getOfflineAttendanceQueue();
  // Filter out any duplicate queue for same class and date
  const filtered = currentQueue.filter(
    (q) => !(q.className === payload.className && q.attendanceDate === payload.attendanceDate)
  );
  filtered.push(payload);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

export async function flushOfflineAttendanceQueue(token: string): Promise<number> {
  const queue = getOfflineAttendanceQueue();
  if (queue.length === 0) return 0;

  let syncedCount = 0;
  const remainingQueue: QueuedAttendanceSubmission[] = [];

  for (const item of queue) {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/v1/attendance/bulk-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          class_name: item.className,
          attendance_date: item.attendanceDate,
          records: item.records
        })
      });

      if (res.ok) {
        syncedCount++;
      } else {
        remainingQueue.push(item);
      }
    } catch {
      remainingQueue.push(item);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
  return syncedCount;
}