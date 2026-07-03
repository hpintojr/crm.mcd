import { strict as assert } from "node:assert";
import {
  makeRowIdempotencyKey,
  uploadLeadImportRowsSchema,
} from "../src/lib/lead-import-contract";
import {
  DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS,
  sha256Hex,
  signLeadImportRequest,
  verifyLeadImportRequest,
} from "../src/lib/lead-import-auth";

const secret = "test-only-hmac-secret";
const keyId = "local-exporter-v1";
const timestamp = "1783065000000";
const path = "/api/lead-imports/batch_demo/rows";
const body = JSON.stringify({ rows: [{ rowNumber: 1, company: "Example Business" }] });
const bodySha256 = sha256Hex(body);

const signature = signLeadImportRequest({
  keyId,
  timestamp,
  method: "POST",
  path,
  bodySha256,
}, secret);

const headers = { keyId, timestamp, bodySha256, signature };

const valid = verifyLeadImportRequest({
  headers,
  body,
  method: "POST",
  path,
  hmacSecret: secret,
  now: Number(timestamp) + 1_000,
});
assert.equal(valid.ok, true, "Expected a correctly signed request to verify.");

const alteredBody = verifyLeadImportRequest({
  headers,
  body: JSON.stringify({ rows: [{ rowNumber: 1, company: "Altered Business" }] }),
  method: "POST",
  path,
  hmacSecret: secret,
  now: Number(timestamp) + 1_000,
});
assert.deepEqual(alteredBody, { ok: false, reason: "BODY_HASH_MISMATCH" });

const alteredPath = verifyLeadImportRequest({
  headers,
  body,
  method: "POST",
  path: "/api/lead-imports/batch_demo/preview",
  hmacSecret: secret,
  now: Number(timestamp) + 1_000,
});
assert.deepEqual(alteredPath, { ok: false, reason: "SIGNATURE_MISMATCH" });

const expired = verifyLeadImportRequest({
  headers,
  body,
  method: "POST",
  path,
  hmacSecret: secret,
  now: Number(timestamp) + DEFAULT_LEAD_IMPORT_MAX_CLOCK_SKEW_MS + 1,
});
assert.deepEqual(expired, { ok: false, reason: "EXPIRED" });

const rowHash = "a".repeat(64);
const idempotencyKey = makeRowIdempotencyKey("RUN_2026_07_03_001", 1, rowHash);
const validUpload = uploadLeadImportRowsSchema.safeParse({
  rows: [{
    rowNumber: 1,
    rowHash,
    idempotencyKey,
    row: {
      company: "Example Business",
      businessPhone: "555-555-1212",
      originalSource: "WEB_FORM",
      intakeMethod: "WEB_FORM_SUBMISSION",
    },
  }],
});
assert.equal(validUpload.success, true, "Expected a valid row envelope to pass.");

const duplicateRowNumber = uploadLeadImportRowsSchema.safeParse({
  rows: [
    {
      rowNumber: 1,
      rowHash,
      idempotencyKey,
      row: {
        company: "Example Business",
        businessPhone: "555-555-1212",
        originalSource: "WEB_FORM",
        intakeMethod: "WEB_FORM_SUBMISSION",
      },
    },
    {
      rowNumber: 1,
      rowHash: "b".repeat(64),
      idempotencyKey: makeRowIdempotencyKey("RUN_2026_07_03_001", 2, "b".repeat(64)),
      row: {
        company: "Other Business",
        businessPhone: "555-555-1213",
        originalSource: "WEB_FORM",
        intakeMethod: "WEB_FORM_SUBMISSION",
      },
    },
  ],
});
assert.equal(duplicateRowNumber.success, false, "Duplicate row numbers must be rejected.");

console.log("Lead import contract and HMAC policy checks passed.");
