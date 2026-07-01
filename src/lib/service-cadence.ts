import "server-only";

export type ServiceTier = "STARTER" | "GROWTH" | "PRO" | "ENTERPRISE";
export type ServiceCadence = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type ServiceCadenceRule = {
  cadence: ServiceCadence;
  guaranteedMinutes: number;
};

export function cadenceFor(tier: ServiceTier, daysSinceActivation: number): ServiceCadenceRule {
  if (!Number.isFinite(daysSinceActivation) || daysSinceActivation < 0) throw new Error("Days since activation must be a non-negative number.");
  if (tier === "PRO" || tier === "ENTERPRISE") return { cadence: "WEEKLY", guaranteedMinutes: 60 };
  if (tier === "STARTER") return daysSinceActivation < 60 ? { cadence: "BIWEEKLY", guaranteedMinutes: 0 } : { cadence: "MONTHLY", guaranteedMinutes: 0 };
  if (daysSinceActivation < 30) return { cadence: "WEEKLY", guaranteedMinutes: 0 };
  if (daysSinceActivation < 90) return { cadence: "BIWEEKLY", guaranteedMinutes: 0 };
  return { cadence: "MONTHLY", guaranteedMinutes: 0 };
}

export function nextServiceDue(from: Date, cadence: ServiceCadence) {
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + (cadence === "WEEKLY" ? 7 : cadence === "BIWEEKLY" ? 14 : 30));
  return due;
}
