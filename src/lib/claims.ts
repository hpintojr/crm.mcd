import "server-only";

import { UserRole } from "@prisma/client";
import { isControlledTestLead } from "@/lib/controlled-test-leads";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const ADMIN: UserRole[] = ["OWNER", "SUPER_ADMIN", "SALES_MANAGER", "COMPLIANCE_MANAGER", "FINANCE_MANAGER"];
const CLAIM_ELIGIBLE_LIFECYCLES = ["CONTACTED", "NURTURING", "DEMO_BOOKED"] as const;
const CLAIM_ELIGIBLE_POOLS = ["HOT", "NURTURE"] as const;
const CLAIM_RELEASE_DAYS = 45;

export async function claimAvailableLead(actor: { userId: string; role: UserRole }, leadId: string) {
  requireFeature("leads");

  // Admins may only claim controlled test Leads (acceptance-operator path, PR #78/#79).
  // Real production Leads still require an AGENT-role user; managers must use reassignment.
  if (ADMIN.includes(actor.role)) {
    const targetLead = await db.lead.findUnique({
      where: { id: leadId },
      select: { id: true, source: true, sourceReference: true, campaignName: true, campaignExternalId: true, sourceDetail: true },
    });
    if (!isControlledTestLead(targetLead)) {
      throw new Error("Use reassignment controls for manager lead assignment.");
    }
    // Fall through: the admin\'s acceptance-operator Agent is expected to exist
    // (auto-provisioned by activeAgent() when the admin recorded the two-way
    // contact disposition). If it does not, the canClaimLeads check below
    // will throw the same "pending manager certification" error and Hamilton
    // will know to seed a disposition first.
  }

  const agent = await db.agent.findUnique({ where: { userId: actor.userId } });
  if (!agent?.canClaimLeads) throw new Error("Lead access is pending manager certification.");
  const capacity = Math.max(1, Number.parseInt(process.env.LEAD_CLAIM_CAPACITY ?? "50", 10) || 50);
  const active = await db.lead.count({ where: { ownerAgentId: agent.id, lifecycle: { in: ["CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"] }, dnc: false, suppressed: false } });
  if (active >= capacity) throw new Error(`Active lead capacity of ${capacity} reached.`);

  const lead = await db.lead.findFirst({
    where: {
      id: leadId,
      ownerAgentId: null,
      lifecycle: { in: [...CLAIM_ELIGIBLE_LIFECYCLES] },
      pool: { in: [...CLAIM_ELIGIBLE_POOLS] },
      twoWayContactAt: { not: null },
      dnc: false,
      suppressed: false,
    },
    select: { id: true, pool: true, lifecycle: true, twoWayContactAt: true },
  });
  if (!lead) throw new Error("This lead is not claim-eligible. A two-way contact disposition is required before claiming.");

  const now = new Date();
  const releaseAt = new Date(now.getTime() + CLAIM_RELEASE_DAYS * 24 * 60 * 60 * 1000);
  const updated = await db.lead.updateMany({
    where: {
      id: lead.id,
      ownerAgentId: null,
      lifecycle: lead.lifecycle,
      pool: lead.pool,
      twoWayContactAt: { not: null },
      dnc: false,
      suppressed: false,
    },
    data: {
      ownerAgentId: agent.id,
      lifecycle: "CLAIMED",
      claimedAt: now,
      lastActionAt: now,
      openPoolReleaseAt: releaseAt,
    },
  });
  if (updated.count !== 1) throw new Error("This record is no longer available to claim.");
  await db.$transaction([
    db.leadClaimEvent.create({ data: { leadId, agentId: agent.id, action: "CLAIMED", reason: "Two-way contact verified before claim." } }),
    db.leadActivity.create({ data: { leadId, agentId: agent.id, type: "LEAD_CLAIMED", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, releaseAt: releaseAt.toISOString(), rule: "TWO_WAY_CONTACT_REQUIRED" } } }),
    db.auditLog.create({ data: { actorUserId: actor.userId, actorRole: actor.role, actionType: "LEAD_CLAIMED", entityType: "Lead", entityId: leadId, metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, releaseAt: releaseAt.toISOString(), twoWayContactAt: lead.twoWayContactAt?.toISOString() ?? null } } }),
  ]);
}
