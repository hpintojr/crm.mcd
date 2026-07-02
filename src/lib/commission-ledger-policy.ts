import type { CommissionEligibilityState } from "@/lib/commission-policy";

export type CommissionLedgerState = "PENDING_VERIFICATION" | "ON_HOLD" | "ELIGIBLE";

export type CommissionLedgerReadinessInput = {
  paymentCleared: boolean;
  eligibilityStatus: CommissionEligibilityState;
  hasActiveHold: boolean;
};

export function evaluateCommissionLedgerReadiness(input: CommissionLedgerReadinessInput): CommissionLedgerState {
  if (!input.paymentCleared) return "PENDING_VERIFICATION";
  if (input.hasActiveHold) return "ON_HOLD";
  if (input.eligibilityStatus === "ELIGIBLE") return "ELIGIBLE";
  if (input.eligibilityStatus === "PENDING") return "PENDING_VERIFICATION";
  return "ON_HOLD";
}

export function mayAdvanceToFinanceReview(input: CommissionLedgerReadinessInput, financeEnabled: boolean) {
  return financeEnabled && evaluateCommissionLedgerReadiness(input) === "ELIGIBLE";
}
