import { strict as assert } from "node:assert";
import { sha256Hex, signLeadImportRequest } from "../src/lib/lead-import-auth";
import { leadImportHeaderNames } from "../src/lib/lead-import-http";
import { verifyLeadImportTransportRequest } from "../src/lib/lead-import-request-verifier";

const secret = "fixture-key";
const timestamp = "1783065000000";
const method = "POST";
const path = "/api/lead-imports/batch_demo/rows";
const body = JSON.stringify({ rows: [{ rowNumber: 1 }] });
const bodySha256 = sha256Hex(body);
const headers = new Headers({
  [leadImportHeaderNames.keyId]: "paid-provider-v1",
  [leadImportHeaderNames.timestamp]: timestamp,
  [leadImportHeaderNames.bodySha256]: bodySha256,
  [leadImportHeaderNames.signature]: signLeadImportRequest({ keyId: "paid-provider-v1", timestamp, method, path, bodySha256 }, secret),
  [leadImportHeaderNames.requestId]: "request-demo-001",
});

const valid = verifyLeadImportTransportRequest({ headers, contentType: "application/json", body, method, path, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(valid.ok, true);
if (valid.ok) assert.equal(valid.requestId, "request-demo-001");

const wrongType = verifyLeadImportTransportRequest({ headers, contentType: "text/plain", body, method, path, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(wrongType.ok, false);
if (!wrongType.ok) assert.equal(wrongType.response.status, 415);

const alteredBody = verifyLeadImportTransportRequest({ headers, contentType: "application/json", body: "{}", method, path, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(alteredBody.ok, false);
if (!alteredBody.ok) assert.equal(alteredBody.response.status, 401);

console.log("Lead import request verifier checks passed.");
