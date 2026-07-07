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
import type { LeadImportRowStatus } from "@/lib/lead-import-contract";

const ACTOR_ROLE = "LEAD_IMPORT_API";
type SubmitInput = { operatorName: string; approvalRecordedAt: string; approvalReference: string };

type Row = LeadImportBatchWithRows["rows"][number];

function statuses(batch: LeadImportBatchWithRows) {
  return new Map(batch.rows.map((row) => [row.id, row.status as LeadImportRowStatus]));
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
  const batch = await submitLeadImportBatch(batchId, input);

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
