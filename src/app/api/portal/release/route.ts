import { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { portalJson, portalRequestId, preparePortalJson } from "@/lib/portal-request-boundary";

export const dynamic = "force-dynamic";

const schema = z.object({ leadId: z.string().cuid(), reason: z.string().trim().max(2000).optional() });

export async function POST(request: NextRequest) {
  const requestId = portalRequestId(request);
  if (!features.leads) return portalJson({ error: "Not found." }, 404, requestId);

  const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const prepared = await preparePortalJson(request, requestId);
  if (!prepared.ok) return prepared.response;

  const parsed = schema.safeParse(prepared.raw);
  if (!parsed.success) return portalJson({ error: "Invalid release request." }, 422, requestId);

  const agent = await db.agent.findUnique({ where: { userId: actor.id } });
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  const isAdmin = ADMIN_ROLES.includes(actor.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) {
    return portalJson({ error: "Lead access denied." }, 403, requestId);
  }

  if (["DEMO_BOOKED", "CLOSED_WON"].includes(lead.lifecycle)) {
    return portalJson({ error: "Booked or won records cannot be released here." }, 409, requestId);
  }

  const now = new Date();
  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { ownerAgentId: null, lifecycle: "AVAILABLE", claimedAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: lead.id, agentId: agent?.id, action: "RELEASED", reason: parsed.data.reason } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "LEAD_RELEASED", metadata: parsed.data.reason ? { reason: parsed.data.reason } : undefined } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_RELEASED", entityType: "Lead", entityId: lead.id, reason: parsed.data.reason } }),
  ]);

  return portalJson({ ok: true }, 200, requestId);
}
