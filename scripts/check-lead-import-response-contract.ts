import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
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

const routePaths = [
  "src/app/api/lead-imports/route.ts",
  "src/app/api/lead-imports/[batchId]/route.ts",
  "src/app/api/lead-imports/[batchId]/owner-acquisition/route.ts",
  "src/app/api/lead-imports/[batchId]/rows/route.ts",
  "src/app/api/lead-imports/[batchId]/preview/route.ts",
  "src/app/api/lead-imports/[batchId]/submit/route.ts",
];

for (const path of routePaths) {
  const route = readFileSync(path, "utf8");
  assert.equal(route.includes("(error as Error).message"), false, `${path} exposes a raw exception message.`);
  assert.equal(route.includes("NextResponse"), false, `${path} bypasses the shared response helper.`);
  assert.equal(route.includes("request.json()"), false, `${path} parses JSON outside the signed request guard.`);
  assert.equal(route.includes("request.text()"), false, `${path} reads the body outside the signed request guard.`);
  assert.match(route, /LEAD_IMPORT_INTERNAL_ERROR/, `${path} is missing its generic internal error contract.`);
  assert.match(route, /leadImportJson/, `${path} does not use the shared response helper.`);
  assert.match(route, /guard\.requestId/, `${path} does not propagate the signed request ID.`);
}

const guard = readFileSync("src/lib/lead-import-route-guard.ts", "utf8");
for (const expected of [
  "LEAD_IMPORT_UNAVAILABLE",
  "LEAD_IMPORT_PAYLOAD_TOO_LARGE",
  "LEAD_IMPORT_BODY_READ_ERROR",
  "LEAD_IMPORT_INVALID_JSON",
  "MAX_LEAD_IMPORT_BODY_BYTES = 1_000_000",
  "MAX_LEAD_IMPORT_REQUEST_ID_LENGTH = 128",
  "leadImportRequestId(request)",
  "leadImportHeaderNames.requestId",
  '"Cache-Control": "no-store, max-age=0"',
  '"X-Request-Id": requestId',
  '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  "new TextEncoder().encode(bodyText).byteLength",
  "const verification = verifyLeadImportTransportRequest",
]) {
  assert.ok(guard.includes(expected), `Lead import guard is missing response-boundary behavior: ${expected}`);
}

const configIndex = guard.indexOf("const config = requireLeadImportHmacConfig()");
const bodyReadIndex = guard.indexOf("bodyText = await request.text()");
const verificationIndex = guard.indexOf("const verification = verifyLeadImportTransportRequest");
const parseIndex = guard.indexOf("JSON.parse(bodyText)");
assert.ok(configIndex >= 0 && bodyReadIndex > configIndex, "Lead import HMAC configuration must be resolved before body consumption.");
assert.ok(verificationIndex > bodyReadIndex, "Lead import signature verification must follow the bounded body read.");
assert.ok(parseIndex > verificationIndex, "Lead import JSON parsing must occur only after transport verification.");

console.log("Lead import response boundary checks passed.");
