// frontend/lib/offline/types.ts

export type SyncStatus =
  | "QUEUED"
  | "SYNCING"
  | "SYNCED"
  | "RETRY_PENDING"
  | "REJECTED"
  | "CONFLICT";

export type MutationType =
  | "ATTENDANCE_MARK"
  | "NOTICE_ACKNOWLEDGE";

export interface OfflineMutationRecord<T = any> {
  idempotency_key: string;     // Unique primary key
  tenant_id: string;           // Strict tenant scoping
  workspace_id?: string;
  user_id: string;             // Strict user scoping
  mutation_type: MutationType;
  entity_id: string;
  payload_version: number;
  payload: T;
  created_at: string;          // ISO timestamp
  updated_at: string;
  retry_count: number;
  max_retries: number;
  last_error?: string;
  sync_status: SyncStatus;
}

export interface OfflineReferenceRecord<T = any> {
  key: string;                 // `${tenant_id}:${user_id}:${entity_type}:${entity_id}`
  tenant_id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  schema_version: number;
  local_revision: number;
  server_revision?: number;
  data: T;
  cached_at: string;
  expires_at: string;
}

export interface SyncResult {
  synced: number;
  rejected: number;
  conflicts: number;
  pending: number;
  errors: string[];
}

