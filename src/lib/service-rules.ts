import "server-only";

export type ServicePackage = "STARTER" | "GROWTH" | "PRO" | "ENTERPRISE";
export type ServiceCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export function requiredCadence(input: { packageCode: ServicePackage; daysSinceActivation: number; growthPreference?: "BIWEEKLY" | "MONTHLY" }) {
  if (!Number.isFinite(input.daysSinceActivation) || input.daysSinceActivation < 0) throw new Error("Days since activation must be non-negative.");
  if (input.packageCode === "PRO" || input.packageCode === "ENTERPRISE") return { cadence: "WEEKLY" as const, guaranteedMinutes: 60 };
  if (input.packageCode === "STARTER") return { cadence: input.daysSinceActivation <= 90 ? "BIWEEKLY" as const : "MONTHLY" as const, guaranteedMinutes: 0 };
  return { cadence: input.daysSinceActivation <= 90 ? "WEEKLY" as const : (input.growthPreference ?? "BIWEEKLY"), guaranteedMinutes: 0 };
}

export function servicingViolation(input: { daysWithoutHealthConfirmation: number; priorViolationsInRollingYear: number; unexcusedClientResponseDays: number }) {
  if (input.unexcusedClientResponseDays >= 3) return { severity: "TERMINATION_REVIEW" as const, houseTransfer: true, reason: "Three-day unexcused client-response escalation." };
  if (input.daysWithoutHealthConfirmation < 60) return { severity: "NONE" as const, houseTransfer: false, reason: "Health-confirmation window is compliant." };
  if (input.priorViolationsInRollingYear >= 1) return { severity: "HOUSE_TRANSFER" as const, houseTransfer: true, reason: "Second 60-day servicing violation in rolling 12 months." };
  return { severity: "WARNING" as const, houseTransfer: false, reason: "First 60-day servicing violation." };
}
