import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const schema = z.object({ leadId: z.string().cuid(), reason: z.string().trim().max(2000).optional() });

export async function POST(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid release request." }, { status: 422 });
  const agent = await db.agent.findUnique({ where: { userId: actor.id } });
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  const isAdmin = ADMIN_ROLES.includes(actor.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) return NextResponse.json({ error: "Lead access denied." }, { status: 403 });
  if (["DEMO_BOOKED", "CLOSED_WON"].includes(lead.lifecycle)) return NextResponse.json({ error: "Booked or won records cannot be released here." }, { status: 409 });
  const now = new Date();
  await db.$transaction([
    db.lead.update({ where: { id: lead.id }, data: { ownerAgentId: null, lifecycle: "AVAILABLE", claimedAt: null, openPoolReleaseAt: null, lastActionAt: now } }),
    db.leadClaimEvent.create({ data: { leadId: lead.id, agentId: agent?.id, action: "RELEASED", reason: parsed.data.reason } }),
    db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "LEAD_RELEASED", metadata: parsed.data.reason ? { reason: parsed.data.reason } : undefined } }),
    db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_RELEASED", entityType: "Lead", entityId: lead.id, reason: parsed.data.reason } }),
  ]);
  return NextResponse.json({ ok: true });
}
