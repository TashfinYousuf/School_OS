// frontend/lib/offline/conflict-resolver.ts
import type { OfflineMutationRecord } from "./types.ts";

export interface ConflictResolution {
  action: "RETRY" | "DROP" | "MANUAL_REVIEW";
  reason: string;
}

export class ConflictResolver {
  /**
   * Resolves conflicts based on entity domain rules.
   * Avoids simplistic last-write-wins; respects institutional auditability.
   */
  static resolve(
    mutation: OfflineMutationRecord,
    httpStatus: number,
    serverMessage: string
  ): ConflictResolution {
    // 1. Permanent Authorization or Model Validation Errors: DROP (Do not retry forever)
    if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 422) {
      return {
        action: "DROP",
        reason: `Server rejected request (${httpStatus}): ${serverMessage}`,
      };
    }

    // 2. Attendance Domain Conflict (409 Conflict):
    // If a record already exists with finalized server state, flag for educator review
    if (mutation.mutation_type === "ATTENDANCE_MARK" && httpStatus === 409) {
      return {
        action: "MANUAL_REVIEW",
        reason: `Attendance conflict on date: ${serverMessage}. Final server state cannot be silently overwritten.`,
      };
    }

    // 3. Transient Network or Server 5xx Errors: RETRY
    if (httpStatus >= 500 || httpStatus === 0) {
      return {
        action: "RETRY",
        reason: `Transient server/network error (${httpStatus}): ${serverMessage}`,
      };
    }

    return {
      action: "MANUAL_REVIEW",
      reason: `Unhandled server response (${httpStatus}): ${serverMessage}`,
    };
  }
}
