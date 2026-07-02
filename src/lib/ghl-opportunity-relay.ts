import "server-only";

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { recordInboundEvent } from "@/lib/ghl-webhook";
import { attributeOpportunityToLead } from "@/lib/lead-opportunity-attribution";

export type GhlOpportunityRelayInput = {
  ghlEventId: string;
  locationId: string;
  eventType: "OPPORTUNITY_WON" | "OPPORTUNITY_LOST";
  ghlOpportunityId: string;
  ghlContactId?: string;
  miniCrmLeadId?: string;
  rawPayload: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function relayGhlOpportunity(input: GhlOpportunityRelayInput) {
  const event = await recordInboundEvent({ ghlEventId: input.ghlEventId, locationId: input.locationId, type: "opportunities.changed", payload: input.rawPayload });
  if (!event.firstTime) return { duplicate: true, leadMatched: false, leadGated: false };

  const attribution = await attributeOpportunityToLead({
    eventType: input.eventType,
    ghlEventId: input.ghlEventId,
    ghlOpportunityId: input.ghlOpportunityId,
    ghlContactId: input.ghlContactId,
    miniCrmLeadId: input.miniCrmLeadId,
  });
  await db.auditLog.create({
    data: {
      actionType: "GHL_OPPORTUNITY_RELAYED",
      entityType: "WebhookEvent",
      entityId: input.ghlEventId,
      ipAddress: input.ipAddress ?? null,
      metadata: { leadMatched: attribution.matched, leadGated: attribution.gated, eventType: input.eventType, ghlOpportunityId: input.ghlOpportunityId },
    },
  });
  return { duplicate: false, leadMatched: attribution.matched, leadGated: attribution.gated };
}
