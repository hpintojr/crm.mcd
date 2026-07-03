import { strict as assert } from "node:assert";
import { makeRowIdempotencyKey, uploadLeadImportRowMetadataSchema } from "../src/lib/lead-import-contract";
import { DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS, sha256Hex, signLeadImportRequest, verifyLeadImportRequest } from "../src/lib/lead-import-auth";
import { getLeadImportIntakePolicyViolation } from "../src/lib/lead-import-intake-policy";

const fixtureKey = "fixture-key-material";
const keyId = "local-exporter-v1";
const timestamp = "1783065000000";
const path = "/api/lead-imports/batch_demo/rows";
const body = JSON.stringify({ rows: [{ rowNumber: 1, company: "Example Business" }] });
const bodySha256 = sha256Hex(body);
const signature = signLeadImportRequest({ keyId, timestamp, method: "POST", path, bodySha256 }, fixtureKey);
const headers = { keyId, timestamp, bodySha256, signature };

assert.equal(verifyLeadImportRequest({ headers, body, method: "POST", path, hmacSecret: fixtureKey, now: Number(timestamp) + 1_000 }).ok, true);
assert.deepEqual(
  verifyLeadImportRequest({ headers, body: JSON.stringify({ rows: [] }), method: "POST", path, hmacSecret: fixtureKey, now: Number(timestamp) + 1_000 }),
  { ok: false, reason: "BODY_HASH_MISMATCH" },
);
assert.deepEqual(
  verifyLeadImportRequest({ headers, body, method: "POST", path: "/api/lead-imports/batch_demo/preview", hmacSecret: fixtureKey, now: Number(timestamp) + 1_000 }),
  { ok: false, reason: "SIGNATURE_MISMATCH" },
);
assert.deepEqual(
  verifyLeadImportRequest({ headers, body, method: "POST", path, hmacSecret: fixtureKey, now: Number(timestamp) + DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS + 1 }),
  { ok: false, reason: "EXPIRED" },
);

const rowHash = "a".repeat(64);
const idempotencyKey = makeRowIdempotencyKey("RUN_2026_07_03_001", 1, rowHash);
assert.equal(uploadLeadImportRowMetadataSchema.safeParse({ rows: [{ rowNumber: 1, rowHash, idempotencyKey }] }).success, true);
assert.equal(uploadLeadImportRowMetadataSchema.safeParse({
  rows: [
    { rowNumber: 1, rowHash, idempotencyKey },
    { rowNumber: 1, rowHash: "b".repeat(64), idempotencyKey: makeRowIdempotencyKey("RUN_2026_07_03_001", 2, "b".repeat(64)) },
  ],
}).success, false);

assert.equal(getLeadImportIntakePolicyViolation({ originalSource: "WEB_FORM", intakeMethod: "WEB_FORM_SUBMISSION" }), null);
assert.ok(getLeadImportIntakePolicyViolation({ originalSource: "OTHER", intakeMethod: "SCRAPE_IMPORT" }));

console.log("Lead import contract and HMAC policy checks passed.");
