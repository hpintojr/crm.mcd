import "server-only";

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  importPreviewAuditReason,
  importRowAuditMetadata,
  shouldWritePreviewAudit,
} from "@/lib/import-audit-outcomes";
import {
  getLeadImportBatchStatus,
  previewLeadImportBatch,
  submitLeadImportBatch,
  type LeadImportBatchWithRows,
} from "@/lib/lead-import-batch";
import type { LeadImportBatchStatus, LeadImportRowStatus } from "@/lib/lead-import-contract";
import { leadImportRowEnvelopeSchema } from "@/lib/lead-import-payload-schema";
import { buildLeadDedupeKey } from "@/lib/lead-normalization";

const ACTOR_ROLE = "LEAD_IMPORT_API";
type SubmitInput = { operatorName: string; approvalRecordedAt: string; approvalReference: string };

type Row = LeadImportBatchWithRows["rows"][number];

function statuses(batch: LeadImportBatchWithRows) {
  return new Map(batch.rows.map((row) => [row.id, row.status as LeadImportRowStatus]));
}

function finalBatchStatus(rows: readonly Row[]): LeadImportBatchStatus {
  const rowStatuses = rows.map((row) => row.status as LeadImportRowStatus);
  if (rowStatuses.some((status) => status === "IMPORT_ERROR")) return "RECONCILIATION_REQUIRED";
  if (rowStatuses.some((status) => ["REVIEW_REQUIRED", "POSSIBLE_EXISTING_DUPLICATE", "PENDING_ADMIN_REVIEW"].includes(status))) {
    return "PARTIALLY_ACCEPTED";
  }
  return "COMPLETED";
}

async function writeAudit(batchId: string, row: Row, actionType: string, reason: string) {
  const status = row.status as LeadImportRowStatus;

  try {
    await db.auditLog.create({
      data: {
        actorUserId: null,
        actorRole: ACTOR_ROLE,
        actionType,
        entityType: "LeadImportRow",
        entityId: row.id,
        reason,
        metadata: importRowAuditMetadata({
          batchId,
          rowId: row.id,
          rowNumber: row.rowNumber,
          status,
        }) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch {
    try {
      await db.integrationError.create({
        data: {
          source: "LEAD_IMPORT_AUDIT",
          refId: `${batchId}:${row.id}`,
          message: "Import row outcome could not be audited.",
          payload: { batchId, rowId: row.id, outcome: status } as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Keep the durable import result intact if observability storage is unavailable.
    }
  }
}

async function reconcileConcurrentSubmitOutcomes(batchId: string, batch: LeadImportBatchWithRows) {
  let reconciledAny = false;

  for (const row of batch.rows) {
    if (row.status !== "IMPORT_ERROR") continue;

    // A concurrent submit of this same batch can observe the Lead unique-key
    // collision after the winning transaction already recorded createdLeadId.
    // Preserve that durable success instead of downgrading it to an error.
    if (row.createdLeadId) {
      const createdLead = await db.lead.findUnique({ where: { id: row.createdLeadId }, select: { id: true } });
      if (createdLead) {
        await db.leadImportRow.update({
          where: { id: row.id },
          data: {
            status: "IMPORTED",
            issues: [] as unknown as Prisma.InputJsonValue,
            existingLeadId: null,
          },
        });
        reconciledAny = true;
        continue;
      }
    }

    const parsed = leadImportRowEnvelopeSchema.shape.row.safeParse(row.payload);
    if (!parsed.success) continue;

    const dedupeKey = buildLeadDedupeKey({
      company: parsed.data.company,
      email: parsed.data.email,
      businessPhone: parsed.data.businessPhone,
      website: parsed.data.website,
    });
    const existingLead = await db.lead.findFirst({ where: { dedupeKey } });
    if (!existingLead) continue;

    await db.leadImportRow.update({
      where: { id: row.id },
      data: {
        status: "POSSIBLE_EXISTING_DUPLICATE",
        issues: ["An equivalent Lead was committed concurrently; this row was not imported twice."] as unknown as Prisma.InputJsonValue,
        dedupeKey,
        existingLeadId: existingLead.id,
        createdLeadId: null,
      },
    });
    reconciledAny = true;
  }

  if (!reconciledAny) return batch;

  const reconciled = await getLeadImportBatchStatus(batchId);
  const rowStatuses = reconciled.rows.map((row) => row.status as LeadImportRowStatus);
  const duplicateCount = rowStatuses.filter((status) => ["DUPLICATE_IN_BATCH", "POSSIBLE_EXISTING_DUPLICATE"].includes(status)).length;
  const suppressedCount = rowStatuses.filter((status) => status === "SUPPRESSED").length;
  const rejectedCount = rowStatuses.filter((status) => status === "REJECTED").length;
  const insertedCount = rowStatuses.filter((status) => status === "IMPORTED").length;
  const status = finalBatchStatus(reconciled.rows);

  await db.leadImportBatch.update({
    where: { id: batchId },
    data: {
      status,
      insertedCount,
      duplicateCount,
      suppressedCount,
      rejectedCount,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });

  return getLeadImportBatchStatus(batchId);
}

export async function previewImportWithAudit(batchId: string) {
  const before = statuses(await getLeadImportBatchStatus(batchId));
  const batch = await previewLeadImportBatch(batchId);

  for (const row of batch.rows) {
    const status = row.status as LeadImportRowStatus;
    if (before.get(row.id) === status || !shouldWritePreviewAudit(status)) continue;
    await writeAudit(batchId, row, "LEAD_IMPORT_ROW_PREVIEW_OUTCOME", importPreviewAuditReason(status));
  }

  return batch;
}

export async function submitImportWithAudit(batchId: string, input: SubmitInput) {
  const before = statuses(await getLeadImportBatchStatus(batchId));
  const submitted = await submitLeadImportBatch(batchId, input);
  const batch = await reconcileConcurrentSubmitOutcomes(batchId, submitted);

  for (const row of batch.rows) {
    const status = row.status as LeadImportRowStatus;
    if (before.get(row.id) === status) continue;

    if (status === "IMPORTED") {
      await writeAudit(batchId, row, "LEAD_IMPORT_ROW_IMPORTED", "Row created a Lead in pending review.");
    } else if (status === "POSSIBLE_EXISTING_DUPLICATE") {
      await writeAudit(batchId, row, "LEAD_IMPORT_ROW_DUPLICATE_AT_SUBMIT", "Row was not imported because an equivalent Lead exists.");
    } else if (status === "IMPORT_ERROR") {
      await writeAudit(batchId, row, "LEAD_IMPORT_ROW_IMPORT_ERROR", "Row requires reconciliation.");
    }
  }

  return batch;
}
