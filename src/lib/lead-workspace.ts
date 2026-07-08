import "server-only";

import { LeadDisposition, type LeadLifecycle, type LeadPool } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const interactionSchema = z.object({
  leadId: z.string().cuid(),
  disposition: z.nativeEnum(LeadDisposition),
  note: z.string().trim().max(2_000).optional(),
  callbackAtPacific: z.string().trim().optional(),
});

const leadIdSchema = z.object({
  leadId: z.string().cuid(),
});

const dncSchema = z.object({
  leadId: z.string().cuid(),
  reason: z.string().trim().max(2_000).optional(),
});

const twoWayDispositions: LeadDisposition[] = [
  LeadDisposition.CALLBACK_REQUESTED,
  LeadDisposition.QUALIFIED,
  LeadDisposition.NOT_INTERESTED,
  LeadDisposition.DEMO_BOOKED,
  LeadDisposition.FOLLOW_UP,
];

const claimEligibleDispositions: LeadDisposition[] = [
  LeadDisposition.CALLBACK_REQUESTED,
  LeadDisposition.QUALIFIED,
  LeadDisposition.DEMO_BOOKED,
  LeadDisposition.FOLLOW_UP,
];

const invalidContactDispositions: LeadDisposition[] = [
  LeadDisposition.WRONG_NUMBER,
  LeadDisposition.OUT_OF_BUSINESS,
];

function lifecycleFor(disposition: LeadDisposition): LeadLifecycle {
  if (disposition === LeadDisposition.DEMO_BOOKED) return "DEMO_BOOKED";
  if (disposition === LeadDisposition.NOT_INTERESTED) return "CLOSED_LOST";
  if (invalidContactDispositions.includes(disposition)) return "DISQUALIFIED";
  if (disposition === LeadDisposition.NO_ANSWER || disposition === LeadDisposition.VOICEMAIL) return "CLAIMED";
  if (disposition === LeadDisposition.CALLBACK_REQUESTED) return "NURTURING";
  return "CONTACTED";
}

function coldPoolFor(disposition: LeadDisposition): LeadPool {
  if (disposition === LeadDisposition.CALLBACK_REQUESTED) return "NURTURE";
  if (claimEligibleDispositions.includes(disposition)) return "HOT";
  return "COLD";
}

function coldLifecycleFor(disposition: LeadDisposition): LeadLifecycle {
  if (disposition === LeadDisposition.NO_ANSWER || disposition === LeadDisposition.VOICEMAIL) return "AVAILABLE";
  return lifecycleFor(disposition);
}

function isTwoWayContact(disposition: LeadDisposition) {
  return twoWayDispositions.includes(disposition);
}

function isClaimEligibleDisposition(disposition: LeadDisposition) {
  return claimEligibleDispositions.includes(disposition);
}

function pacificDateTime(value?: string) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Use a valid Pacific follow-up date and time.");
  const [, year, month, day, hour, minute] = match;
  const requestedAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(requestedAsUtc));
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? 0);
  const observedPacificAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  const result = new Date(requestedAsUtc - (observedPacificAsUtc - requestedAsUtc));
  if (Number.isNaN(result.valueOf()) || result <= new Date()) throw new Error("Schedule the follow-up for a future Pacific date and time.");
  return result;
}

async function activeAgent() {
  requireFeature("leads");
  const user = await requireRole(["AGENT"]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  if (!agent?.canClaimLeads) throw new Error("Lead access is pending manager certification.");
  return { user, agent };
}

export async function logColdLeadCallInitiated(input: { leadId: string }) {
  const parsed = leadIdSchema.parse(input);
  const { user, agent } = await activeAgent();
  const lead = await db.lead.findFirst({
    where: {
      id: parsed.leadId,
      ownerAgentId: null,
      pool: { in: ["COLD", "HOT", "NURTURE"] },
      lifecycle: { in: ["AVAILABLE", "CONTACTED", "NURTURING"] },
      dnc: false,
      suppressed: false,
    },
    select: { id: true, pool: true, lifecycle: true },
  });
  if (!lead) throw new Error("This Cold Lead is no longer available for activity logging.");
  const now = new Date();

  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { lastActionAt: now } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "CALL_INITIATED", metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, claimCreated: false, rule: "ACTIVITY_ONLY_NO_SOFT_LOCK" } } }),
    db.auditLog.create({ data: { actorUserId: user.id, actorRole: user.role, actionType: "COLD_LEAD_CALL_INITIATED", entityType: "Lead", entityId: lead.id, metadata: { priorPool: lead.pool, priorLifecycle: lead.lifecycle, claimCreated: false } } }),
  ]);
}

export async function logColdLeadDisposition(input: { leadId: string; disposition: string; note?: string; callbackAtPacific?: string }) {
  const parsed = interactionSchema.parse(input);
  if (parsed.disposition === LeadDisposition.DO_NOT_CONTACT) throw new Error("Use the DNC action to suppress a contact.");
  const { user, agent } = await activeAgent();
  const lead = await db.lead.findFirst({
    where: {
      id: parsed.leadId,
      ownerAgentId: null,
      pool: { in: ["COLD", "HOT", "NURTURE"] },
      lifecycle: { in: ["AVAILABLE", "CONTACTED", "NURTURING"] },
      dnc: false,
      suppressed: false,
    },
  });
  if (!lead) throw new Error("This Cold Lead is no longer available for disposition logging.");

  const now = new Date();
  const callbackAt = pacificDateTime(parsed.callbackAtPacific);
  if (parsed.disposition === LeadDisposition.CALLBACK_REQUESTED && !callbackAt) throw new Error("A callback time is required when the prospect requests a callback.");
  const lifecycle = coldLifecycleFor(parsed.disposition);
  const pool = coldPoolFor(parsed.disposition);
  const invalidContact = invalidContactDispositions.includes(parsed.disposition);
  const claimEligible = isClaimEligibleDisposition(parsed.disposition);
  const note = parsed.note?.trim() || undefined;
  const nextActionAt = invalidContact || lifecycle === "CLOSED_LOST" || lifecycle === "DEMO_BOOKED" ? null : callbackAt;

  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: {
      pool,
      lifecycle,
      lastActionAt: now,
      nextActionAt,
      twoWayContactAt: isTwoWayContact(parsed.disposition) ? lead.twoWayContactAt ?? now : lead.twoWayContactAt,
      suppressed: invalidContact,
    } });
    await tx.leadCallback.updateMany({ where: { leadId: lead.id, agentId: agent.id, status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: now } });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "CALL_COMPLETED", disposition: parsed.disposition, metadata: { callbackAt: callbackAt?.toISOString() ?? null, invalidContact, claimEligible, claimCreated: false, priorPool: lead.pool, nextPool: pool, priorLifecycle: lead.lifecycle, nextLifecycle: lifecycle } } });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "DISPOSITION_SET", disposition: parsed.disposition, metadata: { claimEligible, twoWayContact: isTwoWayContact(parsed.disposition), callbackAt: callbackAt?.toISOString() ?? null } } });
    if (note) {
      await tx.leadNote.create({ data: { leadId: lead.id, agentId: agent.id, body: note } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "NOTE_ADDED" } });
    }
    if (callbackAt && !invalidContact && lifecycle !== "CLOSED_LOST" && lifecycle !== "DEMO_BOOKED") {
      await tx.leadCallback.create({ data: { leadId: lead.id, agentId: agent.id, dueAt: callbackAt } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "CALLBACK_SCHEDULED", metadata: { dueAt: callbackAt.toISOString(), reservesLead: false } } });
    }
    if (invalidContact) {
      await tx.leadSuppression.create({ data: { leadId: lead.id, identifier: lead.normalizedPhone || lead.businessPhone, type: "INVALID_PHONE", reason: note || parsed.disposition, createdById: user.id } });
    }
    await tx.auditLog.create({ data: { actorUserId: user.id, actorRole: user.role, actionType: "COLD_LEAD_DISPOSITION_RECORDED", entityType: "Lead", entityId: lead.id, metadata: { disposition: parsed.disposition, priorPool: lead.pool, pool, priorLifecycle: lead.lifecycle, lifecycle, callbackAt: callbackAt?.toISOString() ?? null, invalidContact, claimEligible, claimCreated: false } } });
  });
}

export async function logLeadInteraction(input: { leadId: string; disposition: string; note?: string; callbackAtPacific?: string }) {
  const parsed = interactionSchema.parse(input);
  if (parsed.disposition === LeadDisposition.DO_NOT_CONTACT) throw new Error("Use the DNC action to suppress a contact.");
  const { user, agent } = await activeAgent();
  const lead = await db.lead.findFirst({ where: { id: parsed.leadId, ownerAgentId: agent.id, dnc: false, suppressed: false } });
  if (!lead) throw new Error("This record is no longer available in your workspace.");

  const now = new Date();
  const callbackAt = pacificDateTime(parsed.callbackAtPacific);
  const lifecycle = lifecycleFor(parsed.disposition);
  const invalidContact = invalidContactDispositions.includes(parsed.disposition);
  const terminal = ["DEMO_BOOKED", "CLOSED_LOST", "DISQUALIFIED"] as LeadLifecycle[];
  const note = parsed.note?.trim() || undefined;

  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: {
      lifecycle,
      lastActionAt: now,
      nextActionAt: terminal.includes(lifecycle) ? null : callbackAt,
      twoWayContactAt: isTwoWayContact(parsed.disposition) ? lead.twoWayContactAt ?? now : lead.twoWayContactAt,
      suppressed: invalidContact,
    } });
    await tx.leadCallback.updateMany({ where: { leadId: lead.id, agentId: agent.id, status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: now } });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "CALL_COMPLETED", disposition: parsed.disposition, metadata: { callbackAt: callbackAt?.toISOString() ?? null, invalidContact } } });
    if (note) {
      await tx.leadNote.create({ data: { leadId: lead.id, agentId: agent.id, body: note } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "NOTE_ADDED" } });
    }
    if (callbackAt && !terminal.includes(lifecycle)) {
      await tx.leadCallback.create({ data: { leadId: lead.id, agentId: agent.id, dueAt: callbackAt } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "CALLBACK_SCHEDULED", metadata: { dueAt: callbackAt.toISOString() } } });
    }
    if (invalidContact) {
      await tx.leadSuppression.create({ data: { leadId: lead.id, identifier: lead.normalizedPhone || lead.businessPhone, type: "INVALID_PHONE", reason: note || parsed.disposition, createdById: user.id } });
    }
    await tx.auditLog.create({ data: { actorUserId: user.id, actorRole: user.role, actionType: "LEAD_INTERACTION_RECORDED", entityType: "Lead", entityId: lead.id, metadata: { disposition: parsed.disposition, lifecycle, callbackAt: callbackAt?.toISOString() ?? null, invalidContact } } });
  });
}

export async function suppressLeadForDnc(input: { leadId: string; reason?: string }) {
  const parsed = dncSchema.parse(input);
  const { user, agent } = await activeAgent();
  const lead = await db.lead.findFirst({
    where: {
      id: parsed.leadId,
      dnc: false,
      suppressed: false,
      OR: [{ ownerAgentId: agent.id }, { ownerAgentId: null }],
    },
  });
  if (!lead) throw new Error("This record is no longer available in your workspace.");
  const now = new Date();
  const reason = parsed.reason?.trim() || "Contact requested no further communication.";

  await db.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: lead.id }, data: { lifecycle: "SUPPRESSED", dnc: true, suppressed: true, lastActionAt: now, nextActionAt: null, openPoolReleaseAt: null } });
    await tx.leadCallback.updateMany({ where: { leadId: lead.id, status: "SCHEDULED" }, data: { status: "CANCELLED" } });
    await tx.leadSuppression.create({ data: { leadId: lead.id, identifier: lead.normalizedPhone || lead.businessPhone, type: "DNC", reason, createdById: user.id } });
    await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "DNC_REQUESTED", disposition: "DO_NOT_CONTACT", metadata: { reason, absoluteBlackout: true } } });
    await tx.auditLog.create({ data: { actorUserId: user.id, actorRole: user.role, actionType: "LEAD_DNC_APPLIED", entityType: "Lead", entityId: lead.id, reason, metadata: { absoluteBlackout: true, priorOwnerAgentId: lead.ownerAgentId } } });
  });
}
