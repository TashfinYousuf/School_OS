// frontend/lib/offline/mutation-queue.ts
import { offlineDB } from "./db.ts";
import type { MutationType, OfflineMutationRecord, SyncStatus } from "./types.ts";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class MutationQueue {
  private db = offlineDB;

  async enqueue<T = any>(
    tenantId: string,
    userId: string,
    mutationType: MutationType,
    entityId: string,
    payload: T,
    maxRetries: number = 5
  ): Promise<OfflineMutationRecord<T>> {
    const now = new Date().toISOString();
    const idempotencyKey = `MUT_${generateUUID()}`;

    const record: OfflineMutationRecord<T> = {
      idempotency_key: idempotencyKey,
      tenant_id: tenantId,
      user_id: userId,
      mutation_type: mutationType,
      entity_id: entityId,
      payload_version: 1,
      payload,
      created_at: now,
      updated_at: now,
      retry_count: 0,
      max_retries: maxRetries,
      sync_status: "QUEUED",
    };

    await this.db.putMutation(record);

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("offline-mutation-queued", {
          detail: { idempotency_key: idempotencyKey, mutation_type: mutationType },
        })
      );
    }

    return record;
  }

  async getPending(tenantId: string, userId: string): Promise<OfflineMutationRecord[]> {
    return this.db.getMutationsForUser(tenantId, userId, ["QUEUED", "RETRY_PENDING"]);
  }

  async getAll(tenantId: string, userId: string): Promise<OfflineMutationRecord[]> {
    return this.db.getMutationsForUser(tenantId, userId);
  }

  async markSyncing(idempotencyKey: string): Promise<void> {
    await this.db.updateMutation(idempotencyKey, { sync_status: "SYNCING" });
  }

  async markSynced(idempotencyKey: string): Promise<void> {
    await this.db.updateMutation(idempotencyKey, {
      sync_status: "SYNCED",
      last_error: undefined,
    });
  }

  async markRetryPending(idempotencyKey: string, errorMsg: string): Promise<void> {
    const record = await this.db.getMutation(idempotencyKey);
    if (!record) return;

    const nextCount = record.retry_count + 1;
    if (nextCount >= record.max_retries) {
      // Reached max retries: move to dead-letter REJECTED state
      await this.db.updateMutation(idempotencyKey, {
        retry_count: nextCount,
        sync_status: "REJECTED",
        last_error: `Exceeded max retries (${record.max_retries}): ${errorMsg}`,
      });
    } else {
      await this.db.updateMutation(idempotencyKey, {
        retry_count: nextCount,
        sync_status: "RETRY_PENDING",
        last_error: errorMsg,
      });
    }
  }

  async markRejected(idempotencyKey: string, errorMsg: string): Promise<void> {
    await this.db.updateMutation(idempotencyKey, {
      sync_status: "REJECTED",
      last_error: errorMsg,
    });
  }

  async markConflict(idempotencyKey: string, conflictMsg: string): Promise<void> {
    await this.db.updateMutation(idempotencyKey, {
      sync_status: "CONFLICT",
      last_error: conflictMsg,
    });
  }

  async clearUserQueue(tenantId: string, userId: string): Promise<void> {
    await this.db.purgeUserData(tenantId, userId);
  }
}

export const mutationQueue = new MutationQueue();
