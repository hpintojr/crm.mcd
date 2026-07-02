import { strict as assert } from "node:assert";
import { evaluateCommissionEligibility } from "../src/lib/commission-policy";
import { evaluateCommissionLedgerReadiness, mayAdvanceToFinanceReview } from "../src/lib/commission-ledger-policy";

const agentA = "agent-a";
const agentB = "agent-b";

function expectEligibility(status: string, reason: string, input: Parameters<typeof evaluateCommissionEligibility>[0]) {
  const result = evaluateCommissionEligibility(input);
  assert.equal(result.status, status, `Expected ${status}; received ${result.status}`);
  assert.equal(result.reason, reason, `Expected ${reason}; received ${result.reason}`);
}

function expectLedger(status: string, input: Parameters<typeof evaluateCommissionLedgerReadiness>[0]) {
  assert.equal(evaluateCommissionLedgerReadiness(input), status, `Expected ledger state ${status}`);
}

expectEligibility("ELIGIBLE", "ACTIVE_SERVICE", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("ELIGIBLE", "RETIRED", { profile: "RETIRED", serviceState: "ACTIVE", accountOwnerAgentId: agentB, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("INELIGIBLE", "TERMINATED", { profile: "TERMINATED", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("ON_HOLD", "PAYMENT_UNCLEARED", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: false });
expectEligibility("INELIGIBLE", "HOUSE_TRANSFER", { profile: "ACTIVE", serviceState: "HOUSE", accountOwnerAgentId: null, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("INELIGIBLE", "MISSING_SERVICE_OWNER", { profile: "ACTIVE", serviceState: "UNASSIGNED", accountOwnerAgentId: null, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("INELIGIBLE", "AGENT_DECLINES_SERVICE", { profile: "ACTIVE", serviceState: "ACTIVE", accountOwnerAgentId: agentB, candidateAgentId: agentA, currentOnPayments: true });
expectEligibility("PENDING", "MANUAL_REVIEW", { profile: "MISSING", serviceState: "ACTIVE", accountOwnerAgentId: agentA, candidateAgentId: agentA, currentOnPayments: true });

expectLedger("PENDING_VERIFICATION", { paymentCleared: false, eligibilityStatus: "ELIGIBLE", hasActiveHold: false });
expectLedger("ON_HOLD", { paymentCleared: true, eligibilityStatus: "ELIGIBLE", hasActiveHold: true });
expectLedger("PENDING_VERIFICATION", { paymentCleared: true, eligibilityStatus: "PENDING", hasActiveHold: false });
expectLedger("ON_HOLD", { paymentCleared: true, eligibilityStatus: "INELIGIBLE", hasActiveHold: false });
expectLedger("ELIGIBLE", { paymentCleared: true, eligibilityStatus: "ELIGIBLE", hasActiveHold: false });
assert.equal(mayAdvanceToFinanceReview({ paymentCleared: true, eligibilityStatus: "ELIGIBLE", hasActiveHold: false }, false), false, "Finance-disabled records cannot advance.");
assert.equal(mayAdvanceToFinanceReview({ paymentCleared: true, eligibilityStatus: "ELIGIBLE", hasActiveHold: false }, true), true, "Finance-enabled eligible records may advance for review.");

console.log("Commission policy and ledger readiness checks passed.");
