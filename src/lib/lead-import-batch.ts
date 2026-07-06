import "server-only";

import { db } from "@/lib/db";
import type { LeadImportBatch, LeadImportRow, Prisma } from "@prisma/client";
import {
  leadImportRowEnvelopeSchema,
  uploadLeadImportRowsPayloadSchema,
  type LeadImportRowEnvelope,
} from "@/lib/lead-import-payload-schema";
import type {
  CreateLeadImportBatchInput,
  LeadImportBatchStatus as ContractBatchStatus,
  LeadImportRowStatus as ContractRowStatus,
} from "@/lib/lead-import-contract";
import {
  assertLeadImportBatchTransition,
  mayTransitionLeadImportBatch,
  recommendLeadImportBatchStatus,
  summarizeLeadImportRows,
} from "@/lib/lead-import-workflow";
import { buildLeadDedupeKey, normalizeEmail, normalizePhone } from "@/lib/lead-normalization";
import {
  defaultPoolForSource,
  defaultWebsiteOpportunityStatus,
  websiteStatusFromRecordedUrl,
  type LeadImportRow as LeadImportRowPayload,
} from "@/lib/lead-taxonomy";

/**
 * Durable service layer for the signed mcd_lead_ops batch import API.
 *
 * Rows are staged and previewed before an operator records batch approval.
 * Only rows promoted from VALID to APPROVED by that recorded batch approval
 * are eligible to create Lead, LeadActivity, and AuditLog records.
 */

const SYSTEM_ACTOR_ROLE = "LEAD_IMPORT_API";

type ImportOutcome = "IMPORTED" | "DUPLICATE";

export class LeadImportBatchNotFoundError extends Error {
  constructor(batchId: string) {
    super(`Lead import batch ${batchId} was not found.`);
  }
}

export class LeadImportBatchStateError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function asContractBatchStatus(status: string): ContractBatchStatus {
  return status as ContractBatchStatus;
}

function asContractRowStatus(status: string): ContractRowStatus {
  return status as ContractRowStatus;
}

export type LeadImportBatchWithRows = LeadImportBatch & { rows: LeadImportRow[] };

export function serializeLeadImportBatch(batch: LeadImportBatchWithRows) {
  const statuses = batch.rows.map((row) => asContractRowStatus(row.status));
  const counts = summarizeLeadImportRows(statuses);

  return {
    batch: {
      batchId: batch.id,
      localRunId: batch.localRunId,
      status: asContractBatchStatus(batch.status),
      counts,
      approvalReference: batch.approvalReference ?? null,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
    },
    records: batch.rows
      .sort((a, b) => a.rowNumber - b.rowNumber)
      .map((row) => ({
        rowNumber: row.rowNumber,
        idempotencyKey: row.idempotencyKey,
        status: asContractRowStatus(row.status),
        issues: Array.isArray(row.issues) ? (row.issues as string[]) : [],
        resolvedLeadId: row.createdLeadId ?? row.existingLeadId ?? null,
      })),
  };
}

async function loadBatchWithRows(batchId: string): Promise<LeadImportBatchWithRows> {
  const batch = await db.leadImportBatch.findUnique({
    where: { id: batchId },
    include: { rows: true },
  });
  if (!batch) throw new LeadImportBatchNotFoundError(batchId);
  return batch;
}

export async function createLeadImportBatch(input: CreateLeadImportBatchInput, keyId: string) {
  const existing = await db.leadImportBatch.findUnique({
    where: { localRunId: input.localRunId },
    include: { rows: true },
  });
  if (existing) return { batch: existing, created: false };

  const created = await db.leadImportBatch.create({
    data: {
      localRunId: input.localRunId,
      operatorName: input.operatorName,
      sourceAdapter: input.sourceAdapter,
      sourceAdapterVersion: input.sourceAdapterVersion,
      manifestHash: input.manifestHash,
      clientVersion: input.clientVersion,
      keyId,
      status: "DRAFT",
    },
    include: { rows: true },
  });

  return { batch: created, created: true };
}

export async function uploadLeadImportRows(batchId: string, rawBody: unknown) {
  const batch = await loadBatchWithRows(batchId);

  if (!["DRAFT", "ROWS_RECEIVED"].includes(batch.status)) {
    throw new LeadImportBatchStateError(
      `Cannot upload rows to batch ${batchId} while it is in status ${batch.status}.`
    );
  }

  const payload = uploadLeadImportRowsPayloadSchema.parse(rawBody);
  const existingByRowNumber = new Map(batch.rows.map((row) => [row.rowNumber, row]));
  const existingByIdempotencyKey = new Map(batch.rows.map((row) => [row.idempotencyKey, row]));

  // Validate all replay identities before any write, so an invalid replay cannot
  // leave a partially uploaded request behind.
  for (const envelope of payload.rows as LeadImportRowEnvelope[]) {
    const priorAtRowNumber = existingByRowNumber.get(envelope.rowNumber);
    const priorWithIdempotencyKey = existingByIdempotencyKey.get(envelope.idempotencyKey);

    if (priorAtRowNumber && priorAtRowNumber.idempotencyKey !== envelope.idempotencyKey) {
      throw new LeadImportBatchStateError(
        `Row ${envelope.rowNumber} already exists in batch ${batchId} with a different idempotency key.`
      );
    }

    if (priorWithIdempotencyKey && priorWithIdempotencyKey.rowNumber !== envelope.rowNumber) {
      throw new LeadImportBatchStateError(
        `Idempotency key ${envelope.idempotencyKey} is already associated with row ${priorWithIdempotencyKey.rowNumber}.`
      );
    }
  }

  for (const envelope of payload.rows as LeadImportRowEnvelope[]) {
    await db.leadImportRow.upsert({
      where: {
        batchId_idempotencyKey: { batchId, idempotencyKey: envelope.idempotencyKey },
      },
      create: {
        batchId,
        rowNumber: envelope.rowNumber,
        rowHash: envelope.rowHash,
        idempotencyKey: envelope.idempotencyKey,
        payload: envelope.row as unknown as Prisma.InputJsonValue,
        status: "RECEIVED",
      },
      update: {
        rowHash: envelope.rowHash,
        payload: envelope.row as unknown as Prisma.InputJsonValue,
        status: "RECEIVED",
        issues: [] as unknown as Prisma.InputJsonValue,
        dedupeKey: null,
        existingLeadId: null,
        createdLeadId: null,
      },
    });
  }

  const rowCount = await db.leadImportRow.count({ where: { batchId } });

  if (mayTransitionLeadImportBatch(asContractBatchStatus(batch.status), "ROWS_RECEIVED")) {
    await db.leadImportBatch.update({
      where: { id: batchId },
      data: { status: "ROWS_RECEIVED", rowCount },
    });
  } else {
    await db.leadImportBatch.update({ where: { id: batchId }, data: { rowCount } });
  }

  return loadBatchWithRows(batchId);
}

export async function previewLeadImportBatch(batchId: string) {
  const batch = await loadBatchWithRows(batchId);

  if (!["ROWS_RECEIVED", "PREVIEWED", "REVIEW_REQUIRED"].includes(batch.status)) {
    throw new LeadImportBatchStateError(
      `Cannot preview batch ${batchId} while it is in status ${batch.status}.`
    );
  }

  const seenDedupeKeys = new Set<string>();
  const updatedStatuses: ContractRowStatus[] = [];

  for (const row of batch.rows.sort((a, b) => a.rowNumber - b.rowNumber)) {
    const parsed = leadImportRowEnvelopeSchema.shape.row.safeParse(row.payload);
    const issues: string[] = [];
    let status: ContractRowStatus = "REJECTED";
    let dedupeKey: string | null = null;
    let existingLeadId: string | null = null;

    if (!parsed.success) {
      issues.push(...parsed.error.issues.map((issue) => issue.message));
    } else {
      const record = parsed.data as LeadImportRowPayload;
      dedupeKey = buildLeadDedupeKey({
        company: record.company,
        email: record.email,
        businessPhone: record.businessPhone,
        website: record.website,
      });

      if (seenDedupeKeys.has(dedupeKey)) {
        status = "DUPLICATE_IN_BATCH";
        issues.push("Duplicate of an earlier row in this import batch.");
      } else {
        seenDedupeKeys.add(dedupeKey);
        const existingLead = await db.lead.findFirst({ where: { dedupeKey } });

        if (existingLead) {
          status = "POSSIBLE_EXISTING_DUPLICATE";
          existingLeadId = existingLead.id;
          issues.push(`Matches existing lead ${existingLead.id} on company/phone/email/website.`);
        } else {
          const normalizedEmail = normalizeEmail(record.email);
          const normalizedPhone = normalizePhone(record.businessPhone);
          const identifiers = [normalizedEmail, normalizedPhone].filter((value): value is string => Boolean(value));
          const suppressed = identifiers.length
            ? await db.leadSuppression.findFirst({
                where: { active: true, identifier: { in: identifiers } },
              })
            : null;

          if (suppressed) {
            status = "SUPPRESSED";
            issues.push(`Matches an active suppression (${suppressed.type}).`);
          } else {
            status = "VALID";
          }
        }
      }
    }

    await db.leadImportRow.update({
      where: { id: row.id },
      data: {
        status,
        issues: issues as unknown as Prisma.InputJsonValue,
        dedupeKey,
        existingLeadId,
        createdLeadId: null,
      },
    });
    updatedStatuses.push(status);
  }

  const nextStatus = recommendLeadImportBatchStatus(updatedStatuses);
  const duplicateCount = updatedStatuses.filter((status) =>
    ["DUPLICATE_IN_BATCH", "POSSIBLE_EXISTING_DUPLICATE"].includes(status)
  ).length;
  const suppressedCount = updatedStatuses.filter((status) => status === "SUPPRESSED").length;
  const rejectedCount = updatedStatuses.filter((status) => status === "REJECTED").length;

  await db.leadImportBatch.update({
    where: { id: batchId },
    data: { status: nextStatus, duplicateCount, rejectedCount, suppressedCount },
  });

  return loadBatchWithRows(batchId);
}

export async function submitLeadImportBatch(
  batchId: string,
  input: { operatorName: string; approvalRecordedAt: string; approvalReference: string }
) {
  const batch = await loadBatchWithRows(batchId);
  const currentStatus = asContractBatchStatus(batch.status);

  try {
    assertLeadImportBatchTransition(currentStatus, "APPROVED_FOR_SUBMISSION");
  } catch (error) {
    throw new LeadImportBatchStateError((error as Error).message);
  }

  await db.$transaction(async (tx) => {
    await tx.leadImportBatch.update({
      where: { id: batchId },
      data: {
        status: "APPROVED_FOR_SUBMISSION",
        approvalRecordedAt: new Date(input.approvalRecordedAt),
        approvalReference: input.approvalReference,
        operatorName: input.operatorName,
      },
    });

    await tx.leadImportRow.updateMany({
      where: { batchId, status: "VALID" },
      data: { status: "APPROVED" },
    });

    await tx.leadImportBatch.update({
      where: { id: batchId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
  });

  const submittedBatch = await loadBatchWithRows(batchId);
  const importableRows = submittedBatch.rows.filter((row) => row.status === "APPROVED");
  let insertedCount = 0;
  let importErrorCount = 0;

  for (const row of importableRows) {
    try {
      const outcome = await db.$transaction(async (tx): Promise<ImportOutcome> => {
        const parsed = leadImportRowEnvelopeSchema.shape.row.parse(row.payload);
        const record = parsed as LeadImportRowPayload;
        const dedupeKey = buildLeadDedupeKey({
          company: record.company,
          email: record.email,
          businessPhone: record.businessPhone,
          website: record.website,
        });

        const clash = await tx.lead.findFirst({ where: { dedupeKey } });
        if (clash) {
          await tx.leadImportRow.update({
            where: { id: row.id },
            data: {
              status: "POSSIBLE_EXISTING_DUPLICATE",
              issues: [`Matches existing lead ${clash.id} discovered at submit time.`] as unknown as Prisma.InputJsonValue,
              dedupeKey,
              existingLeadId: clash.id,
            },
          });
          return "DUPLICATE";
        }

        const websiteStatus = websiteStatusFromRecordedUrl(record.website);
        const websiteOpportunityStatus = defaultWebsiteOpportunityStatus(websiteStatus);
        const pool = defaultPoolForSource(record.originalSource);

        const lead = await tx.lead.create({
          data: {
            company: record.company,
            contactFirstName: record.contactFirstName,
            contactLastName: record.contactLastName,
            email: record.email,
            businessPhone: record.businessPhone ?? "",
            normalizedPhone: normalizePhone(record.businessPhone),
            website: record.website,
            industry: record.industry,
            city: record.city,
            state: record.state,
            country: record.country,
            timezone: record.timezone,
            source: record.originalSource,
            originalSource: record.originalSource,
            sourceDetail: record.sourceDetail,
            sourceRecordUrl: record.sourceRecordUrl,
            campaignName: record.campaignName,
            campaignExternalId: record.campaignExternalId,
            intakeMethod: record.intakeMethod,
            referrerName: record.referrerName,
            referrerType: record.referrerType,
            referrerLeadId: record.referrerLeadId,
            utmSource: record.utmSource,
            utmMedium: record.utmMedium,
            utmCampaign: record.utmCampaign,
            utmContent: record.utmContent,
            utmTerm: record.utmTerm,
            websiteStatus,
            websiteOpportunityStatus,
            dedupeKey,
            pool,
            isReferral: record.originalSource === "REFERRAL",
            referralSource: record.originalSource === "REFERRAL" ? (record.referrerName ?? null) : null,
          },
        });

        await tx.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "LEAD_CREATED",
            metadata: { batchId, rowId: row.id, source: "mcd_lead_ops" } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.auditLog.create({
          data: {
            actorUserId: null,
            actorRole: SYSTEM_ACTOR_ROLE,
            actionType: "LEAD_IMPORTED_TO_REVIEW",
            entityType: "Lead",
            entityId: lead.id,
            reason: `Batch ${batchId} submitted by ${input.operatorName} (ref ${input.approvalReference}).`,
            metadata: { batchId, rowId: row.id } as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.leadImportRow.update({
          where: { id: row.id },
          data: { status: "IMPORTED", createdLeadId: lead.id, existingLeadId: null, dedupeKey },
        });

        return "IMPORTED";
      });

      if (outcome === "IMPORTED") insertedCount += 1;
    } catch {
      importErrorCount += 1;
      await db.leadImportRow.update({
        where: { id: row.id },
        data: {
          status: "IMPORT_ERROR",
          issues: ["Unexpected error while committing this row."] as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  await db.auditLog.create({
    data: {
      actorUserId: null,
      actorRole: SYSTEM_ACTOR_ROLE,
      actionType: "LEAD_IMPORT_BATCH_SUBMITTED",
      entityType: "LeadImportBatch",
      entityId: batchId,
      reason: `Submitted by ${input.operatorName}, approval ref ${input.approvalReference}.`,
      metadata: { insertedCount, importErrorCount } as unknown as Prisma.InputJsonValue,
    },
  });

  const finalBatch = await loadBatchWithRows(batchId);
  const finalStatuses = finalBatch.rows.map((row) => asContractRowStatus(row.status));
  const needsReview = finalStatuses.some((status) =>
    ["REVIEW_REQUIRED", "POSSIBLE_EXISTING_DUPLICATE", "PENDING_ADMIN_REVIEW"].includes(status)
  );
  const hasErrors = finalStatuses.some((status) => status === "IMPORT_ERROR");

  const finalStatus: ContractBatchStatus = hasErrors
    ? "RECONCILIATION_REQUIRED"
    : needsReview
      ? "PARTIALLY_ACCEPTED"
      : "COMPLETED";

  await db.leadImportBatch.update({
    where: { id: batchId },
    data: {
      status: finalStatus,
      insertedCount,
      completedAt: finalStatus === "COMPLETED" ? new Date() : null,
    },
  });

  return loadBatchWithRows(batchId);
}

export async function getLeadImportBatchStatus(batchId: string) {
  return loadBatchWithRows(batchId);
}
