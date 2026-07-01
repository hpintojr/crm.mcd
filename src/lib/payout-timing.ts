import "server-only";

export type PayoutTimingInput = {
  clearedAt: Date;
  isFirstPayment: boolean;
  includesSetupFee: boolean;
  launchChecklistComplete: boolean;
  packageOrScopeChanged: boolean;
};

export type PayoutTiming = { eligibleAt: Date | null; status: "READY_ON_DATE" | "WAITING_FOR_LAUNCH"; reason: string };

export function payoutTiming(input: PayoutTimingInput): PayoutTiming {
  const treatedAsNew = input.isFirstPayment || input.includesSetupFee || input.packageOrScopeChanged;
  if (treatedAsNew && !input.launchChecklistComplete) return { eligibleAt: null, status: "WAITING_FOR_LAUNCH", reason: "New-contract payout waits for cleared funds and documented launch completion." };
  const eligibleAt = new Date(input.clearedAt);
  eligibleAt.setUTCDate(eligibleAt.getUTCDate() + (treatedAsNew ? 30 : 15));
  return { eligibleAt, status: "READY_ON_DATE", reason: treatedAsNew ? "New-contract payout SLA: 30 days after cleared funds and launch completion." : "Established recurring payout SLA: 15 days after cleared funds." };
}
