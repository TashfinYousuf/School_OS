// frontend/tests/test_stage11_offline.test.ts
import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";

import {
  OfflineDatabase,
  MutationQueue,
  SyncCoordinator,
  ConflictResolver,
  OfflineCacheManager,
} from "../lib/offline/index.ts";

describe("Stage 11: PWA & Offline Infrastructure Test Suite", () => {
  let db: OfflineDatabase;
  let queue: MutationQueue;
  let cacheManager: OfflineCacheManager;

  beforeEach(() => {
    db = new OfflineDatabase();
    queue = new MutationQueue();
    // Inject test DB instance
    (queue as any).db = db;
    cacheManager = new OfflineCacheManager();
    (cacheManager as any).db = db;
  });

  describe("1. Offline Mutation Queue & Bounded Retries", () => {
    test("should enqueue mutation with unique idempotency key and initial QUEUED status", async () => {
      const record = await queue.enqueue(
        "tenant-1",
        "user-teacher-1",
        "ATTENDANCE_MARK",
        "ATT_Class5_2026-11-08",
        { class_name: "Class 5", date: "2026-11-08", records: [] }
      );

      assert.ok(record.idempotency_key.startsWith("MUT_"));
      assert.strictEqual(record.sync_status, "QUEUED");
      assert.strictEqual(record.retry_count, 0);
      assert.strictEqual(record.tenant_id, "tenant-1");
      assert.strictEqual(record.user_id, "user-teacher-1");

      const pending = await queue.getPending("tenant-1", "user-teacher-1");
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].idempotency_key, record.idempotency_key);
    });

    test("should increment retry count on transient failure and transition to RETRY_PENDING", async () => {
      const record = await queue.enqueue(
        "tenant-1",
        "user-teacher-1",
        "ATTENDANCE_MARK",
        "ATT_1",
        { test: 123 },
        3 // Max 3 retries
      );

      await queue.markRetryPending(record.idempotency_key, "Network timeout 504");
      const updated = await db.getMutation(record.idempotency_key);

      assert.ok(updated);
      assert.strictEqual(updated.retry_count, 1);
      assert.strictEqual(updated.sync_status, "RETRY_PENDING");
      assert.strictEqual(updated.last_error, "Network timeout 504");
    });

    test("should transition to REJECTED dead-letter state when max retries exceeded", async () => {
      const record = await queue.enqueue(
        "tenant-1",
        "user-teacher-1",
        "ATTENDANCE_MARK",
        "ATT_2",
        {},
        2 // Max 2 retries
      );

      // Retry 1
      await queue.markRetryPending(record.idempotency_key, "Error 1");
      let current = await db.getMutation(record.idempotency_key);
      assert.strictEqual(current?.sync_status, "RETRY_PENDING");
      assert.strictEqual(current?.retry_count, 1);

      // Retry 2 (Hits max)
      await queue.markRetryPending(record.idempotency_key, "Error 2");
      current = await db.getMutation(record.idempotency_key);
      assert.strictEqual(current?.sync_status, "REJECTED");
      assert.strictEqual(current?.retry_count, 2);
      assert.ok(current?.last_error?.includes("Exceeded max retries"));

      // Must no longer be in pending queue
      const pending = await queue.getPending("tenant-1", "user-teacher-1");
      assert.strictEqual(pending.length, 0);
    });

    test("should mark permanent client errors as REJECTED immediately without looping", async () => {
      const record = await queue.enqueue(
        "tenant-1",
        "user-teacher-1",
        "ATTENDANCE_MARK",
        "ATT_3",
        {}
      );

      await queue.markRejected(record.idempotency_key, "HTTP 400: Malformed payload");
      const updated = await db.getMutation(record.idempotency_key);

      assert.strictEqual(updated?.sync_status, "REJECTED");
      assert.strictEqual(updated?.last_error, "HTTP 400: Malformed payload");

      const pending = await queue.getPending("tenant-1", "user-teacher-1");
      assert.strictEqual(pending.length, 0);
    });
  });

  describe("2. Multi-Tenant & Multi-User Queue Isolation", () => {
    test("should strictly isolate mutations between different users in same tenant", async () => {
      await queue.enqueue("tenant-1", "user-A", "ATTENDANCE_MARK", "ATT_A", { user: "A" });
      await queue.enqueue("tenant-1", "user-B", "ATTENDANCE_MARK", "ATT_B", { user: "B" });

      const pendingA = await queue.getPending("tenant-1", "user-A");
      const pendingB = await queue.getPending("tenant-1", "user-B");

      assert.strictEqual(pendingA.length, 1);
      assert.strictEqual(pendingA[0].entity_id, "ATT_A");

      assert.strictEqual(pendingB.length, 1);
      assert.strictEqual(pendingB[0].entity_id, "ATT_B");
    });

    test("should strictly isolate mutations between different tenants", async () => {
      await queue.enqueue("tenant-X", "user-same-id", "ATTENDANCE_MARK", "ATT_X", {});
      await queue.enqueue("tenant-Y", "user-same-id", "ATTENDANCE_MARK", "ATT_Y", {});

      const pendingX = await queue.getPending("tenant-X", "user-same-id");
      const pendingY = await queue.getPending("tenant-Y", "user-same-id");

      assert.strictEqual(pendingX.length, 1);
      assert.strictEqual(pendingX[0].tenant_id, "tenant-X");

      assert.strictEqual(pendingY.length, 1);
      assert.strictEqual(pendingY[0].tenant_id, "tenant-Y");
    });

    test("should purge only the logged-out user data upon logout/account switch", async () => {
      await queue.enqueue("tenant-1", "user-A", "ATTENDANCE_MARK", "ATT_A", {});
      await queue.enqueue("tenant-1", "user-B", "ATTENDANCE_MARK", "ATT_B", {});

      // User A logs out
      await db.purgeUserData("tenant-1", "user-A");

      const pendingA = await queue.getPending("tenant-1", "user-A");
      const pendingB = await queue.getPending("tenant-1", "user-B");

      assert.strictEqual(pendingA.length, 0); // User A wiped
      assert.strictEqual(pendingB.length, 1); // User B untouched
    });
  });

  describe("3. Conflict Resolution Strategy", () => {
    test("should drop 4xx client errors to avoid infinite loops", () => {
      const mockMutation: any = { mutation_type: "ATTENDANCE_MARK" };
      const res400 = ConflictResolver.resolve(mockMutation, 400, "Invalid schema");
      assert.strictEqual(res400.action, "DROP");

      const res403 = ConflictResolver.resolve(mockMutation, 403, "Forbidden role");
      assert.strictEqual(res403.action, "DROP");
    });

    test("should require manual review on 409 attendance conflict", () => {
      const mockMutation: any = { mutation_type: "ATTENDANCE_MARK" };
      const res409 = ConflictResolver.resolve(mockMutation, 409, "Record already finalized on server");
      assert.strictEqual(res409.action, "MANUAL_REVIEW");
      assert.ok(res409.reason.includes("Attendance conflict"));
    });

    test("should retry on 5xx transient server errors", () => {
      const mockMutation: any = { mutation_type: "ATTENDANCE_MARK" };
      const res503 = ConflictResolver.resolve(mockMutation, 503, "Service Unavailable");
      assert.strictEqual(res503.action, "RETRY");
    });
  });

  describe("4. Offline Cache Manager & Sensitive Data Quarantine", () => {
    test("should allow caching approved public academic reference data", async () => {
      const ok = await cacheManager.cacheReferenceData(
        "tenant-1",
        "user-1",
        "academic_routine",
        "routine-class-5",
        { slots: ["Period 1: Math", "Period 2: Science"] }
      );
      assert.strictEqual(ok, true);

      const cached = await cacheManager.getCachedReference(
        "tenant-1",
        "user-1",
        "academic_routine",
        "routine-class-5"
      );
      assert.ok(cached);
      assert.strictEqual((cached as any).slots.length, 2);
    });

    test("should throw security violation error when attempting to cache financial records", async () => {
      await assert.rejects(
        async () => {
          await cacheManager.cacheReferenceData(
            "tenant-1",
            "user-1",
            "finance_ledger",
            "student-fee-123",
            { amount: 5000 }
          );
        },
        /Security Violation: Entity 'finance_ledger' is strictly quarantined/
      );
    });

    test("should throw security violation error when attempting to cache student PII or guardian contacts", async () => {
      await assert.rejects(
        async () => {
          await cacheManager.cacheReferenceData(
            "tenant-1",
            "user-1",
            "guardian_contacts",
            "guardians-all",
            [{ phone: "01700000000" }]
          );
        },
        /Security Violation: Entity 'guardian_contacts' is strictly quarantined/
      );
    });
  });
});

