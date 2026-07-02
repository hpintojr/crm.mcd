export type FinanceReadinessReason =
  | "FINANCE_DISABLED"
  | "COMMISSION_NOT_ELIGIBLE"
  | "PAYMENT_NOT_CLEARED"
  | "ACTIVE_HOLD"
  | "FINANCE_APPROVAL_REQUIRED"
  | "DESTINATION_NOT_VERIFIED"
  | "READY_FOR_MANUAL_REVIEW";

export type FinanceReadinessInput = {
  financeEnabled: boolean;
  commissionEligible: boolean;
  paymentCleared: boolean;
  hasActiveHold: boolean;
  financeApproved: boolean;
  destinationVerified: boolean;
};

export type FinanceReadinessResult = {
  ready: boolean;
  reason: FinanceReadinessReason;
};

export function evaluateFinanceReadiness(input: FinanceReadinessInput): FinanceReadinessResult {
  if (!input.financeEnabled) return { ready: false, reason: "FINANCE_DISABLED" };
  if (!input.commissionEligible) return { ready: false, reason: "COMMISSION_NOT_ELIGIBLE" };
  if (!input.paymentCleared) return { ready: false, reason: "PAYMENT_NOT_CLEARED" };
  if (input.hasActiveHold) return { ready: false, reason: "ACTIVE_HOLD" };
  if (!input.financeApproved) return { ready: false, reason: "FINANCE_APPROVAL_REQUIRED" };
  if (!input.destinationVerified) return { ready: false, reason: "DESTINATION_NOT_VERIFIED" };
  return { ready: true, reason: "READY_FOR_MANUAL_REVIEW" };
}
