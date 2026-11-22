// frontend/lib/offline/sync-coordinator.ts
import { mutationQueue } from "./mutation-queue.ts";
import { ConflictResolver } from "./conflict-resolver.ts";
import type { SyncResult, OfflineMutationRecord } from "./types.ts";
import { fetchWithTenant } from "../api-client.ts";

export class SyncCoordinator {
  private queue = mutationQueue;
  private isSyncing = false;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        this.triggerSync();
      });

      window.addEventListener("offline-mutation-queued", () => {
        if (navigator.onLine) {
          this.triggerSync();
        }
      });
    }
  }

  private triggerSync() {
    if (typeof window === "undefined") return;
    const tenantId = localStorage.getItem("tenant_id") || "";
    const userId = localStorage.getItem("user_id") || "";
    if (tenantId && userId) {
      this.syncAll(tenantId, userId).catch(() => {});
    }
  }

  async syncAll(tenantId: string, userId: string): Promise<SyncResult> {
    if (this.isSyncing) {
      return { synced: 0, rejected: 0, conflicts: 0, pending: 0, errors: ["Sync already in progress"] };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const pendingList = await this.queue.getPending(tenantId, userId);
      return { synced: 0, rejected: 0, conflicts: 0, pending: pendingList.length, errors: ["Device is offline"] };
    }

    this.isSyncing = true;
    let synced = 0;
    let rejected = 0;
    let conflicts = 0;
    const errors: string[] = [];

    try {
      const pendingMutations = await this.queue.getPending(tenantId, userId);

      for (const mutation of pendingMutations) {
        await this.queue.markSyncing(mutation.idempotency_key);

        try {
          const res = await this.dispatchMutation(mutation);

          if (res.ok) {
            await this.queue.markSynced(mutation.idempotency_key);
            synced++;
          } else {
            const errorBody = await res.text().catch(() => "Unknown server error");
            const resolution = ConflictResolver.resolve(mutation, res.status, errorBody);

            if (resolution.action === "DROP") {
              await this.queue.markRejected(mutation.idempotency_key, resolution.reason);
              rejected++;
              errors.push(resolution.reason);
            } else if (resolution.action === "MANUAL_REVIEW" && res.status === 409) {
              await this.queue.markConflict(mutation.idempotency_key, resolution.reason);
              conflicts++;
              errors.push(resolution.reason);
            } else {
              await this.queue.markRetryPending(mutation.idempotency_key, resolution.reason);
              errors.push(resolution.reason);
            }
          }
        } catch (netErr: any) {
          const msg = netErr?.message || "Network request failed";
          await this.queue.markRetryPending(mutation.idempotency_key, msg);
          errors.push(msg);
        }
      }

      const remaining = await this.queue.getPending(tenantId, userId);
      const result: SyncResult = {
        synced,
        rejected,
        conflicts,
        pending: remaining.length,
        errors,
      };

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("offline-sync-complete", {
            detail: result,
          })
        );
      }

      return result;
    } finally {
      this.isSyncing = false;
    }
  }

  private async dispatchMutation(mutation: OfflineMutationRecord): Promise<Response> {
    switch (mutation.mutation_type) {
      case "ATTENDANCE_MARK": {
        // Dispatches to server-side sync-offline endpoint
        return fetchWithTenant("/api/v1/attendance/sync-offline", {
          method: "POST",
          body: JSON.stringify(mutation.payload),
        });
      }

      case "NOTICE_ACKNOWLEDGE": {
        return fetchWithTenant(`/api/v1/notices/${mutation.entity_id}/acknowledge`, {
          method: "POST",
        });
      }

      default:
        throw new Error(`Unsupported mutation type: ${(mutation as any).mutation_type}`);
    }
  }
}

export const syncCoordinator = new SyncCoordinator();
