import "server-only";

import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { env, ghlConfigured, ghlMiniCrmLeadIdFieldConfigured } from "@/lib/env";
import { requireFeature } from "@/lib/features";
import { upsertSalesHqContact } from "@/lib/ghl";

const handoffSchema = z.object({ leadId: z.string().cuid() });

function contactName(lead: { company: string; contactFirstName: string | null; contactLastName: string | null }) {
  return [lead.contactFirstName, lead.contactLastName].filter(Boolean).join(" ").trim() || lead.company;
}

function isStubContactId(contactId: string | null) {
  return Boolean(contactId?.startsWith("stub_"));
}

export async function handoffDemoBookedLeadToGhl(input: z.input<typeof handoffSchema>) {
  requireFeature("leads");
  const actor = await requireRole(ADMIN_ROLES);
  const parsed = handoffSchema.parse(input);
  const lead = await db.lead.findUnique({ where: { id: parsed.leadId } });
  if (!lead) throw new Error("Lead not found.");
  if (lead.dnc || lead.suppressed) throw new Error("Suppressed leads cannot be handed off to GHL.");
  if (lead.lifecycle !== "DEMO_BOOKED") throw new Error("Only demo-booked leads can be handed off to GHL.");

  if (lead.ghlContactId && !isStubContactId(lead.ghlContactId)) {
    await db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_GHL_HANDOFF_SKIPPED", entityType: "Lead", entityId: lead.id, metadata: { ghlContactId: lead.ghlContactId, reason: "Already linked" } } });
    return { ghlContactId: lead.ghlContactId, alreadyLinked: true, stub: false, replacedStub: false };
  }

  const replacingStub = isStubContactId(lead.ghlContactId);
  if (replacingStub && !ghlConfigured) {
    await db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_GHL_HANDOFF_SKIPPED", entityType: "Lead", entityId: lead.id, metadata: { ghlContactId: lead.ghlContactId, reason: "Stub mapping retained until GHL is configured" } } });
    return { ghlContactId: lead.ghlContactId!, alreadyLinked: true, stub: true, replacedStub: false };
  }

  const result = await upsertSalesHqContact({
    legalName: contactName(lead),
    preferredName: lead.contactFirstName || undefined,
    companyName: lead.company,
    personalEmail: lead.email,
    mobile: lead.businessPhone,
    tags: ["mcd-demo-booked"],
    customFields: ghlMiniCrmLeadIdFieldConfigured
      ? { [env.ghl.miniCrmLeadIdFieldId]: lead.id }
      : undefined,
  });

  if (!result.ok) {
    await db.$transaction([
      db.integrationError.create({ data: { source: "ghl.lead-demo-handoff", refId: lead.id, message: result.error, payload: { leadId: lead.id, company: lead.company, replacingStub } } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_GHL_HANDOFF_FAILED", entityType: "Lead", entityId: lead.id, reason: result.error } }),
    ]);
    throw new Error("GHL handoff failed and was logged for admin review.");
  }

  const now = new Date();
  const miniCrmLeadIdWritten = ghlMiniCrmLeadIdFieldConfigured && !result.stub;
  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { ghlContactId: result.data.contactId, lastActionAt: now } }),
    db.leadActivity.create({ data: { leadId: lead.id, type: "DEMO_BOOKED", metadata: { ghlHandoff: true, ghlContactId: result.data.contactId, stub: Boolean(result.stub), replacedStub: replacingStub, miniCrmLeadIdWritten } } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_GHL_HANDOFF_COMPLETED", entityType: "Lead", entityId: lead.id, metadata: { ghlContactId: result.data.contactId, stub: Boolean(result.stub), replacedStub: replacingStub, miniCrmLeadIdWritten } } }),
  ]);

  return { ghlContactId: result.data.contactId, alreadyLinked: false, stub: Boolean(result.stub), replacedStub: replacingStub, miniCrmLeadIdWritten };
}
