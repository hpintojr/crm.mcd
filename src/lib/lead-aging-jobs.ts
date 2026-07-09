import "server-only";

import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const DEFAULT_LIMIT = 100;
const SHARK_TANK_STALL_DAYS = 21;

type LeadAgingSweepOptions = {
  now?: Date;
  limit?: number;
  dryRun?: boolean;
};

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function readLimit(limit?: number) {
  return Math.max(1, Math.min(limit ?? DEFAULT_LIMIT, 500));
}

function previewReturnedToOpenPool(lead: { id: string; ownerAgentId: string | null; pool: string; lifecycle: string; openPoolReleaseAt: Date | null }) {
  return {
    leadId: lead.id,
    currentOwnerAgentId: lead.ownerAgentId,
    currentPool: lead.pool,
    currentLifecycle: lead.lifecycle,
    currentOpenPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null,
    wouldSetOwnerAgentId: null,
    wouldSetPool: "OPEN",
    wouldSetLifecycle: "AVAILABLE",
    wouldSetClaimedAt: null,
    wouldSetNextActionAt: null,
    wouldWriteAuditAction: "LEAD_AUTO_RETURNED_TO_OPEN_POOL",
  };
}

function previewPromotedToSharkTank(lead: { id: string; pool: string; lifecycle: string; openPoolReleaseAt: Date | null }) {
  return {
    leadId: lead.id,
    currentPool: lead.pool,
    currentLifecycle: lead.lifecycle,
    currentOpenPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null,
    wouldSetPool: "SHARK_TANK",
    wouldSetNextActionAt: null,
    wouldWriteAuditAction: "LEAD_PROMOTED_TO_SHARK_TANK",
  };
}

export async function runLeadAgingSweep(options: LeadAgingSweepOptions = {}) {
  requireFeature("leads");
  const now = options.now ?? new Date();
  const limit = readLimit(options.limit);
  const dryRun = options.dryRun === true;
  const sharkTankCutoff = daysAgo(now, SHARK_TANK_STALL_DAYS);

  const expiredClaimedLeads = await db.lead.findMany({
    where: {
      ownerAgentId: { not: null },
      openPoolReleaseAt: { lte: now },
      lifecycle: { in: ["CLAIMED", "CONTACTED", "NURTURING"] },
      dnc: false,
      suppressed: false,
      isReferral: false,
      pool: { not: "REFERRAL" },
    },
    orderBy: [{ openPoolReleaseAt: "asc" }, { lastActionAt: "asc" }],
    take: limit,
    select: { id: true, ownerAgentId: true, pool: true, lifecycle: true, openPoolReleaseAt: true },
  });

  const remainingCapacity = Math.max(0, limit - expiredClaimedLeads.length);
  const stalledOpenPoolLeads = remainingCapacity > 0
    ? await db.lead.findMany({
      where: {
        ownerAgentId: null,
        pool: "OPEN",
        lifecycle: "AVAILABLE",
        openPoolReleaseAt: { lte: sharkTankCutoff },
        dnc: false,
        suppressed: false,
        isReferral: false,
      },
      orderBy: [{ openPoolReleaseAt: "asc" }, { createdAt: "asc" }],
      take: remainingCapacity,
      select: { id: true, pool: true, lifecycle: true, openPoolReleaseAt: true },
    })
    : [];

  const preview = {
    returnedToOpenPool: expiredClaimedLeads.map(previewReturnedToOpenPool),
    promotedToSharkTank: stalledOpenPoolLeads.map(previewPromotedToSharkTank),
  };

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      processed: 0,
      wouldProcess: expiredClaimedLeads.length + stalledOpenPoolLeads.length,
      returnedToOpenPool: 0,
      promotedToSharkTank: 0,
      wouldReturnToOpenPool: expiredClaimedLeads.length,
      wouldPromoteToSharkTank: stalledOpenPoolLeads.length,
      limit,
      cutoff: sharkTankCutoff.toISOString(),
      preview,
    };
  }

  await db.$transaction(async (tx) => {
    for (const lead of expiredClaimedLeads) {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          ownerAgentId: null,
          lifecycle: "AVAILABLE",
          pool: "OPEN",
          claimedAt: null,
          nextActionAt: null,
          openPoolReleaseAt: now,
          lastActionAt: now,
        },
      });
      await tx.leadClaimEvent.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, action: "RETURNED_TO_POOL", reason: "Automatic 45-day claim timer expiration." } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: lead.ownerAgentId, type: "LEAD_RELEASED", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, pool: "OPEN", reason: "45_DAY_TIMER_EXPIRED", openPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null } } });
      await tx.auditLog.create({ data: { actorRole: "SYSTEM", actionType: "LEAD_AUTO_RETURNED_TO_OPEN_POOL", entityType: "Lead", entityId: lead.id, reason: "Automatic 45-day claim timer expiration.", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, priorOwnerAgentId: lead.ownerAgentId, priorOpenPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null } } });
    }

    for (const lead of stalledOpenPoolLeads) {
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          pool: "SHARK_TANK",
          nextActionAt: null,
          lastActionAt: now,
        },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "LEAD_RELEASED", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, pool: "SHARK_TANK", reason: "OPEN_POOL_STALLED_21_DAYS", openPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null } } });
      await tx.auditLog.create({ data: { actorRole: "SYSTEM", actionType: "LEAD_PROMOTED_TO_SHARK_TANK", entityType: "Lead", entityId: lead.id, reason: "Open Pool record remained unclaimed for 21 days.", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, priorOpenPoolReleaseAt: lead.openPoolReleaseAt?.toISOString() ?? null, cutoff: sharkTankCutoff.toISOString() } } });
    }
  });

  return {
    ok: true,
    dryRun: false,
    processed: expiredClaimedLeads.length + stalledOpenPoolLeads.length,
    returnedToOpenPool: expiredClaimedLeads.length,
    promotedToSharkTank: stalledOpenPoolLeads.length,
    wouldProcess: 0,
    wouldReturnToOpenPool: 0,
    wouldPromoteToSharkTank: 0,
    limit,
    cutoff: sharkTankCutoff.toISOString(),
    preview: { returnedToOpenPool: [], promotedToSharkTank: [] },
  };
}
