import "server-only";

import {
  LeadImportBatchNotFoundError,
  LeadImportBatchStateError,
} from "@/lib/lead-import-batch";
import { LeadImportBatchReplayConflictError } from "@/lib/lead-import-concurrency-contract";
import { leadImportJson } from "@/lib/lead-import-route-guard";

export function leadImportDomainErrorResponse(error: unknown, requestId: string) {
  if (error instanceof LeadImportBatchNotFoundError) {
    return leadImportJson(
      { error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message },
      404,
      requestId,
    );
  }

  if (error instanceof LeadImportBatchStateError) {
    return leadImportJson(
      { error: "LEAD_IMPORT_INVALID_STATE", message: error.message },
      409,
      requestId,
    );
  }

  if (error instanceof LeadImportBatchReplayConflictError) {
    return leadImportJson(
      { error: "LEAD_IMPORT_REPLAY_CONFLICT", message: error.message },
      409,
      requestId,
    );
  }

  return null;
}
