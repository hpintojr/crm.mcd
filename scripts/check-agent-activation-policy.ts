import { strict as assert } from "node:assert";
import { evaluateAgentActivation } from "../src/lib/agent-activation-policy";

type Input = Parameters<typeof evaluateAgentActivation>[0];

const base: Input = {
  agentApproved: true,
  documentsComplete: true,
  agreementCountersigned: true,
  w9Verified: false,
  profileComplete: false,
  trainingComplete: false,
  provisioned: false,
};

function expect(state: string, mayIssueActivation: boolean, input: Input) {
  const result = evaluateAgentActivation(input);
  assert.equal(result.state, state, `Expected state ${state}, got ${result.state}`);
  assert.equal(result.mayIssueActivation, mayIssueActivation, `Expected mayIssueActivation ${mayIssueActivation} for ${state}`);
}

expect("APPLICANT_IN_REVIEW", false, { ...base, agentApproved: false });
expect("DOCUMENTS_IN_PROGRESS", false, { ...base, documentsComplete: false });
expect("DOCUMENTS_IN_PROGRESS", false, { ...base, agreementCountersigned: false });
expect("DOCUMENTS_COMPLETE", false, base);
expect("W9_VERIFIED", false, { ...base, w9Verified: true });
expect("PROFILE_COMPLETE", false, { ...base, w9Verified: true, profileComplete: true });
expect("TRAINING_COMPLETE", true, { ...base, w9Verified: true, profileComplete: true, trainingComplete: true });

// Internal gates alone never issue activation without completed, countersigned documents.
expect("DOCUMENTS_IN_PROGRESS", false, { ...base, documentsComplete: false, w9Verified: true, profileComplete: true, trainingComplete: true });

// Grandfathering: already-provisioned agents stay active partners and are never re-gated.
expect("ACTIVE_PARTNER", false, { ...base, provisioned: true });
expect("ACTIVE_PARTNER", false, { ...base, provisioned: true, w9Verified: true, profileComplete: true, trainingComplete: true });

assert.deepEqual(
  evaluateAgentActivation(base).missingInternalGates,
  ["W9_VERIFICATION", "PROFILE_COMPLETION", "TRAINING_COMPLETION"],
  "Expected all three internal gates reported missing",
);
assert.deepEqual(
  evaluateAgentActivation({ ...base, w9Verified: true, profileComplete: true, trainingComplete: true }).missingInternalGates,
  [],
  "Expected no internal gates missing when all evidence is recorded",
);

console.log("Agent activation policy checks passed.");
