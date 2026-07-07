import { strict as assert } from "node:assert";
import {
  importPreviewAuditReason,
  importRowAuditMetadata,
  shouldWritePreviewAudit,
} from "../src/lib/import-audit-outcomes";

assert.equal(shouldWritePreviewAudit("SUPPRESSED"), true);
assert.equal(shouldWritePreviewAudit("DUPLICATE_IN_BATCH"), true);
assert.equal(shouldWritePreviewAudit("POSSIBLE_EXISTING_DUPLICATE"), true);
assert.equal(shouldWritePreviewAudit("REJECTED"), true);
assert.equal(shouldWritePreviewAudit("REVIEW_REQUIRED"), true);
assert.equal(shouldWritePreviewAudit("VALID"), false);
assert.equal(shouldWritePreviewAudit("IMPORTED"), false);

assert.match(importPreviewAuditReason("SUPPRESSED"), /suppression/i);
assert.match(importPreviewAuditReason("REJECTED"), /rejected/i);

assert.deepEqual(
  importRowAuditMetadata({
    batchId: "batch_demo_001",
    rowId: "row_demo_001",
    rowNumber: 7,
    status: "SUPPRESSED",
  }),
  { batchId: "batch_demo_001", rowNumber: 7, status: "SUPPRESSED" }
);

console.log("Import audit outcome checks passed.");
