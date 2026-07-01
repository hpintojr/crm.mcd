import "server-only";

export type PartnerStatus = "ACTIVE" | "LEFT_GOOD_STANDING" | "RETIRED" | "TERMINATED";

export function partnerAccountDecision(status: PartnerStatus, servicesClients: boolean) {
  if (status === "TERMINATED") return { commissionEligible: false, owner: "HOUSE" as const, reassign: true };
  if (status === "RETIRED") return { commissionEligible: true, owner: "PARTNER" as const, reassign: false };
  if (status === "LEFT_GOOD_STANDING" && !servicesClients) return { commissionEligible: false, owner: "HOUSE" as const, reassign: true };
  return { commissionEligible: true, owner: "PARTNER" as const, reassign: false };
}
