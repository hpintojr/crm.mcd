import "server-only";

import { PackageCode, packageSchedule } from "@/lib/package-schedule";

function validCents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Amounts must be non-negative whole cents.");
  return value;
}

export function monthlyRevenueSplit(input: { packageCode: PackageCode; collectedCents: number; feeCents: number; taxCents: number }) {
  const schedule = packageSchedule(input.packageCode);
  const eligible = Math.max(0, validCents(input.collectedCents) - validCents(input.taxCents));
  const net = Math.max(0, eligible - schedule.wholesaleCents - validCents(input.feeCents));
  const partner = Math.floor(net / 2);
  return { eligibleCents: eligible, wholesaleCents: schedule.wholesaleCents, netCents: net, partnerCents: partner, companyCents: net - partner };
}

export function setupRevenueSplit(input: { packageCode: PackageCode; collectedCents: number; feeCents: number; taxCents: number }) {
  const schedule = packageSchedule(input.packageCode);
  const result = monthlyRevenueSplit(input);
  const meetsTarget = result.netCents >= schedule.setupProfitTargetCents;
  return { ...result, setupProfitTargetCents: schedule.setupProfitTargetCents, meetsTarget, partnerCents: meetsTarget ? result.partnerCents : 0, companyCents: meetsTarget ? result.companyCents : result.netCents };
}
