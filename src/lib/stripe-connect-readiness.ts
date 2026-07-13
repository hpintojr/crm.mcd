export const PAYOUT_ROUTES = ["MANUAL_EXTERNAL", "STRIPE_CONNECT"] as const;

export type PayoutRoute = (typeof PAYOUT_ROUTES)[number];

export type StripeConnectReadinessReason =
  | "MANUAL_EXTERNAL_ROUTE"
  | "STRIPE_CONFIGURATION_REQUIRED"
  | "CONNECTED_ACCOUNT_REQUIRED"
  | "CONNECT_ONBOARDING_INCOMPLETE"
  | "STRIPE_PAYOUTS_DISABLED"
  | "FINANCE_REVIEW_REQUIRED"
  | "MANUAL_APPROVAL_REQUIRED"
  | "TRANSFER_EXECUTION_DISABLED"
  | "READY_FOR_MANUAL_REVIEW";

export type StripeConnectReadinessInput = {
  payoutRoute: PayoutRoute;
  stripeConfigured: boolean;
  connectedAccountId?: string | null;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  financeReady: boolean;
  manualApprovalRecorded: boolean;
  transferExecutionEnabled: boolean;
};

export type StripeConnectReadinessResult = {
  readyForAdminReview: boolean;
  reason: StripeConnectReadinessReason;
  /**
   * This readiness helper never authorizes a provider call. Payout execution
   * remains outside the CRM until a separate approved implementation exists.
   */
  providerExecutionPermitted: false;
};

function result(reason: StripeConnectReadinessReason, readyForAdminReview = false): StripeConnectReadinessResult {
  return { readyForAdminReview, reason, providerExecutionPermitted: false };
}

/**
 * Classifies the optional Stripe Connect route without collecting bank, tax,
 * card, or provider-secret data and without initiating any provider action.
 */
export function evaluateStripeConnectReadiness(input: StripeConnectReadinessInput): StripeConnectReadinessResult {
  if (input.payoutRoute === "MANUAL_EXTERNAL") return result("MANUAL_EXTERNAL_ROUTE");
  if (!input.stripeConfigured) return result("STRIPE_CONFIGURATION_REQUIRED");
  if (!input.connectedAccountId) return result("CONNECTED_ACCOUNT_REQUIRED");
  if (!input.onboardingComplete) return result("CONNECT_ONBOARDING_INCOMPLETE");
  if (!input.payoutsEnabled) return result("STRIPE_PAYOUTS_DISABLED");
  if (!input.financeReady) return result("FINANCE_REVIEW_REQUIRED");
  if (!input.manualApprovalRecorded) return result("MANUAL_APPROVAL_REQUIRED");
  if (!input.transferExecutionEnabled) return result("TRANSFER_EXECUTION_DISABLED");
  return result("READY_FOR_MANUAL_REVIEW", true);
}
