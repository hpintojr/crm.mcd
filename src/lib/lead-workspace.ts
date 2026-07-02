import "server-only";

import { LeadDisposition, type LeadLifecycle } from "@prisma/client";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";

const interactionSchema = z.object({
  leadId: z.string().cuid(),
  disposition: z.nativeEnum(LeadDisposition).exclude([LeadDisposition.DO_NOT_CONTACT]),
  note: z.string().trim().max(2_000).optional(),
  callbackAtPacific: z.string().trim().optional(),
});

const dncSchema = z.object({
  leadId: z.string().cuid(),
  reason: z.string().trim().max(2_000).optional(),
});

function lifecycleFor(disposition: LeadDisposition): LeadLifecycle {
  if (disposition === LeadDisposition.DEMO_BOOKED) return "DEMO_BOOKED";
  if (disposition === LeadDisposition.NOT_INTERESTED) return "CLOSED_LOST";
  if (disposition === LeadDisposition.WRONG_NUMBER || disposition === LeadDisposition.OUT_OF_BUSINESS) return "DISQUALIFIED";
  if (disposition === LeadDisposition.NO_ANSWER || disposition === LeadDisposition.VOICEMAIL) return "CLAIMED";
  return "CONTACTED";
}

function isTwoWayContact(disposition: LeadDisposition) {
  return [LeadDisposition.CALLBACK_REQUESTED, LeadDisposition.QUALIFIED, LeadDisposition.NOT_INTERESTED, LeadDisposition.DEMO_BOOKED, LeadDisposition.FOLLOW_UP].includes(disposition);
}

async function activeAgent() {
  requireFeature("leads");
  const user = await requireRole(["AGENT"]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  if (!agent?.canClaimLeads) throw new Error("Lead access is pending manager certification.");
  return { user, agent };
}

export { activeAgent, dncSchema, interactionSchema, isTwoWayContact, lifecycleFor };
