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

const statusMethod = "GET";
const statusPath = "/api/lead-imports/batch_demo";
const emptyBody = "";
const emptyBodySha256 = sha256Hex(emptyBody);
const statusHeaders = new Headers({
  [leadImportHeaderNames.keyId]: "paid-provider-v1",
  [leadImportHeaderNames.timestamp]: timestamp,
  [leadImportHeaderNames.bodySha256]: emptyBodySha256,
  [leadImportHeaderNames.signature]: signLeadImportRequest({ keyId: "paid-provider-v1", timestamp, method: statusMethod, path: statusPath, bodySha256: emptyBodySha256 }, secret),
});

const signedEmptyGet = verifyLeadImportTransportRequest({ headers: statusHeaders, contentType: null, body: emptyBody, method: statusMethod, path: statusPath, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(signedEmptyGet.ok, true);

const unsignedEmptyGet = verifyLeadImportTransportRequest({ headers: new Headers(), contentType: null, body: emptyBody, method: statusMethod, path: statusPath, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(unsignedEmptyGet.ok, false);
if (!unsignedEmptyGet.ok) assert.equal(unsignedEmptyGet.response.status, 401);

const emptyPostWithoutContentType = verifyLeadImportTransportRequest({ headers, contentType: null, body: emptyBody, method, path, hmacSecret: secret, now: Number(timestamp) + 1 });
assert.equal(emptyPostWithoutContentType.ok, false);
if (!emptyPostWithoutContentType.ok) assert.equal(emptyPostWithoutContentType.response.status, 415);

console.log("Lead import request verifier checks passed.");
