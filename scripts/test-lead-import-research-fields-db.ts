import { strict as assert } from "node:assert";
import { createHash, randomUUID } from "node:crypto";
import { assertDatabaseIntegrationTestEnvironment } from "../src/lib/db-integration-test-guard";

function sha256(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  // Must run before importing server-only services or the Prisma singleton.
  assertDatabaseIntegrationTestEnvironment();

  const prefix = `MCD_RESEARCH_DBTEST_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
  const { db } = await import("../src/lib/db");
  const { createLeadImportBatchWithConcurrencyRecovery, uploadLeadImportRowsWithConcurrencyRecovery } = await import("../src/lib/lead-import-concurrency");
  const { previewImportWithAudit, submitImportWithAudit } = await import("../src/lib/import-audit-service");
  const { recordOwnerLeadAcquisitionProvenance } = await import("../src/lib/owner-lead-acquisition-provenance");

  const localRunId = `${prefix}:RUN`;
  const keyId = "research-db-integration-key";
  const observedAt = "2026-07-07T19:00:00.000Z";
  const privateSourceCode = "RAW072026";
  const privateReference = "OP_ACQ_072026_001";
  const privateProvider = "Private Test Provider";

  const row = {
    company: `${prefix} Roofing`,
    email: `${prefix.toLowerCase()}@example.test`,
    businessPhone: "555-010-4512",
    originalSource: "OTHER",
    sourceDetail: "LICENSED_PROVIDER_DATA",
    intakeMethod: "API_IMPORT",
    businessAddress: "101 Main Street, Example City, CA 90000",
    googleRating: 4.3,
    googleRatingObservedAt: observedAt,
    googleMapsUrl: "https://maps.google.com/?q=Example+Roofing",
  };
  const rowHash = sha256(row);
  const envelope = {
    rowNumber: 1,
    rowHash,
    idempotencyKey: `${localRunId}:1:${rowHash}`,
    row,
  };

  let batchId: string | null = null;
  let leadId: string | null = null;

  async function cleanup() {
    if (batchId) {
      const rows = await db.leadImportRow.findMany({ where: { batchId }, select: { id: true, createdLeadId: true } });
      const rowIds = rows.map((item) => item.id);
      const importedLeadIds = rows.map((item) => item.createdLeadId).filter((id): id is string => Boolean(id));
      await db.auditLog.deleteMany({ where: { entityId: { in: [batchId, ...rowIds, ...importedLeadIds] } } });
      await db.leadImportBatch.delete({ where: { id: batchId } }).catch(() => undefined);
      if (importedLeadIds.length) await db.lead.deleteMany({ where: { id: { in: importedLeadIds } } });
    }
    if (leadId) await db.lead.delete({ where: { id: leadId } }).catch(() => undefined);
  }

  try {
    const created = await createLeadImportBatchWithConcurrencyRecovery({
      localRunId,
      operatorName: "Research Field Integration Harness",
      sourceAdapter: "TEST_HARNESS",
      sourceAdapterVersion: "1.0.0",
      manifestHash: sha256(`${prefix}:manifest`),
      clientVersion: "1.0.0",
    }, keyId);
    batchId = created.batch.id;
    assert.equal(created.created, true);

    const firstProvenanceWrite = await recordOwnerLeadAcquisitionProvenance(batchId, {
      sourceCode: privateSourceCode,
      acquisitionReference: privateReference,
      providerName: privateProvider,
    });
    assert.equal(firstProvenanceWrite.recorded, true);

    const exactProvenanceRetry = await recordOwnerLeadAcquisitionProvenance(batchId, {
      sourceCode: privateSourceCode,
      acquisitionReference: privateReference,
      providerName: privateProvider,
    });
    assert.equal(exactProvenanceRetry.recorded, false);

    await uploadLeadImportRowsWithConcurrencyRecovery(batchId, { rows: [envelope] });
    const preview = await previewImportWithAudit(batchId);
    assert.equal(preview.status, "PREVIEWED");
    assert.equal(preview.rows[0]?.status, "VALID");

    const submitted = await submitImportWithAudit(batchId, {
      operatorName: "Research Field Integration Harness",
      approvalRecordedAt: new Date().toISOString(),
      approvalReference: `${prefix}:APPROVED`,
    });
    assert.equal(submitted.status, "COMPLETED");
    assert.equal(submitted.rows[0]?.status, "IMPORTED");
    leadId = submitted.rows[0]?.createdLeadId ?? null;
    assert.ok(leadId);

    const lead = await db.lead.findUnique({
      where: { id: leadId as string },
      select: {
        businessAddress: true,
        googleRating: true,
        googleRatingObservedAt: true,
        googleMapsUrl: true,
        sourceDetail: true,
      },
    });
    assert.ok(lead);
    assert.equal(lead.businessAddress, row.businessAddress);
    assert.equal(lead.googleRating?.toString(), "4.3");
    assert.equal(lead.googleRatingObservedAt?.toISOString(), observedAt);
    assert.equal(lead.googleMapsUrl, row.googleMapsUrl);
    assert.equal(lead.sourceDetail, "LICENSED_PROVIDER_DATA");

    const provenance = await db.ownerLeadAcquisitionProvenance.findUnique({
      where: { leadImportBatchId: batchId },
      select: { sourceCode: true, acquisitionReference: true, providerName: true },
    });
    assert.deepEqual(provenance, {
      sourceCode: privateSourceCode,
      acquisitionReference: privateReference,
      providerName: privateProvider,
    });

    const audit = await db.auditLog.findMany({
      where: { entityId: { in: [batchId, leadId as string] } },
      select: { reason: true, metadata: true },
    });
    const auditText = JSON.stringify(audit);
    assert.equal(auditText.includes(privateSourceCode), false);
    assert.equal(auditText.includes(privateReference), false);
    assert.equal(auditText.includes(privateProvider), false);

    console.log("Lead-import research and private provenance database harness passed.");
  } finally {
    await cleanup();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("Lead-import research and private provenance database harness failed.", error);
  process.exitCode = 1;
});
