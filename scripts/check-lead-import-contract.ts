import { strict as assert } from "node:assert";
import { makeRowIdempotencyKey, uploadLeadImportRowMetadataSchema } from "../src/lib/lead-import-contract";
import { sha256Hex, signLeadImportRequest, verifyLeadImportRequest } from "../src/lib/lead-import-auth";

const secret = "fixture-key";
const timestamp = "1783065000000";
const path = "/api/lead-imports/batch_demo/rows";
const body = JSON.stringify({ rows: [{ rowNumber: 1 }] });
const bodySha256 = sha256Hex(body);
const headers = {
  keyId: "paid-provider-v1",
  timestamp,
  bodySha256,
  signature: signLeadImportRequest({ keyId: "paid-provider-v1", timestamp, method: "POST", path, bodySha256 }, secret),
};

assert.equal(verifyLeadImportRequest({ headers, body, method: "POST", path, hmacSecret: secret, now: Number(timestamp) + 1 }).ok, true);
assert.equal(verifyLeadImportRequest({ headers, body: "{}", method: "POST", path, hmacSecret: secret, now: Number(timestamp) + 1 }).ok, false);
assert.equal(verifyLeadImportRequest({ headers, body, method: "POST", path: "/api/lead-imports/batch_demo/preview", hmacSecret: secret, now: Number(timestamp) + 1 }).ok, false);

const rowHash = "a".repeat(64);
const idempotencyKey = makeRowIdempotencyKey("RUN_2026_07_03_001", 1, rowHash);
assert.equal(uploadLeadImportRowMetadataSchema.safeParse({ rows: [{ rowNumber: 1, rowHash, idempotencyKey }] }).success, true);
assert.equal(uploadLeadImportRowMetadataSchema.safeParse({ rows: [{ rowNumber: 1, rowHash, idempotencyKey }, { rowNumber: 1, rowHash: "b".repeat(64), idempotencyKey: makeRowIdempotencyKey("RUN_2026_07_03_001", 2, "b".repeat(64)) }] }).success, false);

console.log("Lead import contract checks passed.");
