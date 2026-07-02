import "server-only";

import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const ADMIN: UserRole[] = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER", "COMPLIANCE_MANAGER", "FINANCE_MANAGER"];

export async function claimAvailableLead(actor: { userId: string; role: UserRole }, leadId: string) {
  requireFeature("leads");
  if (ADMIN.includes(actor.role)) throw new Error("Use reassignment controls for manager lead assignment.");
  const agent = await db.agent.findUnique({ where: { userId: actor.userId } });
  if (!agent?.canClaimLeads) throw new Error("Lead access is pending manager certification.");
  const capacity = Math.max(1, Number.parseInt(process.env.LEAD_CLAIM_CAPACITY ?? "50", 10) || 50);
  const active = await db.lead.count({ where: { ownerAgentId: agent.id, lifecycle: { in: ["CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"] }, dnc: false, suppressed: false } });
  if (active >= capacity) throw new Error(`Active lead capacity of ${capacity} reached.`);

  const now = new Date();
  const updated = await db.lead.updateMany({
    where: {
      id: leadId,
      ownerAgentId: null,
      lifecycle: "AVAILABLE",
      pool: "OPEN",
      openPoolReleaseAt: { lte: now },
      dnc: false,
      suppressed: false,
    },
    data: { ownerAgentId: agent.id, lifecycle: "CLAIMED", claimedAt: now, lastActionAt: now },
  });
  if (updated.count !== 1) throw new Error("This Open Pool record is no longer available to claim.");
  await db.$transaction([
    db.leadClaimEvent.create({ data: { leadId, agentId: agent.id, action: "CLAIMED" } }),
    db.leadActivity.create({ data: { leadId, agentId: agent.id, type: "LEAD_CLAIMED" } }),
    db.auditLog.create({ data: { actorUserId: actor.userId, actorRole: actor.role, actionType: "LEAD_CLAIMED", entityType: "Lead", entityId: leadId } }),
  ]);
}
