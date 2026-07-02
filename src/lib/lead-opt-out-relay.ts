import "server-only";

import { db } from "@/lib/db";
import { features } from "@/lib/features";

export type GhlOptOutRelayInput = {
  ghlEventId: string;
  ghlContactId?: string;
  phone?: string;
  email?: string;
  reason?: string;
};

function normalizePhone(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits ? `+${digits}` : null;
}

function normalizeEmail(value?: string) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export async function relayGhlOptOut(input: GhlOptOutRelayInput) {
  if (!features.leads) return { matched: false, gated: true };
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const lead = input.ghlContactId
    ? await db.lead.findFirst({ where: { ghlContactId: input.ghlContactId }, orderBy: { updatedAt: "desc" } })
    : phone
      ? await db.lead.findFirst({ where: { normalizedPhone: phone }, orderBy: { updatedAt: "desc" } })
      : email
        ? await db.lead.findFirst({ where: { email }, orderBy: { updatedAt: "desc" } })
        : null;
  if (!lead) return { matched: false, gated: false };
  if (lead.dnc && lead.suppressed) return { matched: true, gated: false, alreadySuppressed: true, leadId: lead.id };

  const now = new Date();
  const identifier = lead.normalizedPhone || lead.email || lead.ghlContactId || lead.id;
  const reason = input.reason?.trim() || "Inbound GHL opt-out.";
  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { lifecycle: "SUPPRESSED", dnc: true, suppressed: true, ownerAgentId: null, nextActionAt: null, lastActionAt: now } });
    await tx.leadCallback.updateMany({ where: { leadId: lead.id, status: "SCHEDULED" }, data: { status: "CANCELLED", completedAt: now } });
    await tx.leadSuppression.create({ data: { leadId: lead.id, identifier, type: "OPT_OUT", reason } });
    await tx.leadActivity.create({ data: { leadId: lead.id, type: "DNC_REQUESTED", metadata: { source: "ghl.opt-out", ghlEventId: input.ghlEventId, reason } } });
    await tx.auditLog.create({ data: { actionType: "LEAD_SUPPRESSED_FROM_GHL_OPT_OUT", entityType: "Lead", entityId: lead.id, reason, metadata: { ghlEventId: input.ghlEventId, ghlContactId: input.ghlContactId ?? null, phone, email } } });
  });
  return { matched: true, gated: false, alreadySuppressed: false, leadId: lead.id };
}
