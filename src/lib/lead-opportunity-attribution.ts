import "server-only";

import { db } from "@/lib/db";
import { features } from "@/lib/features";

type OpportunityLeadEvent = {
  eventType: "OPPORTUNITY_WON" | "OPPORTUNITY_LOST";
  ghlEventId: string;
  ghlOpportunityId: string;
  ghlContactId?: string;
  miniCrmLeadId?: string;
};

export async function attributeOpportunityToLead(input: OpportunityLeadEvent) {
  if (!features.leads) return { matched: false, gated: true };
  const lead = input.miniCrmLeadId
    ? await db.lead.findUnique({ where: { id: input.miniCrmLeadId } })
    : input.ghlContactId
      ? await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } })
      : null;
  if (!lead) return { matched: false, gated: false };

  const now = new Date();
  const lifecycle = input.eventType === "OPPORTUNITY_WON" ? "CLOSED_WON" : "CLOSED_LOST";
  await db.$transaction([
    db.lead.update({
      where: { id: lead.id },
      data: {
        lifecycle,
        ghlContactId: input.ghlContactId ?? lead.ghlContactId,
        ghlOpportunityId: input.ghlOpportunityId,
        lastActionAt: now,
        nextActionAt: null,
      },
    }),
    db.auditLog.create({
      data: {
        actionType: "GHL_OPPORTUNITY_ATTRIBUTED",
        entityType: "Lead",
        entityId: lead.id,
        metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlOpportunityId: input.ghlOpportunityId },
      },
    }),
  ]);

  return { matched: true, gated: false, leadId: lead.id, lifecycle };
}
