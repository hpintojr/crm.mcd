import { LeadDisposition } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

const dispositions = ["NO_ANSWER", "VOICEMAIL", "CALLBACK_REQUESTED", "QUALIFIED", "NOT_INTERESTED", "WRONG_NUMBER", "OUT_OF_BUSINESS", "DEMO_BOOKED", "FOLLOW_UP"] as const;
const schema = z.object({
  leadId: z.string().cuid(),
  action: z.enum(["CALL", "NOTE", "CALLBACK", "DISPOSITION"]),
  note: z.string().trim().max(5000).optional(),
  dueAt: z.string().datetime().optional(),
  disposition: z.enum(dispositions).optional(),
});

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
  const note = parsed.data.note?.trim();

  if (parsed.data.action !== "CALL" && (!note || note.length < 2)) return NextResponse.json({ error: "A meaningful note is required." }, { status: 422 });

  if (parsed.data.action === "CALL") {
    if (lead.dnc || lead.suppressed) return NextResponse.json({ error: "This record is suppressed." }, { status: 409 });
    await db.$transaction([
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "CALL_INITIATED" } }),
      db.lead.update({ where: { id: lead.id }, data: { lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_CALL_INITIATED", entityType: "Lead", entityId: lead.id } }),
    ]);
  }

  if (parsed.data.action === "NOTE") {
    await db.$transaction([
      db.leadNote.create({ data: { leadId: lead.id, agentId: agent?.id, body: note! } }),
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "NOTE_ADDED" } }),
      db.lead.update({ where: { id: lead.id }, data: { lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_NOTE_ADDED", entityType: "Lead", entityId: lead.id } }),
    ]);
  }

  if (parsed.data.action === "CALLBACK") {
    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    if (!dueAt || Number.isNaN(dueAt.getTime()) || dueAt <= now) return NextResponse.json({ error: "A future callback time is required." }, { status: 422 });
    await db.$transaction([
      db.leadNote.create({ data: { leadId: lead.id, agentId: agent?.id, body: note! } }),
      db.leadCallback.create({ data: { leadId: lead.id, agentId: agent?.id, dueAt } }),
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "CALLBACK_SCHEDULED", metadata: { dueAt: dueAt.toISOString() } } }),
      db.lead.update({ where: { id: lead.id }, data: { nextActionAt: dueAt, lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_CALLBACK_SCHEDULED", entityType: "Lead", entityId: lead.id } }),
    ]);
  }

  if (parsed.data.action === "DISPOSITION") {
    if (!parsed.data.disposition) return NextResponse.json({ error: "A disposition is required." }, { status: 422 });
    const disposition = parsed.data.disposition as LeadDisposition;
    const twoWay = ["QUALIFIED", "CALLBACK_REQUESTED", "DEMO_BOOKED"].includes(disposition);
    const twoWayContactAt = twoWay ? lead.twoWayContactAt ?? now : lead.twoWayContactAt;
    const openPoolReleaseAt = disposition === "DEMO_BOOKED" ? null : twoWayContactAt ? new Date(twoWayContactAt.getTime() + 45 * 86400000) : lead.openPoolReleaseAt;
    await db.$transaction([
      db.leadNote.create({ data: { leadId: lead.id, agentId: agent?.id, body: note! } }),
      db.leadActivity.create({ data: { leadId: lead.id, agentId: agent?.id, type: "DISPOSITION_SET", disposition } }),
      db.lead.update({ where: { id: lead.id }, data: { lifecycle: disposition === "DEMO_BOOKED" ? "DEMO_BOOKED" : "CONTACTED", twoWayContactAt, openPoolReleaseAt, lastActionAt: now } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_DISPOSITION_SET", entityType: "Lead", entityId: lead.id, metadata: { disposition } } }),
    ]);
  }

  return NextResponse.json({ ok: true });
}
