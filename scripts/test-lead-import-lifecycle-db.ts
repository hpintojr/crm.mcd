import { strict as assert } from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { assertDatabaseIntegrationTestEnvironment } from "../src/lib/db-integration-test-guard";

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function runId(prefix: string, suffix: string) {
  return `${prefix}:${suffix}`;
}

async function main() {
  // This must run before importing server-only services or the Prisma singleton.
  assertDatabaseIntegrationTestEnvironment();

  const prefix = `MCD_DBTEST_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
  const { db } = await import("../src/lib/db");
  const {
    createLeadImportBatchWithConcurrencyRecovery,
    LeadImportBatchReplayConflictError,
    uploadLeadImportRowsWithConcurrencyRecovery,
  } = await import("../src/lib/lead-import-concurrency");
  const { LeadImportBatchStateError } = await import("../src/lib/lead-import-batch");
  const { previewImportWithAudit, submitImportWithAudit } = await import("../src/lib/import-audit-service");
  const { buildLeadDedupeKey, normalizePhone } = await import("../src/lib/lead-normalization");

  const primaryRunId = runId(prefix, "PRIMARY");
  const reviewRunId = runId(prefix, "REVIEW");
  const primaryManifestHash = sha256(`${prefix}:primary-manifest`);
  const reviewManifestHash = sha256(`${prefix}:review-manifest`);
  const keyId = "db-integration-test-key";

  const batchInput = (localRunId: string, manifestHash: string) => ({
    localRunId,
    operatorName: "Database Integration Harness",
    sourceAdapter: "TEST_HARNESS",
    sourceAdapterVersion: "1.0.0",
    manifestHash,
    clientVersion: "1.0.0",
  });

  const envelope = (localRunId: string, rowNumber: number, row: Record<string, unknown>) => {
    const rowHash = sha256(row);
    return {
      rowNumber,
      rowHash,
      idempotencyKey: `${localRunId}:${rowNumber}:${rowHash}`,
      row,
    };
  };

  async function cleanup() {
    const batches = await db.leadImportBatch.findMany({
      where: { localRunId: { startsWith: prefix } },
      select: { id: true, rows: { select: { id: true } } },
    });
    const batchIds = batches.map((batch) => batch.id);
    const rowIds = batches.flatMap((batch) => batch.rows.map((row) => row.id));
    const leads = await db.lead.findMany({
      where: { company: { startsWith: prefix } },
      select: { id: true },
    });
    const leadIds = leads.map((lead) => lead.id);
    const entityIds = [...batchIds, ...rowIds, ...leadIds];

    if (entityIds.length) {
      await db.auditLog.deleteMany({ where: { entityId: { in: entityIds } } });
    }
    if (leadIds.length) {
      await db.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } });
    }
    await db.leadSuppression.deleteMany({ where: { reason: prefix } });
    await db.leadImportBatch.deleteMany({ where: { localRunId: { startsWith: prefix } } });
    await db.lead.deleteMany({ where: { company: { startsWith: prefix } } });
  }

  try {
    const suppressedPhone = "555-010-2001";
    const suppressedIdentifier = normalizePhone(suppressedPhone);
    assert.ok(suppressedIdentifier);
    await db.leadSuppression.create({
      data: { identifier: suppressedIdentifier, type: "DNC", reason: prefix },
    });

    const cleanRow = {
      company: `${prefix} Clean`,
      email: `clean-${prefix.toLowerCase()}@example.test`,
      businessPhone: "555-010-2000",
      originalSource: "PPC",
      intakeMethod: "API_IMPORT",
    };
    const suppressedRow = {
      company: `${prefix} Suppressed`,
      email: `suppressed-${prefix.toLowerCase()}@example.test`,
      businessPhone: suppressedPhone,
      originalSource: "PPC",
      intakeMethod: "API_IMPORT",
    };
    const primaryRows = [
      envelope(primaryRunId, 1, cleanRow),
      envelope(primaryRunId, 2, cleanRow),
      envelope(primaryRunId, 3, suppressedRow),
    ];

    const createdPrimary = await createLeadImportBatchWithConcurrencyRecovery(
      batchInput(primaryRunId, primaryManifestHash),
      keyId,
    );
    assert.equal(createdPrimary.created, true);

    const exactBatchRetry = await createLeadImportBatchWithConcurrencyRecovery(
      batchInput(primaryRunId, primaryManifestHash),
      keyId,
    );
    assert.equal(exactBatchRetry.created, false);
    assert.equal(exactBatchRetry.batch.id, createdPrimary.batch.id);

    await assert.rejects(
      () => createLeadImportBatchWithConcurrencyRecovery(batchInput(primaryRunId, sha256(`${prefix}:changed-manifest`)), keyId),
      LeadImportBatchReplayConflictError,
    );

    const stagedPrimary = await uploadLeadImportRowsWithConcurrencyRecovery(createdPrimary.batch.id, { rows: primaryRows });
    assert.equal(stagedPrimary.rows.length, 3);
    const exactRowRetry = await uploadLeadImportRowsWithConcurrencyRecovery(createdPrimary.batch.id, { rows: primaryRows });
    assert.equal(exactRowRetry.rows.length, 3);

    await assert.rejects(
      () => uploadLeadImportRowsWithConcurrencyRecovery(createdPrimary.batch.id, {
        rows: [{ ...primaryRows[0], row: { ...cleanRow, company: `${prefix} Changed Replay` } }],
      }),
      LeadImportBatchStateError,
    );

    const previewedPrimary = await previewImportWithAudit(createdPrimary.batch.id);
    assert.equal(previewedPrimary.status, "PREVIEWED");
    const primaryPreviewStatuses = new Map(previewedPrimary.rows.map((row) => [row.rowNumber, row.status]));
    assert.equal(primaryPreviewStatuses.get(1), "VALID");
    assert.equal(primaryPreviewStatuses.get(2), "DUPLICATE_IN_BATCH");
    assert.equal(primaryPreviewStatuses.get(3), "SUPPRESSED");

    const completedPrimary = await submitImportWithAudit(createdPrimary.batch.id, {
      operatorName: "Database Integration Harness",
      approvalRecordedAt: new Date().toISOString(),
      approvalReference: `${prefix}:PRIMARY_APPROVED`,
    });
    assert.equal(completedPrimary.status, "COMPLETED");
    assert.equal(completedPrimary.insertedCount, 1);
    const primaryFinalStatuses = new Map(completedPrimary.rows.map((row) => [row.rowNumber, row.status]));
    assert.equal(primaryFinalStatuses.get(1), "IMPORTED");
    assert.equal(primaryFinalStatuses.get(2), "DUPLICATE_IN_BATCH");
    assert.equal(primaryFinalStatuses.get(3), "SUPPRESSED");

    const cleanDedupeKey = buildLeadDedupeKey(cleanRow);
    const importedLead = await db.lead.findUnique({ where: { dedupeKey: cleanDedupeKey } });
    assert.ok(importedLead);
    assert.equal(importedLead.lifecycle, "PENDING_REVIEW");
    assert.equal(importedLead.ownerAgentId, null);
    const leadCreatedActivityCount = await db.leadActivity.count({
      where: { leadId: importedLead.id, type: "LEAD_CREATED" },
    });
    assert.equal(leadCreatedActivityCount, 1);
    const primaryAuditCount = await db.auditLog.count({
      where: { entityId: { in: [createdPrimary.batch.id, importedLead.id, ...completedPrimary.rows.map((row) => row.id)] } },
    });
    assert.ok(primaryAuditCount >= 5);

    await assert.rejects(
      () => uploadLeadImportRowsWithConcurrencyRecovery(createdPrimary.batch.id, { rows: primaryRows }),
      LeadImportBatchStateError,
    );

    const existingRow = {
      company: `${prefix} Existing`,
      email: `existing-${prefix.toLowerCase()}@example.test`,
      businessPhone: "555-010-3000",
      originalSource: "PPC",
      intakeMethod: "API_IMPORT",
    };
    const existingDedupeKey = buildLeadDedupeKey(existingRow);
    const existingLead = await db.lead.create({
      data: {
        company: existingRow.company,
        email: existingRow.email,
        businessPhone: existingRow.businessPhone,
        normalizedPhone: normalizePhone(existingRow.businessPhone),
        source: "PPC",
        originalSource: "PPC",
        intakeMethod: "API_IMPORT",
        lifecycle: "PENDING_REVIEW",
        pool: "COLD",
        dedupeKey: existingDedupeKey,
      },
    });

    const secondCleanRow = {
      company: `${prefix} Second Clean`,
      email: `second-clean-${prefix.toLowerCase()}@example.test`,
      businessPhone: "555-010-3001",
      originalSource: "PPC",
      intakeMethod: "API_IMPORT",
    };
    const reviewRows = [
      envelope(reviewRunId, 1, existingRow),
      envelope(reviewRunId, 2, secondCleanRow),
    ];
    const createdReview = await createLeadImportBatchWithConcurrencyRecovery(
      batchInput(reviewRunId, reviewManifestHash),
      keyId,
    );
    await uploadLeadImportRowsWithConcurrencyRecovery(createdReview.batch.id, { rows: reviewRows });
    const previewedReview = await previewImportWithAudit(createdReview.batch.id);
    assert.equal(previewedReview.status, "REVIEW_REQUIRED");
    const reviewPreviewStatuses = new Map(previewedReview.rows.map((row) => [row.rowNumber, row.status]));
    assert.equal(reviewPreviewStatuses.get(1), "POSSIBLE_EXISTING_DUPLICATE");
    assert.equal(reviewPreviewStatuses.get(2), "VALID");

    const submittedReview = await submitImportWithAudit(createdReview.batch.id, {
      operatorName: "Database Integration Harness",
      approvalRecordedAt: new Date().toISOString(),
      approvalReference: `${prefix}:REVIEW_APPROVED`,
    });
    assert.equal(submittedReview.status, "PARTIALLY_ACCEPTED");
    assert.equal(submittedReview.insertedCount, 1);
    const reviewFinalStatuses = new Map(submittedReview.rows.map((row) => [row.rowNumber, row.status]));
    assert.equal(reviewFinalStatuses.get(1), "POSSIBLE_EXISTING_DUPLICATE");
    assert.equal(reviewFinalStatuses.get(2), "IMPORTED");
    const duplicateRow = submittedReview.rows.find((row) => row.rowNumber === 1);
    assert.equal(duplicateRow?.existingLeadId, existingLead.id);

    console.log("Lead-import database lifecycle harness passed.");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Lead-import database lifecycle harness failed.", error);
  process.exitCode = 1;
});
