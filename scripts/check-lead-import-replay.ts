import { strict as assert } from "node:assert";
import type { LeadImportRowEnvelope } from "../src/lib/lead-import-payload-schema";
import { assertImmutableLeadImportReplay } from "../src/lib/lead-import-replay";

const rowHash = "a".repeat(64);
const idempotencyKey = `RUN_2026_07_07_001:1:${rowHash}`;

const incoming: LeadImportRowEnvelope = {
  rowNumber: 1,
  rowHash,
  idempotencyKey,
  row: {
    company: "Example Company",
    email: "ops@example.com",
    originalSource: "PPC",
    intakeMethod: "API_IMPORT",
  },
};

const existing = {
  rowNumber: 1,
  rowHash: rowHash.toUpperCase(),
  idempotencyKey,
  payload: {
    intakeMethod: "API_IMPORT",
    originalSource: "PPC",
    email: "ops@example.com",
    company: "Example Company",
  },
};

// Object-key order is not a content change.
assert.doesNotThrow(() => assertImmutableLeadImportReplay(existing, incoming));

const changedHash: LeadImportRowEnvelope = { ...incoming, rowHash: "b".repeat(64) };
assert.throws(
  () => assertImmutableLeadImportReplay(existing, changedHash),
  /different row hash/
);

const changedContent: LeadImportRowEnvelope = {
  ...incoming,
  row: { ...incoming.row, company: "Different Company" },
};
assert.throws(
  () => assertImmutableLeadImportReplay(existing, changedContent),
  /different row content/
);

const changedRowNumber: LeadImportRowEnvelope = { ...incoming, rowNumber: 2 };
assert.throws(
  () => assertImmutableLeadImportReplay(existing, changedRowNumber),
  /associated with row 1/
);

const changedKey: LeadImportRowEnvelope = {
  ...incoming,
  idempotencyKey: `RUN_2026_07_07_001:1:${"b".repeat(64)}`,
};
assert.throws(
  () => assertImmutableLeadImportReplay(existing, changedKey),
  /different idempotency key/
);

console.log("Lead import immutable replay checks passed.");
