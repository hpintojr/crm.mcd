import { strict as assert } from "node:assert";
import { isLeadImportJsonContentType, leadImportHeaderNames, readLeadImportTransportHeaders } from "../src/lib/lead-import-http";

const headers = new Headers({
  [leadImportHeaderNames.keyId]: "local-exporter-v1",
  [leadImportHeaderNames.timestamp]: "1783065000000",
  [leadImportHeaderNames.bodySha256]: "a".repeat(64),
  [leadImportHeaderNames.signature]: "b".repeat(64),
  [leadImportHeaderNames.requestId]: "request-demo-001",
});

assert.equal(readLeadImportTransportHeaders(headers).auth.keyId, "local-exporter-v1");
assert.equal(readLeadImportTransportHeaders(headers).requestId, "request-demo-001");
assert.throws(() => readLeadImportTransportHeaders(new Headers()));
assert.equal(isLeadImportJsonContentType("application/json; charset=utf-8"), true);
assert.equal(isLeadImportJsonContentType("text/plain"), false);

console.log("Lead import HTTP boundary checks passed.");
