// frontend/lib/offline/offline-cache-manager.ts
import { offlineDB } from "./db.ts";
import type { OfflineReferenceRecord } from "./types.ts";

const ALLOWED_OFFLINE_ENTITIES = new Set([
  "academic_routine",
  "class_list",
  "subject_list",
  "authorized_notices",
]);

const FORBIDDEN_OFFLINE_ENTITIES = new Set([
  "finance_ledger",
  "fee_payments",
  "student_pii",
  "guardian_contacts",
  "audit_logs",
  "auth_tokens",
  "subscription_billing",
]);

export class OfflineCacheManager {
  private db = offlineDB;

  private makeKey(tenantId: string, userId: string, entityType: string, entityId: string): string {
    return `${tenantId}:${userId}:${entityType}:${entityId}`;
  }

  async cacheReferenceData<T = any>(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string,
    data: T,
    ttlSeconds: number = 86400 // Default 24 hours
  ): Promise<boolean> {
    if (FORBIDDEN_OFFLINE_ENTITIES.has(entityType)) {
      throw new Error(`Security Violation: Entity '${entityType}' is strictly quarantined from offline storage.`);
    }

    if (!ALLOWED_OFFLINE_ENTITIES.has(entityType)) {
      return false; // Silently skip unauthorized entity types
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();
    const key = this.makeKey(tenantId, userId, entityType, entityId);

    const record: OfflineReferenceRecord<T> = {
      key,
      tenant_id: tenantId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      schema_version: 1,
      local_revision: 1,
      data,
      cached_at: now.toISOString(),
      expires_at: expiresAt,
    };

    await this.db.putReference(record);
    return true;
  }

  async getCachedReference<T = any>(
    tenantId: string,
    userId: string,
    entityType: string,
    entityId: string
  ): Promise<T | null> {
    const key = this.makeKey(tenantId, userId, entityType, entityId);
    const record = await this.db.getReference(key);
    if (!record) return null;
    return record.data as T;
  }

  async purgeAllForUser(tenantId: string, userId: string): Promise<void> {
    await this.db.purgeUserData(tenantId, userId);
  }
}

export const offlineCacheManager = new OfflineCacheManager();
