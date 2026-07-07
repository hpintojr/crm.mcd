import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";
import type { OwnerLeadAcquisitionProvenanceInput } from "@/lib/lead-import-contract";

export type OwnerLeadAcquisitionProvenance = {
  leadImportBatchId: string;
  sourceCode: string;
  acquisitionReference: string;
  providerName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaErrorLike = { code?: unknown };

export class OwnerLeadAcquisitionProvenanceConflictError extends Error {
  constructor() {
    super("An immutable owner acquisition record already exists for this import batch.");
  }
}

export class OwnerLeadAcquisitionProvenanceBatchNotFoundError extends Error {
  constructor() {
    super("Lead import batch was not found.");
  }
}

export class OwnerLeadAcquisitionProvenanceStateError extends Error {
  constructor() {
    super("Owner acquisition metadata must be recorded before the batch leaves DRAFT.");
  }
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && (error as PrismaErrorLike).code === "P2002";
}

function sameProvenance(existing: OwnerLeadAcquisitionProvenance, input: OwnerLeadAcquisitionProvenanceInput) {
  return (
    existing.sourceCode === input.sourceCode &&
    existing.acquisitionReference === input.acquisitionReference &&
    existing.providerName === (input.providerName ?? null)
  );
}

async function findOwnerLeadAcquisitionProvenance(batchId: string) {
  const rows = await db.$queryRaw<OwnerLeadAcquisitionProvenance[]>(Prisma.sql`
    SELECT
      "leadImportBatchId",
      "sourceCode",
      "acquisitionReference",
      "providerName",
      "createdAt",
      "updatedAt"
    FROM "OwnerLeadAcquisitionProvenance"
    WHERE "leadImportBatchId" = ${batchId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/**
 * The only application read path for acquisition-provenance records.
 *
 * Do not import this module into shared Lead/Batch serializers, Agent pages,
 * Admin pages, import-review pages, audit pages, or API routes intended for
 * any non-OWNER role. Application role enforcement does not replace database
 * least-privilege controls; it prevents disclosure through the CRM itself.
 */
export async function readOwnerLeadAcquisitionProvenance(batchId: string) {
  await requireRole(["OWNER"]);
  return findOwnerLeadAcquisitionProvenance(batchId);
}

/**
 * Private signed-machine write path. It intentionally creates no AuditLog row
 * and never returns the sensitive values. The first write is allowed only in
 * DRAFT. Exact retries are idempotent even after the batch progresses; changed
 * values are a hard conflict.
 */
export async function recordOwnerLeadAcquisitionProvenance(
  batchId: string,
  input: OwnerLeadAcquisitionProvenanceInput,
) {
  const batch = await db.leadImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true, status: true },
  });
  if (!batch) throw new OwnerLeadAcquisitionProvenanceBatchNotFoundError();

  const prior = await findOwnerLeadAcquisitionProvenance(batchId);
  if (prior) {
    if (!sameProvenance(prior, input)) throw new OwnerLeadAcquisitionProvenanceConflictError();
    return { recorded: false };
  }

  if (batch.status !== "DRAFT") throw new OwnerLeadAcquisitionProvenanceStateError();

  const now = new Date();
  try {
    await db.$executeRaw(Prisma.sql`
      INSERT INTO "OwnerLeadAcquisitionProvenance" (
        "id",
        "leadImportBatchId",
        "sourceCode",
        "acquisitionReference",
        "providerName",
        "createdAt",
        "updatedAt"
      ) VALUES (
        ${randomUUID()},
        ${batchId},
        ${input.sourceCode},
        ${input.acquisitionReference},
        ${input.providerName ?? null},
        ${now},
        ${now}
      )
    `);
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await findOwnerLeadAcquisitionProvenance(batchId);
    if (raced && sameProvenance(raced, input)) return { recorded: false };
    throw new OwnerLeadAcquisitionProvenanceConflictError();
  }

  return { recorded: true };
}
