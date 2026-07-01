import "server-only";

export function lifecycleFromOpportunity(stage?: string) {
  if (stage === "CLOSED_WON") return "CLOSED_WON" as const;
  if (stage === "CLOSED_LOST") return "CLOSED_LOST" as const;
  if (stage === "DEMO_BOOKED") return "DEMO_BOOKED" as const;
  return null;
}

export function opportunityMetadata(input: { eventType: string; stage?: string; packageCode?: string }) {
  return { eventType: input.eventType, stage: input.stage ?? null, packageCode: input.packageCode ?? null };
}
