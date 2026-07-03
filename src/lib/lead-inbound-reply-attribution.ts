import "server-only";

import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { normalizeEmail, normalizePhone } from "@/lib/lead-normalization";

type InboundReplyEvent = {
  ghlEventId: string;
  channel: "EMAIL" | "SMS";
  message: string;
  ghlContactId?: string;
  miniCrmLeadId?: string;
  fromEmail?: string;
  fromPhone?: string;
  receivedAt?: string;
};

async function matchLead(input: InboundReplyEvent) {
  if (input.miniCrmLeadId) {
    const byMiniCrmId = await db.lead.findUnique({ where: { id: input.miniCrmLeadId } });
    if (byMiniCrmId) return byMiniCrmId;
  }
  if (input.ghlContactId) {
    const byGhlContact = await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } });
    if (byGhlContact) return byGhlContact;
  }
  const email = normalizeEmail(input.fromEmail);
  if (email) {
    const byEmail = await db.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, orderBy: { updatedAt: "desc" } });
    if (byEmail) return byEmail;
  }
  const phone = normalizePhone(input.fromPhone);
  if (phone) return db.lead.findFirst({ where: { normalizedPhone: phone }, orderBy: { updatedAt: "desc" } });
  return null;
}

export async function attributeInboundReplyToLead(input: InboundReplyEvent) {
  if (!features.leads) return { matched: false, gated: true, ignored: false, callbackCreated: false };
  const lead = await matchLead(input);
  if (!lead) return { matched: false, gated: false, ignored: false, callbackCreated: false };
  if (lead.dnc || lead.suppressed) {
    await db.auditLog.create({ data: { actionType: "GHL_INBOUND_REPLY_IGNORED", entityType: "Lead", entityId: lead.id, reason: "Suppressed Lead was not changed by an inbound reply event.", metadata: { ghlEventId: input.ghlEventId, channel: input.channel } } });
    return { matched: true, gated: false, ignored: true, callbackCreated: false, leadId: lead.id };
  }

  const now = new Date();
  const terminal = lead.lifecycle === "CLOSED_WON" || lead.lifecycle === "CLOSED_LOST" || lead.lifecycle === "DISQUALIFIED";
  const existingCallback = lead.ownerAgentId ? await db.leadCallback.findFirst({ where: { leadId: lead.id, agentId: lead.ownerAgentId, status: "SCHEDULED" }, orderBy: { dueAt: "asc" } }) : null;
  const callbackCreated = Boolean(lead.ownerAgentId && !existingCallback);
  await db.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        lifecycle: terminal ? lead.lifecycle : lead.lifecycle === "DEMO_BOOKED" ? "DEMO_BOOKED" : "CONTACTED",
        ghlContactId: input.ghlContactId ?? lead.ghlContactId,
        lastActionAt: now,
        nextActionAt: lead.ownerAgentId ? now : lead.nextActionAt,
      },
    });
    await tx.leadNote.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, body: `Inbound ${input.channel} reply: ${input.message}` } });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: "NOTE_ADDED", metadata: { source: "GHL_INBOUND_REPLY", ghlEventId: input.ghlEventId, channel: input.channel, receivedAt: input.receivedAt ?? null, terminalLifecyclePreserved: terminal } } });
    if (callbackCreated && lead.ownerAgentId) await tx.leadCallback.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, dueAt: now } });
    await tx.auditLog.create({ data: { actionType: "GHL_INBOUND_REPLY_ATTRIBUTED", entityType: "Lead", entityId: lead.id, metadata: { ghlEventId: input.ghlEventId, channel: input.channel, callbackCreated, terminalLifecyclePreserved: terminal, matchedBy: input.miniCrmLeadId ? "mini_crm_lead_id" : input.ghlContactId ? "ghl_contact_id" : input.fromEmail ? "email" : "phone" } } });
  });

  return { matched: true, gated: false, ignored: false, callbackCreated, leadId: lead.id };
}
