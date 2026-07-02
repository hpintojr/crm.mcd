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
  if (!features.leads) return { matched: false, gated: true, ignored: false, preservedClosedWon: false };
  const lead = input.miniCrmLeadId
    ? await db.lead.findUnique({ where: { id: input.miniCrmLeadId } })
    : input.ghlOpportunityId
      ? await db.lead.findFirst({ where: { ghlOpportunityId: input.ghlOpportunityId }, orderBy: { updatedAt: "desc" } })
      : input.ghlContactId
        ? await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } })
        : null;
  if (!lead) return { matched: false, gated: false, ignored: false, preservedClosedWon: false };

  if (lead.dnc || lead.suppressed) {
    await db.auditLog.create({ data: { actionType: "GHL_OPPORTUNITY_IGNORED", entityType: "Lead", entityId: lead.id, reason: "Suppressed Lead was not changed by a GHL opportunity event.", metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlOpportunityId: input.ghlOpportunityId } } });
    return { matched: true, gated: false, ignored: true, preservedClosedWon: false, leadId: lead.id };
  }

  const now = new Date();
  const won = input.eventType === "OPPORTUNITY_WON";
  const preserveWon = input.eventType === "OPPORTUNITY_LOST" && lead.lifecycle === "CLOSED_WON";
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lifecycle: won ? "CLOSED_WON" : preserveWon ? lead.lifecycle : "CLOSED_LOST",
        ghlContactId: input.ghlContactId ?? lead.ghlContactId,
        ghlOpportunityId: input.ghlOpportunityId,
        lastActionAt: now,
        nextActionAt: won || !preserveWon ? null : lead.nextActionAt,
      },
    });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: "DISPOSITION_SET", metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlOpportunityId: input.ghlOpportunityId, preservedClosedWon: preserveWon } } });
    await tx.auditLog.create({ data: { actionType: preserveWon ? "GHL_OPPORTUNITY_LOST_PRESERVED" : "GHL_OPPORTUNITY_ATTRIBUTED", entityType: "Lead", entityId: lead.id, reason: preserveWon ? "Ignored lifecycle rollback from a later GHL lost event because the Lead was already Closed Won." : undefined, metadata: { eventType: input.eventType, ghlEventId: input.ghlEventId, ghlOpportunityId: input.ghlOpportunityId } } });
  });

  return { matched: true, gated: false, ignored: false, preservedClosedWon: preserveWon, leadId: lead.id, lifecycle: won ? "CLOSED_WON" : preserveWon ? lead.lifecycle : "CLOSED_LOST" };
}
