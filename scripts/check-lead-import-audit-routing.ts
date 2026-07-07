import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const previewRoute = readFileSync(join(root, "src/app/api/lead-imports/[batchId]/preview/route.ts"), "utf8");
const submitRoute = readFileSync(join(root, "src/app/api/lead-imports/[batchId]/submit/route.ts"), "utf8");

assert.match(previewRoute, /previewImportWithAudit/);
assert.match(submitRoute, /submitImportWithAudit/);
assert.doesNotMatch(previewRoute, /const batch = await previewLeadImportBatch\(/);
assert.doesNotMatch(submitRoute, /const batch = await submitLeadImportBatch\(/);

console.log("Lead import audit route checks passed.");
