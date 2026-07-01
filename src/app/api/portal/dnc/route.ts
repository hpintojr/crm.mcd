import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const schema = z.object({ leadId: z.string().cuid(), reason: z.string().trim().min(2).max(2000) });

export async function POST(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "A lead and DNC reason are required." }, { status: 422 });
  const agent = await db.agent.findUnique({ where: { userId: actor.id } });
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  const isAdmin = ADMIN_ROLES.includes(actor.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) return NextResponse.json({ error: "Lead access denied." }, { status: 403 });
  const identifier = lead.normalizedPhone ?? lead.businessPhone ?? lead.email ?? lead.id;
  const existing = await db.leadSuppression.findFirst({ where: { identifier, type: "DNC", active: true } });
  const now = new Date();
  await db.$transaction([
    ...(existing ? [] : [db.leadSuppression.create({ data: { leadId: lead.id, identifier, type: "DNC", reason: parsed.data.reason, createdById: actor.id } })]),
    db.lead.update({ where: { id: lead.id }, data: { dnc: true, suppressed: true, lifecycle: "SUPPRESSED", ownerAgentId: null, nextActionAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: lead.id, agentId: agent?.id, action: "RELEASED", reason: "DNC requested" } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "DNC_REQUESTED", metadata: { reason: parsed.data.reason } } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_SUPPRESSED", entityType: "Lead", entityId: lead.id, reason: parsed.data.reason, metadata: { type: "DNC" } }),
  ]);
  return NextResponse.json({ ok: true });
}
