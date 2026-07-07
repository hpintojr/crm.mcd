import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import {
  isLeadImportUniqueConstraintError,
  MAX_ROW_UPLOAD_RETRIES,
} from "../src/lib/lead-import-concurrency-contract";

assert.equal(isLeadImportUniqueConstraintError({ code: "P2002" }), true);
assert.equal(isLeadImportUniqueConstraintError({ code: "P2025" }), false);
assert.equal(isLeadImportUniqueConstraintError({}), false);
assert.equal(isLeadImportUniqueConstraintError(null), false);
assert.equal(isLeadImportUniqueConstraintError("P2002"), false);
assert.equal(MAX_ROW_UPLOAD_RETRIES, 2);

const createRoute = readFileSync("src/app/api/lead-imports/route.ts", "utf8");
const uploadRoute = readFileSync("src/app/api/lead-imports/[batchId]/rows/route.ts", "utf8");
const helper = readFileSync("src/lib/lead-import-concurrency.ts", "utf8");
const uploadService = readFileSync("src/lib/lead-import-batch.ts", "utf8");

assert.match(createRoute, /createLeadImportBatchWithConcurrencyRecovery/);
assert.match(uploadRoute, /uploadLeadImportRowsWithConcurrencyRecovery/);
assert.match(helper, /localRunId/);
assert.match(helper, /uploadLeadImportRows\(batchId, body\)/);
assert.match(uploadService, /assertImmutableLeadImportReplay/);

console.log("Lead import concurrency recovery checks passed.");
