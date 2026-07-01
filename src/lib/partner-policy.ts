import "server-only";

export type PartnerStanding = "ACTIVE" | "LEFT_GOOD_STANDING" | "RETIRED" | "TERMINATED";

export type PartnerPolicyInput = {
  standing: PartnerStanding;
  continuesServicingClients: boolean;
  clientPaymentCurrent: boolean;
  openClientIssue: boolean;
};

export type PartnerPolicyDecision = {
  retainsCommissionEligibility: boolean;
  accountOwner: "PARTNER" | "HOUSE";
  requiresReassignment: boolean;
  rationale: string;
};

export function determinePartnerPolicy(input: PartnerPolicyInput): PartnerPolicyDecision {
  if (input.standing === "TERMINATED") return { retainsCommissionEligibility: false, accountOwner: "HOUSE", requiresReassignment: true, rationale: "Terminated partners lose future commission rights and accounts move to House." };
  if (input.standing === "RETIRED") return { retainsCommissionEligibility: true, accountOwner: "PARTNER", requiresReassignment: false, rationale: "Retired partners retain commission eligibility." };
  if (input.standing === "LEFT_GOOD_STANDING" && !input.continuesServicingClients) return { retainsCommissionEligibility: true, accountOwner: "HOUSE", requiresReassignment: true, rationale: "Partner left in good standing but declined continued servicing." };
  if (input.clientPaymentCurrent && !input.openClientIssue) return { retainsCommissionEligibility: true, accountOwner: "PARTNER", requiresReassignment: false, rationale: "Healthy paying accounts stay assigned; inactivity alone does not cause reassignment." };
  return { retainsCommissionEligibility: true, accountOwner: "PARTNER", requiresReassignment: false, rationale: "Triggered service activity should be measured and resolved before reassignment." };
}
