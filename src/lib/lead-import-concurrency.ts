import "server-only";

import { db } from "@/lib/db";
import {
  createLeadImportBatch,
  uploadLeadImportRows,
  type LeadImportBatchWithRows,
} from "@/lib/lead-import-batch";
import type { CreateLeadImportBatchInput } from "@/lib/lead-import-contract";

const MAX_ROW_UPLOAD_RETRIES = 2;

type PrismaErrorLike = { code?: unknown };

export function isLeadImportUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && (error as PrismaErrorLike).code === "P2002";
}

/**
 * `localRunId` is the durable idempotency identity for a batch. Two matching
 * create requests can race between lookup and insert; return the winning batch
 * rather than expose the database uniqueness error to the signed client.
 */
export async function createLeadImportBatchWithConcurrencyRecovery(
  input: CreateLeadImportBatchInput,
  keyId: string
): Promise<{ batch: LeadImportBatchWithRows; created: boolean }> {
  try {
    return await createLeadImportBatch(input, keyId);
  } catch (error) {
    if (!isLeadImportUniqueConstraintError(error)) throw error;

    const existing = await db.leadImportBatch.findUnique({
      where: { localRunId: input.localRunId },
      include: { rows: true },
    });

    if (!existing) throw error;
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
