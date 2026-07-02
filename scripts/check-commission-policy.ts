import { strict as assert } from "node:assert";
import { evaluateCommissionEligibility } from "../src/lib/commission-policy";
import { evaluateCommissionLedgerReadiness, mayAdvanceToFinanceReview } from "../src/lib/commission-ledger-policy";
import { evaluateFinanceReadiness } from "../src/lib/finance-readiness";

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

function expectFinance(reason: string, input: Parameters<typeof evaluateFinanceReadiness>[0]) {
  const result = evaluateFinanceReadiness(input);
  assert.equal(result.reason, reason, `Expected finance reason ${reason}`);
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

expectFinance("FINANCE_DISABLED", { financeEnabled: false, commissionEligible: true, paymentCleared: true, hasActiveHold: false, financeApproved: true, destinationVerified: true });
expectFinance("COMMISSION_NOT_ELIGIBLE", { financeEnabled: true, commissionEligible: false, paymentCleared: true, hasActiveHold: false, financeApproved: true, destinationVerified: true });
expectFinance("PAYMENT_NOT_CLEARED", { financeEnabled: true, commissionEligible: true, paymentCleared: false, hasActiveHold: false, financeApproved: true, destinationVerified: true });
expectFinance("ACTIVE_HOLD", { financeEnabled: true, commissionEligible: true, paymentCleared: true, hasActiveHold: true, financeApproved: true, destinationVerified: true });
expectFinance("FINANCE_APPROVAL_REQUIRED", { financeEnabled: true, commissionEligible: true, paymentCleared: true, hasActiveHold: false, financeApproved: false, destinationVerified: true });
expectFinance("DESTINATION_NOT_VERIFIED", { financeEnabled: true, commissionEligible: true, paymentCleared: true, hasActiveHold: false, financeApproved: true, destinationVerified: false });
expectFinance("READY_FOR_MANUAL_REVIEW", { financeEnabled: true, commissionEligible: true, paymentCleared: true, hasActiveHold: false, financeApproved: true, destinationVerified: true });

console.log("Commission, ledger, and finance readiness policy checks passed.");
