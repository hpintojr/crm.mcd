import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  assertImmutableLeadImportBatchReplay,
  isLeadImportUniqueConstraintError,
  LeadImportBatchReplayConflictError,
  MAX_ROW_UPLOAD_RETRIES,
} from "../src/lib/lead-import-concurrency-contract";

const input = {
  localRunId: "RUN_2026_07_07_001",
  operatorName: "Operator One",
  sourceAdapter: "PPC",
  sourceAdapterVersion: "1.0.0",
  manifestHash: "a".repeat(64),
  clientVersion: "1.0.0",
};
const existing = { ...input, keyId: "primary-key" };

assert.equal(isLeadImportUniqueConstraintError({ code: "P2002" }), true);
assert.equal(isLeadImportUniqueConstraintError({ code: "P2025" }), false);
assert.equal(isLeadImportUniqueConstraintError({}), false);
assert.equal(isLeadImportUniqueConstraintError(null), false);
assert.equal(isLeadImportUniqueConstraintError("P2002"), false);
assert.equal(MAX_ROW_UPLOAD_RETRIES, 2);
assert.doesNotThrow(() => assertImmutableLeadImportBatchReplay(existing, input, "primary-key"));
assert.throws(
  () => assertImmutableLeadImportBatchReplay(existing, { ...input, manifestHash: "b".repeat(64) }, "primary-key"),
  LeadImportBatchReplayConflictError,
);
assert.throws(
  () => assertImmutableLeadImportBatchReplay(existing, input, "secondary-key"),
  LeadImportBatchReplayConflictError,
);

const createRoute = readFileSync("src/app/api/lead-imports/route.ts", "utf8");
const uploadRoute = readFileSync("src/app/api/lead-imports/[batchId]/rows/route.ts", "utf8");
const helper = readFileSync("src/lib/lead-import-concurrency.ts", "utf8");
const uploadService = readFileSync("src/lib/lead-import-batch.ts", "utf8");
const domainErrors = readFileSync("src/lib/lead-import-domain-error-response.ts", "utf8");

assert.match(createRoute, /createLeadImportBatchWithConcurrencyRecovery/);
assert.match(createRoute, /leadImportDomainErrorResponse/);
assert.doesNotMatch(createRoute, /LEAD_IMPORT_REPLAY_CONFLICT/);
assert.match(domainErrors, /LeadImportBatchReplayConflictError/);
assert.match(domainErrors, /LEAD_IMPORT_REPLAY_CONFLICT/);
assert.match(domainErrors, /409/);
assert.match(uploadRoute, /uploadLeadImportRowsWithConcurrencyRecovery/);
assert.match(helper, /assertImmutableLeadImportBatchReplay/);
assert.match(helper, /localRunId/);
assert.match(helper, /uploadLeadImportRows\(batchId, body\)/);
assert.match(uploadService, /assertImmutableLeadImportReplay/);

console.log("Lead import concurrency recovery checks passed.");
