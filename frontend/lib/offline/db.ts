// frontend/lib/offline/db.ts
import type { OfflineMutationRecord, OfflineReferenceRecord, SyncStatus } from "./types.ts";

const DB_NAME = "educationos_offline_db";
const DB_VERSION = 1;

export class OfflineDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  // In-memory fallback for environments without native IndexedDB (Node.js/SSR)
  private memoryMutations: Map<string, OfflineMutationRecord> = new Map();
  private memoryReferences: Map<string, OfflineReferenceRecord> = new Map();

  private isIndexedDBAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
  }

  private async getDB(): Promise<IDBDatabase> {
    if (!this.isIndexedDBAvailable()) {
      throw new Error("IndexedDB is not available in current execution context.");
    }

    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Mutations Store
        if (!db.objectStoreNames.contains("mutations")) {
          const mutationStore = db.createObjectStore("mutations", { keyPath: "idempotency_key" });
          mutationStore.createIndex("tenant_user", ["tenant_id", "user_id"], { unique: false });
          mutationStore.createIndex("sync_status", "sync_status", { unique: false });
          mutationStore.createIndex("created_at", "created_at", { unique: false });
        }

        // 2. Reference Cache Store
        if (!db.objectStoreNames.contains("reference_cache")) {
          const refStore = db.createObjectStore("reference_cache", { keyPath: "key" });
          refStore.createIndex("tenant_user", ["tenant_id", "user_id"], { unique: false });
          refStore.createIndex("entity_type", "entity_type", { unique: false });
          refStore.createIndex("expires_at", "expires_at", { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event: Event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  // -----------------------------------------------------------------------------
  // Mutations CRUD
  // -----------------------------------------------------------------------------

  async putMutation(record: OfflineMutationRecord): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      this.memoryMutations.set(record.idempotency_key, { ...record });
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("mutations", "readwrite");
      const store = tx.objectStore("mutations");
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMutation(idempotencyKey: string): Promise<OfflineMutationRecord | null> {
    if (!this.isIndexedDBAvailable()) {
      return this.memoryMutations.get(idempotencyKey) || null;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("mutations", "readonly");
      const store = tx.objectStore("mutations");
      const request = store.get(idempotencyKey);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getMutationsForUser(
    tenantId: string,
    userId: string,
    allowedStatuses?: SyncStatus[]
  ): Promise<OfflineMutationRecord[]> {
    if (!this.isIndexedDBAvailable()) {
      const results: OfflineMutationRecord[] = [];
      for (const m of this.memoryMutations.values()) {
        if (m.tenant_id === tenantId && m.user_id === userId) {
          if (!allowedStatuses || allowedStatuses.includes(m.sync_status)) {
            results.push(m);
          }
        }
      }
      return results.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("mutations", "readonly");
      const store = tx.objectStore("mutations");
      const index = store.index("tenant_user");
      const request = index.getAll(IDBKeyRange.only([tenantId, userId]));

      request.onsuccess = () => {
        let records = (request.result || []) as OfflineMutationRecord[];
        if (allowedStatuses && allowedStatuses.length > 0) {
          records = records.filter((r) => allowedStatuses.includes(r.sync_status));
        }
        records.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        resolve(records);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async updateMutation(idempotencyKey: string, updates: Partial<OfflineMutationRecord>): Promise<void> {
    const existing = await this.getMutation(idempotencyKey);
    if (!existing) return;

    const merged: OfflineMutationRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await this.putMutation(merged);
  }

  async deleteMutation(idempotencyKey: string): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      this.memoryMutations.delete(idempotencyKey);
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("mutations", "readwrite");
      const store = tx.objectStore("mutations");
      const request = store.delete(idempotencyKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // -----------------------------------------------------------------------------
  // Reference Cache CRUD
  // -----------------------------------------------------------------------------

  async putReference(record: OfflineReferenceRecord): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      this.memoryReferences.set(record.key, { ...record });
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("reference_cache", "readwrite");
      const store = tx.objectStore("reference_cache");
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getReference(key: string): Promise<OfflineReferenceRecord | null> {
    if (!this.isIndexedDBAvailable()) {
      const r = this.memoryReferences.get(key);
      if (!r) return null;
      if (new Date(r.expires_at).getTime() <= Date.now()) {
        this.memoryReferences.delete(key);
        return null;
      }
      return r;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("reference_cache", "readonly");
      const store = tx.objectStore("reference_cache");
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result as OfflineReferenceRecord | undefined;
        if (!result) return resolve(null);
        if (new Date(result.expires_at).getTime() <= Date.now()) {
          // Expired record: delete in background and return null
          this.deleteReference(key).catch(() => {});
          return resolve(null);
        }
        resolve(result);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteReference(key: string): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      this.memoryReferences.delete(key);
      return;
    }

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("reference_cache", "readwrite");
      const store = tx.objectStore("reference_cache");
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // -----------------------------------------------------------------------------
  // User Isolation & Cleanup (Logout / Account Switch)
  // -----------------------------------------------------------------------------

  async purgeUserData(tenantId: string, userId: string): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      for (const [k, m] of this.memoryMutations.entries()) {
        if (m.tenant_id === tenantId && m.user_id === userId) {
          this.memoryMutations.delete(k);
        }
      }
      for (const [k, r] of this.memoryReferences.entries()) {
        if (r.tenant_id === tenantId && r.user_id === userId) {
          this.memoryReferences.delete(k);
        }
      }
      return;
    }

    const db = await this.getDB();

    // 1. Purge user mutations
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("mutations", "readwrite");
      const store = tx.objectStore("mutations");
      const index = store.index("tenant_user");
      const request = index.openCursor(IDBKeyRange.only([tenantId, userId]));

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    // 2. Purge user reference cache
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("reference_cache", "readwrite");
      const store = tx.objectStore("reference_cache");
      const index = store.index("tenant_user");
      const request = index.openCursor(IDBKeyRange.only([tenantId, userId]));

      request.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const offlineDB = new OfflineDatabase();
