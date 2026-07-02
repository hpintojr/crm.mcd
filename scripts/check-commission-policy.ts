import { strict as assert } from "node:assert";
import { evaluateCommissionEligibility } from "../src/lib/commission-policy";

const agentA = "agent-a";
const agentB = "agent-b";

function expect(status: string, reason: string, input: Parameters<typeof evaluateCommissionEligibility>[0]) {
  const result = evaluateCommissionEligibility(input);
  assert.equal(result.status, status, `Expected ${status}; received ${result.status}`);
  assert.equal(result.reason, reason, `Expected ${reason}; received ${result.reason}`);
}

expect("ELIGIBLE", "ACTIVE_SERVICE", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });
expect("ELIGIBLE", "RETIRED", { profile: "RETIRED", serviceState: "ACTIVE", accountOwnerAgentId: agentB, candidateAgentId: agentA, currentOnPayments: true });
expect("INELIGIBLE", "TERMINATED", { profile: "TERMINATED", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });
expect("ON_HOLD", "PAYMENT_UNCLEARED", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: false });
expect("INELIGIBLE", "HOUSE_TRANSFER", { profile: "ACTIVE", serviceState: "HOUSE", accountOwnerAgentId: null, candidateAgentId: agentA, currentOnPayments: true });
expect("INELIGIBLE", "MISSING_SERVICE_OWNER", { profile: "ACTIVE", serviceState: "UNASSIGNED", accountOwnerAgentId: null, candidateAgentId: agentA, currentOnPayments: true });
expect("INELIGIBLE", "AGENT_DECLINES_SERVICE", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentB, candidateAgentId: agentA, currentOnPayments: true });
expect("PENDING", "MANUAL_REVIEW", { profile: "MISSING", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });

console.log("Commission eligibility policy checks passed.");
