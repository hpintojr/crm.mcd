import { strict as assert } from "node:assert";
import { sha256Hex, signLeadImportRequest } from "../src/lib/lead-import-auth";
import { leadImportHeaderNames } from "../src/lib/lead-import-http";
import { verifyLeadImportTransportRequest } from "../src/lib/lead-import-request-verifier";

const hmacSecret = "fixture-key-material";
const timestamp = "1783065000000";
const method = "POST";
const path = "/api/lead-imports/batch_demo/rows";
const body = JSON.stringify({ rows: [{ rowNumber: 1, company: "Example Business" }] });
const bodySha256 = sha256Hex(body);
const signature = signLeadImportRequest({ keyId: "local-exporter-v1", timestamp, method, path, bodySha256 }, hmacSecret);

const headers = new Headers({
  [leadImportHeaderNames.keyId]: "local-exporter-v1",
  [leadImportHeaderNames.timestamp]: timestamp,
  [leadImportHeaderNames.bodySha256]: bodySha256,
  [leadImportHeaderNames.signature]: signature,
  [leadImportHeaderNames.requestId]: "request-demo-001",
});

const valid = verifyLeadImportTransportRequest({
  headers,
  contentType: "application/json; charset=utf-8",
  body,
  method,
  path,
  hmacSecret,
  now: Number(timestamp) + 1_000,
});
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.auth.keyId, "local-exporter-v1");
  assert.equal(valid.requestId, "request-demo-001");
}

const wrongContentType = verifyLeadImportTransportRequest({
  headers,
  contentType: "text/plain",
  body,
  method,
  path,
  hmacSecret,
  now: Number(timestamp) + 1_000,
});
assert.deepEqual(wrongContentType, {
  ok: false,
  response: {
    status: 415,
    code: "LEAD_IMPORT_UNSUPPORTED_MEDIA_TYPE",
    message: "Lead-import requests must use application/json.",
  },
});

const alteredBody = verifyLeadImportTransportRequest({
  headers,
  contentType: "application/json",
  body: JSON.stringify({ rows: [] }),
  method,
  path,
  hmacSecret,
  now: Number(timestamp) + 1_000,
});
assert.equal(alteredBody.ok, false);
if (!alteredBody.ok) assert.equal(alteredBody.response.status, 401);

const missingHeaders = verifyLeadImportTransportRequest({
  headers: new Headers(),
  contentType: "application/json",
  body,
  method,
  path,
  hmacSecret,
  now: Number(timestamp) + 1_000,
});
assert.equal(missingHeaders.ok, false);
if (!missingHeaders.ok) assert.equal(missingHeaders.response.status, 401);

console.log("Lead import request verifier checks passed.");
