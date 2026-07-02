export type CommissionProfileState = "ACTIVE" | "RETIRED" | "TERMINATED" | "ON_HOLD" | "MISSING";
export type ClientServiceState = "ACTIVE" | "HOUSE" | "UNASSIGNED";
export type CommissionEligibilityState = "PENDING" | "ELIGIBLE" | "ON_HOLD" | "INELIGIBLE";
export type CommissionEligibilityReason =
  | "ACTIVE_SERVICE"
  | "RETIRED"
  | "AGENT_DECLINES_SERVICE"
  | "HOUSE_TRANSFER"
  | "TERMINATED"
  | "PAYMENT_UNCLEARED"
  | "MANUAL_HOLD"
  | "MISSING_SERVICE_OWNER"
  | "MANUAL_REVIEW";

export type CommissionEligibilityInput = {
  profile: CommissionProfileState;
  serviceState: ClientServiceState;
  accountOwnerAgentId?: string | null;
  candidateAgentId: string;
  currentOnPayments: boolean;
};

export type CommissionEligibilityResult = {
  status: CommissionEligibilityState;
  reason: CommissionEligibilityReason;
};

export function evaluateCommissionEligibility(input: CommissionEligibilityInput): CommissionEligibilityResult {
  if (input.profile === "MISSING") return { status: "PENDING", reason: "MANUAL_REVIEW" };
  if (input.profile === "TERMINATED") return { status: "INELIGIBLE", reason: "TERMINATED" };
  if (input.profile === "ON_HOLD") return { status: "ON_HOLD", reason: "MANUAL_HOLD" };
  if (!input.currentOnPayments) return { status: "ON_HOLD", reason: "PAYMENT_UNCLEARED" };
  if (input.profile === "RETIRED") return { status: "ELIGIBLE", reason: "RETIRED" };
  if (input.serviceState === "HOUSE") return { status: "INELIGIBLE", reason: "HOUSE_TRANSFER" };
  if (input.serviceState === "UNASSIGNED" || !input.accountOwnerAgentId) return { status: "INELIGIBLE", reason: "MISSING_SERVICE_OWNER" };
  if (input.accountOwnerAgentId !== input.candidateAgentId) return { status: "INELIGIBLE", reason: "AGENT_DECLINES_SERVICE" };
  return { status: "ELIGIBLE", reason: "ACTIVE_SERVICE" };
}
