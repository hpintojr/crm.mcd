import { NextRequest } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { portalJson, portalRequestId, preparePortalJson } from "@/lib/portal-request-boundary";

export const dynamic = "force-dynamic";

const schema = z.object({ leadId: z.string().cuid(), reason: z.string().trim().min(2).max(2000) });

export async function POST(request: NextRequest) {
  const requestId = portalRequestId(request);
  if (!features.leads) return portalJson({ error: "Not found." }, 404, requestId);

  const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const prepared = await preparePortalJson(request, requestId);
  if (!prepared.ok) return prepared.response;

  const parsed = schema.safeParse(prepared.raw);
  if (!parsed.success) return portalJson({ error: "A lead and DNC reason are required." }, 422, requestId);

  const agent = await db.agent.findUnique({ where: { userId: actor.id } });
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  const isAdmin = ADMIN_ROLES.includes(actor.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) {
    return portalJson({ error: "Lead access denied." }, 403, requestId);
  }

  const identifier = lead.normalizedPhone ?? lead.businessPhone ?? lead.email ?? lead.id;
  const existing = await db.leadSuppression.findFirst({ where: { identifier, type: "DNC", active: true } });
  const now = new Date();
  await db.$transaction([
    ...(existing ? [] : [db.leadSuppression.create({ data: { leadId: lead.id, identifier, type: "DNC", reason: parsed.data.reason, createdById: actor.id } })]),
    db.lead.update({ where: { id: lead.id }, data: { dnc: true, suppressed: true, lifecycle: "SUPPRESSED", ownerAgentId: null, nextActionAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: lead.id, agentId: agent?.id, action: "RELEASED", reason: "DNC requested" } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "DNC_REQUESTED", metadata: { reason: parsed.data.reason } } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_SUPPRESSED", entityType: "Lead", entityId: lead.id, reason: parsed.data.reason, metadata: { type: "DNC" } } }),
  ]);

  return portalJson({ ok: true }, 200, requestId);
}
