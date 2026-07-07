import "server-only";

import { db } from "@/lib/db";
import {
  createLeadImportBatch,
  uploadLeadImportRows,
  type LeadImportBatchWithRows,
} from "@/lib/lead-import-batch";
import type { CreateLeadImportBatchInput } from "@/lib/lead-import-contract";
import {
  assertImmutableLeadImportBatchReplay,
  isLeadImportUniqueConstraintError,
  MAX_ROW_UPLOAD_RETRIES,
} from "@/lib/lead-import-concurrency-contract";

export {
  isLeadImportUniqueConstraintError,
  LeadImportBatchReplayConflictError,
} from "@/lib/lead-import-concurrency-contract";

function assertBatchReplay(
  batch: LeadImportBatchWithRows,
  input: CreateLeadImportBatchInput,
  keyId: string
) {
  assertImmutableLeadImportBatchReplay(batch, input, keyId);
}

/**
 * `localRunId` is the durable idempotency identity for a batch. A matching
 * retry returns the winning batch; changed immutable batch metadata is a
 * replay conflict rather than a silent return of unrelated prior state.
 */
export async function createLeadImportBatchWithConcurrencyRecovery(
  input: CreateLeadImportBatchInput,
  keyId: string
): Promise<{ batch: LeadImportBatchWithRows; created: boolean }> {
  try {
    const result = await createLeadImportBatch(input, keyId);
    if (!result.created) assertBatchReplay(result.batch, input, keyId);
    return result;
  } catch (error) {
    if (!isLeadImportUniqueConstraintError(error)) throw error;

    const existing = await db.leadImportBatch.findUnique({
      where: { localRunId: input.localRunId },
      include: { rows: true },
    });

    if (!existing) throw error;
    assertBatchReplay(existing, input, keyId);
    return { batch: existing, created: false };
  }
}

/**
 * Row uniqueness is enforced by (batchId,rowNumber) and
 * (batchId,idempotencyKey). A concurrent exact retry can lose an insert race;
 * rerun the existing immutable-replay validation against the persisted row.
 */
export async function uploadLeadImportRowsWithConcurrencyRecovery(
  batchId: string,
  body: unknown
): Promise<LeadImportBatchWithRows> {
  let lastUniqueError: unknown;

  for (let attempt = 0; attempt <= MAX_ROW_UPLOAD_RETRIES; attempt += 1) {
    try {
      return await uploadLeadImportRows(batchId, body);
    } catch (error) {
      if (!isLeadImportUniqueConstraintError(error) || attempt === MAX_ROW_UPLOAD_RETRIES) throw error;
      lastUniqueError = error;
    }
  }

  throw lastUniqueError;
}
