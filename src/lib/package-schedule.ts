import "server-only";

export type PackageCode = "STANDARD_STARTER" | "STANDARD_GROWTH" | "STANDARD_PRO" | "ENTERPRISE_STARTER" | "ENTERPRISE_GROWTH" | "ENTERPRISE_PRO";

export type PackageSchedule = { retailCents: number; wholesaleCents: number; setupProfitTargetCents: number; serviceTier: "STARTER" | "GROWTH" | "PRO" | "ENTERPRISE" };

export const PACKAGE_SCHEDULE: Record<PackageCode, PackageSchedule> = {
  STANDARD_STARTER: { retailCents: 159500, wholesaleCents: 100000, setupProfitTargetCents: 100000, serviceTier: "STARTER" },
  STANDARD_GROWTH: { retailCents: 199500, wholesaleCents: 125000, setupProfitTargetCents: 150000, serviceTier: "GROWTH" },
  STANDARD_PRO: { retailCents: 399500, wholesaleCents: 150000, setupProfitTargetCents: 300000, serviceTier: "PRO" },
  ENTERPRISE_STARTER: { retailCents: 529500, wholesaleCents: 250000, setupProfitTargetCents: 500000, serviceTier: "ENTERPRISE" },
  ENTERPRISE_GROWTH: { retailCents: 759500, wholesaleCents: 350000, setupProfitTargetCents: 500000, serviceTier: "ENTERPRISE" },
  ENTERPRISE_PRO: { retailCents: 999500, wholesaleCents: 500000, setupProfitTargetCents: 500000, serviceTier: "ENTERPRISE" },
};

export function packageSchedule(code: PackageCode) {
  return PACKAGE_SCHEDULE[code];
}
