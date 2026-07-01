import "server-only";

export function bookingFields(input: { leadId: string; agentId: string; originAgentId: string; pricingTier: string; startsAt: Date }) {
  if (!input.leadId || !input.agentId || !input.originAgentId || !input.pricingTier.trim()) throw new Error("Lead, agent, origin, and pricing values are required.");
  if (input.startsAt.getTime() <= Date.now()) throw new Error("Booking time must be in the future.");
  return {
    startsAt: input.startsAt.toISOString(),
    customFields: {
      mini_crm_lead_id: input.leadId,
      mini_crm_agent_id: input.agentId,
      originating_agent_id: input.originAgentId,
      set_pricing_tier: input.pricingTier.trim(),
    },
  };
}

export function bookingCredit(originalAgentId: string, event: "BOOKED" | "RESCHEDULED" | "CLOSED_WON", closerId?: string | null) {
  return event === "CLOSED_WON" && closerId ? closerId : originalAgentId;
}
