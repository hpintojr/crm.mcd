import "server-only";

import { LeadActivityType, LeadClaimAction, LeadLifecycle, LeadPool, SuppressionType, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const CLAIMABLE_POOLS: LeadPool[] = ["COLD", "OPEN", "HOT", "REFERRAL"];
const ACTIVE_STATES: LeadLifecycle[] = ["CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"];

export type WorkActor = { userId: string; role: UserRole };

function isAdmin(role: UserRole) {
  return role !== "AGENT" && role !== "FORMER_SERVICING_AGENT";
}

function positiveEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeBusinessPhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

async function agentFor(actor: WorkActor) {
  requireFeature("leads");
  const agent = await db.agent.findUnique({ where: { userId: actor.userId } });
  if (!agent) throw new Error("This account is not linked to an agent profile.");
  if (!isAdmin(actor.role) && !agent.canClaimLeads) throw new Error("Lead access is pending manager certification.");
  return agent;
}

export async function claimAvailableRecord(actor: WorkActor, recordId: string) {
  const agent = await agentFor(actor);
  const now = new Date();
  const capacity = positiveEnv("LEAD_CLAIM_CAPACITY", 50);
  const releaseDays = positiveEnv("OPEN_POOL_RELEASE_DAYS", 45);
  const releaseAt = new Date(now.getTime() + releaseDays * 86400000);

  return db.$transaction(async (tx) => {
    if (!isAdmin(actor.role)) {
      const current = await tx.lead.count({
        where: { ownerAgentId: agent.id, lifecycle: { in: ACTIVE_STATES }, dnc: false, suppressed: false },
      });
      if (current >= capacity) throw new Error(`Active lead capacity of ${capacity} reached.`);
    }

    const result = await tx.lead.updateMany({
      where: { id: recordId, ownerAgentId: null, lifecycle: "AVAILABLE", pool: { in: CLAIMABLE_POOLS }, dnc: false, suppressed: false },
      data: { ownerAgentId: agent.id, lifecycle: "CLAIMED", claimedAt: now, lastActionAt: now, openPoolReleaseAt: releaseAt },
    });
    if (result.count !== 1) throw new Error("This record is no longer available.");

    await Promise.all([
      tx.leadClaimEvent.create({ data: { leadId: recordId, agentId: agent.id, action: "CLAIMED" } }),
      tx.leadActivity.create({ data: { leadId: recordId, agentId: agent.id, type: "LEAD_CLAIMED" } }),
      tx.auditLog.create({ data: { actorUserId: actor.userId, actorRole: actor.role, actionType: "LEAD_CLAIMED", entityType: "Lead", entityId: recordId } }),
    ]);
    return tx.lead.findUniqueOrThrow({ where: { id: recordId } });
  });
}

export async function releaseClaimedRecord(actor: WorkActor, recordId: string, reason?: string) {
  const agent = await agentFor(actor);
  const record = await db.lead.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("Lead not found.");
  if (!isAdmin(actor.role) && record.ownerAgentId !== agent.id) throw new Error("You do not own this lead.");
  if (record.lifecycle === "DEMO_BOOKED" || record.lifecycle === "CLOSED_WON") throw new Error("Booked or won records cannot be released here.");

  const now = new Date();
  await db.$transaction([
    db.lead.update({ where: { id: recordId }, data: { ownerAgentId: null, lifecycle: "AVAILABLE", claimedAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: recordId, agentId: agent.id, action: "RELEASED", reason } }),
    db.leadActivity.create({ data: { leadId: recordId, agentId: agent.id, type: "LEAD_RELEASED", metadata: reason ? { reason } : undefined }),
    db.auditLog.create({ data: { actorUserId: actor.userId, actorRole: actor.role, actionType: "LEAD_RELEASED", entityType: "Lead", entityId: recordId, reason } }),
  ]);
}

export async function suppressRecord(actor: WorkActor, recordId: string, type: SuppressionType, reason: string) {
  const agent = await agentFor(actor);
  const record = await db.lead.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("Lead not found.");
  if (!isAdmin(actor.role) && record.ownerAgentId !== agent.id) throw new Error("You do not own this lead.");
  const identifier = record.normalizedPhone ?? normalizeBusinessPhone(record.businessPhone) ?? record.email ?? record.id;
  const now = new Date();

  await db.$transaction(async (tx) => {
    const existing = await tx.leadSuppression.findFirst({ where: { identifier, type, active: true } });
    if (!existing) await tx.leadSuppression.create({ data: { leadId: recordId, identifier, type, reason, createdById: actor.userId } });
    await Promise.all([
      tx.lead.update({ where: { id: recordId }, data: { dnc: type === "DNC" || type === "OPT_OUT", suppressed: true, lifecycle: "SUPPRESSED", ownerAgentId: null, nextActionAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
      tx.leadClaimEvent.create({ data: { leadId: recordId, agentId: agent.id, action: "RELEASED", reason: `Suppressed: ${type}` } }),
      tx.leadActivity.create({ data: { leadId: recordId, agentId: agent.id, type: "DNC_REQUESTED", metadata: { type, reason } } }),
      tx.auditLog.create({ data: { actorUserId: actor.userId, actorRole: actor.role, actionType: "LEAD_SUPPRESSED", entityType: "Lead", entityId: recordId, reason, metadata: { type } } }),
    ]);
  });
}
