// frontend/src/services/offlineSyncService.ts
import { fetchWithTenant } from '@/lib/api-client';

export interface PendingAttendanceItem {
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  idempotency_key: string;
}

export const OfflineSyncService = {
  // Save locally when offline
  saveOfflineRecord(record: PendingAttendanceItem) {
    const existing: PendingAttendanceItem[] = JSON.parse(localStorage.getItem('offline_attendance_queue') || '[]');
    existing.push(record);
    localStorage.setItem('offline_attendance_queue', JSON.stringify(existing));
  },

  // Trigger sync when online connectivity restores
  async flushOfflineQueue(): Promise<boolean> {
    const queue: PendingAttendanceItem[] = JSON.parse(localStorage.getItem('offline_attendance_queue') || '[]');
    if (queue.length === 0) return true;

    try {
      const res = await fetchWithTenant('/api/v1/attendance/sync-batch', {
        method: 'POST',
        body: JSON.stringify({ records: queue }),
      });

      if (res.ok) {
        // Clear local queue upon successful server confirmation
        localStorage.removeItem('offline_attendance_queue');
        return true;
      }
      return false;
    } catch (error) {
      console.warn('Network offline, sync postponed:', error);
      return false;
    }
  }
};