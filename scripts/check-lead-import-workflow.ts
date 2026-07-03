import { strict as assert } from "node:assert";
import {
  assertLeadImportBatchTransition,
  assertLeadImportRecordTransition,
  importedLeadSafetyDefaults,
  mayCreateLeadFromImport,
  recommendLeadImportBatchStatus,
  requiresAdminReview,
  summarizeLeadImportRows,
} from "../src/lib/lead-import-workflow";

assert.doesNotThrow(() => assertLeadImportBatchTransition("DRAFT", "ROWS_RECEIVED"));
assert.throws(() => assertLeadImportBatchTransition("DRAFT", "SUBMITTED"));
assert.doesNotThrow(() => assertLeadImportRecordTransition("VALID", "PENDING_ADMIN_REVIEW"));
assert.throws(() => assertLeadImportRecordTransition("VALID", "IMPORTED"));
assert.equal(requiresAdminReview("POSSIBLE_EXISTING_DUPLICATE"), true);
assert.equal(mayCreateLeadFromImport({ batchStatus: "SUBMITTED", recordStatus: "APPROVED" }), true);
assert.equal(mayCreateLeadFromImport({ batchStatus: "PREVIEWED", recordStatus: "APPROVED" }), false);
assert.deepEqual(importedLeadSafetyDefaults(), { lifecycle: "PENDING_REVIEW", ownerAgentId: null, autoCampaign: false, autoSend: false });
assert.deepEqual(
  summarizeLeadImportRows(["VALID", "PENDING_ADMIN_REVIEW", "APPROVED", "IMPORTED", "SUPPRESSED", "IMPORT_ERROR"]),
  { totalRows: 6, validRows: 4, rejectedRows: 1, importedRows: 1, reviewRequiredRows: 2, reconciliationRequiredRows: 1 },
);
assert.equal(recommendLeadImportBatchStatus(["POSSIBLE_EXISTING_DUPLICATE"]), "REVIEW_REQUIRED");
assert.equal(recommendLeadImportBatchStatus(["IMPORT_ERROR"]), "RECONCILIATION_REQUIRED");

console.log("Lead import workflow checks passed.");
