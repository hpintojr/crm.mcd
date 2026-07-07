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

export class OwnerLeadAcquisitionProvenanceConflictError extends Error {
  constructor() {
    super("An immutable owner acquisition record already exists for this import batch.");
  }
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
 * Private, signed-machine write path. It intentionally creates no AuditLog
 * row and never returns the sensitive values. Exact retries are idempotent;
 * changed values are a hard conflict.
 */
export async function recordOwnerLeadAcquisitionProvenance(
  batchId: string,
  input: OwnerLeadAcquisitionProvenanceInput,
) {
  const batch = await db.leadImportBatch.findUnique({
    where: { id: batchId },
    select: { id: true },
  });
  if (!batch) throw new Error("Lead import batch was not found.");

  const existing = await db.$queryRaw<OwnerLeadAcquisitionProvenance[]>(Prisma.sql`
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
  const prior = existing[0];

  if (prior) {
    const same =
      prior.sourceCode === input.sourceCode &&
      prior.acquisitionReference === input.acquisitionReference &&
      prior.providerName === (input.providerName ?? null);
    if (!same) throw new OwnerLeadAcquisitionProvenanceConflictError();
    return { recorded: false };
  }

  const now = new Date();
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

  return { recorded: true };
}
