import { strict as assert } from "node:assert";
import {
  createLeadImportBatchResponseSchema,
  leadImportBatchCountsSchema,
  previewLeadImportResponseSchema,
} from "../src/lib/lead-import-response-contract";

const batch = {
  batchId: "batch_demo_001",
  localRunId: "RUN_2026_07_03_001",
  status: "PREVIEWED",
  counts: {
    totalRows: 2,
    validRows: 1,
    rejectedRows: 1,
    importedRows: 0,
    reviewRequiredRows: 0,
    reconciliationRequiredRows: 0,
  },
  approvalReference: null,
  createdAt: "2026-07-03T11:00:00.000Z",
  updatedAt: "2026-07-03T11:00:00.000Z",
};

assert.equal(createLeadImportBatchResponseSchema.safeParse({ batch }).success, true);
assert.equal(leadImportBatchCountsSchema.safeParse({ ...batch.counts, totalRows: -1 }).success, false);
assert.equal(previewLeadImportResponseSchema.safeParse({
  batch,
  records: [
    {
      rowNumber: 1,
      idempotencyKey: "RUN_2026_07_03_001:1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      status: "VALID",
      issues: [],
      resolvedLeadId: null,
    },
    {
      rowNumber: 2,
      idempotencyKey: "RUN_2026_07_03_001:2:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      status: "SUPPRESSED",
      issues: ["Matched an active suppression record."],
      resolvedLeadId: null,
    },
  ],
}).success, true);

console.log("Lead import response contract checks passed.");
