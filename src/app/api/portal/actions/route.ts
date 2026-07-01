import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const schema = z.object({ leadId: z.string().cuid(), action: z.enum(["CALL", "NOTE"]), note: z.string().trim().max(5000).optional() });

export async function POST(request: NextRequest) {
  if (!features.leads) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid activity request." }, { status: 422 });
  const agent = await db.agent.findUnique({ where: { userId: actor.id } });
  const lead = await db.lead.findUnique({ where: { id: parsed.data.leadId } });
  const isAdmin = ADMIN_ROLES.includes(actor.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) return NextResponse.json({ error: "Lead access denied." }, { status: 403 });
  const now = new Date();

  if (parsed.data.action === "CALL") {
    if (lead.dnc || lead.suppressed) return NextResponse.json({ error: "This record is suppressed." }, { status: 409 });
    await db.$transaction([
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "CALL_INITIATED" } }),
      db.lead.update({ where: { id: lead.id }, data: { lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_CALL_INITIATED", entityType: "Lead", entityId: lead.id } }),
    ]);
  }

  if (parsed.data.action === "NOTE") {
    const note = parsed.data.note?.trim();
    if (!note || note.length < 2) return NextResponse.json({ error: "A meaningful note is required." }, { status: 422 });
    await db.$transaction([
      db.leadNote.create({ data: { leadId: lead.id, agentId: agent?.id, body: note } }),
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "NOTE_ADDED" } }),
      db.lead.update({ where: { id: lead.id }, data: { lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_NOTE_ADDED", entityType: "Lead", entityId: lead.id } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
