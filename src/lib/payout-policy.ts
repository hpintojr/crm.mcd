import "server-only";

export type PayoutDecisionInput = {
  commissionApproved: boolean;
  stripeAccountReady: boolean;
  hasComplianceHold: boolean;
  hasChargebackRisk: boolean;
  amountCents: number;
};

export type PayoutDecision = { permitted: boolean; reason: string };

export function payoutPermitted(input: PayoutDecisionInput): PayoutDecision {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return { permitted: false, reason: "Payout amount must be a positive whole-cent amount." };
  if (!input.commissionApproved) return { permitted: false, reason: "Commission approval is required." };
  if (!input.stripeAccountReady) return { permitted: false, reason: "Payout destination is not ready." };
  if (input.hasComplianceHold) return { permitted: false, reason: "Compliance hold blocks payout." };
  if (input.hasChargebackRisk) return { permitted: false, reason: "Chargeback or refund risk blocks payout." };
  return { permitted: true, reason: "Ready for approved payout batch." };
}
