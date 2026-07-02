import "server-only";

import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const releaseSchema = z.object({
  leadId: z.string().cuid(),
  reason: z.string().trim().min(3).max(2_000),
});

function eligibleLifecycle(value: string) {
  return value === "CLAIMED" || value === "CONTACTED" || value === "NURTURING" || value === "DEMO_BOOKED";
}

export async function releaseLeadToOpenPool(input: { leadId: string; reason: string }) {
  const parsed = releaseSchema.parse(input);
  requireFeature("leads");
  const actor = await requireRole(ADMIN_ROLES);
  const lead = await db.lead.findUnique({ where: { id: parsed.leadId } });
  if (!lead) throw new Error("Lead not found.");
  if (lead.dnc || lead.suppressed) throw new Error("Suppressed records cannot enter Open Pool.");
  if (lead.isReferral || lead.pool === "REFERRAL") throw new Error("Referral records are protected and cannot enter Open Pool.");
  if (!lead.ownerAgentId || !lead.twoWayContactAt) throw new Error("Only a previously assigned lead with documented two-way contact can be returned to Open Pool.");
  if (!eligibleLifecycle(lead.lifecycle)) throw new Error("This lead is not eligible for an Open Pool return.");

  const now = new Date();
  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { ownerAgentId: null, lifecycle: "AVAILABLE", pool: "OPEN", openPoolReleaseAt: now, nextActionAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, action: "RETURNED_TO_POOL", reason: parsed.reason } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: "LEAD_RELEASED", metadata: { pool: "OPEN", reason: parsed.reason } } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_RETURNED_TO_OPEN_POOL", entityType: "Lead", entityId: lead.id, reason: parsed.reason } }),
  ]);
}
