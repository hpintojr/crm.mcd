import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

const assignmentSchema = z.object({
  leadId: z.string().cuid(),
  agentId: z.string().cuid(),
  note: z.string().trim().min(3).max(2_000),
});

function metadataSource(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = (metadata as { source?: unknown }).source;
  return source === "GHL_INBOUND_REPLY" ? source : null;
}

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function WarmReplyQueuePage() {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [activities, agents] = await Promise.all([
    db.leadActivity.findMany({ where: { type: "NOTE_ADDED", occurredAt: { gte: cutoff } }, orderBy: { occurredAt: "desc" }, take: 400 }),
    db.agent.findMany({ where: { status: "ACTIVE" }, orderBy: [{ preferredName: "asc" }, { legalName: "asc" }], select: { id: true, preferredName: true, legalName: true, personalEmail: true } }),
  ]);
  const latestReplyByLead = new Map<string, typeof activities[number]>();
  for (const activity of activities) {
    if (metadataSource(activity.metadata) && !latestReplyByLead.has(activity.leadId)) latestReplyByLead.set(activity.leadId, activity);
  }
  const replyLeadIds = [...latestReplyByLead.keys()];
  const [leads, notes] = await Promise.all([
    replyLeadIds.length ? db.lead.findMany({ where: { id: { in: replyLeadIds }, ownerAgentId: null, suppressed: false, dnc: false, lifecycle: { in: ["AVAILABLE", "CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"] } }, orderBy: { lastActionAt: "desc" }, take: 100 }) : Promise.resolve([]),
    replyLeadIds.length ? db.leadNote.findMany({ where: { leadId: { in: replyLeadIds }, body: { startsWith: "Inbound " } }, orderBy: { createdAt: "desc" }, take: 400 }) : Promise.resolve([]),
  ]);
  const latestNoteByLead = new Map<string, typeof notes[number]>();
  for (const note of notes) if (!latestNoteByLead.has(note.leadId)) latestNoteByLead.set(note.leadId, note);
  const queue = leads.map((lead) => ({ lead, activity: latestReplyByLead.get(lead.id), note: latestNoteByLead.get(lead.id) })).filter((item) => item.activity).sort((left, right) => (right.activity?.occurredAt.getTime() || 0) - (left.activity?.occurredAt.getTime() || 0));

  async function assignWarmReply(formData: FormData) {
    "use server";
    const actor = await requireRole(ADMIN_ROLES);
    const parsed = assignmentSchema.parse({ leadId: formData.get("leadId"), agentId: formData.get("agentId"), note: formData.get("note") });
    const [lead, agent] = await Promise.all([
      db.lead.findUnique({ where: { id: parsed.leadId } }),
      db.agent.findFirst({ where: { id: parsed.agentId, status: "ACTIVE" }, select: { id: true } }),
    ]);
    if (!lead) throw new Error("Lead not found.");
    if (!agent) throw new Error("Choose an active agent.");
    if (lead.dnc || lead.suppressed) throw new Error("Suppressed Leads cannot be assigned from warm-reply triage.");
    if (lead.ownerAgentId) throw new Error("This Lead already has an owner.");
    if (!["AVAILABLE", "CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"].includes(lead.lifecycle)) throw new Error("This Lead is not eligible for warm-reply assignment.");
    const now = new Date();
    await db.$transaction(async (tx) => {
      const assigned = await tx.lead.updateMany({
        where: { id: lead.id, ownerAgentId: null, dnc: false, suppressed: false, lifecycle: { in: ["AVAILABLE", "CLAIMED", "CONTACTED", "NURTURING", "DEMO_BOOKED"] } },
        data: { ownerAgentId: agent.id, claimedAt: lead.claimedAt ?? now, lastActionAt: now, nextActionAt: now },
      });
      if (assigned.count !== 1) throw new Error("This Lead changed before assignment. Refresh the queue and try again.");
      await tx.leadClaimEvent.create({ data: { leadId: lead.id, agentId: agent.id, action: "REASSIGNED", reason: `Warm reply triage: ${parsed.note}` } });
      await tx.leadActivity.create({ data: { leadId: lead.id, agentId: agent.id, type: "REASSIGNED", metadata: { source: "WARM_REPLY_TRIAGE", note: parsed.note } } });
      await tx.leadCallback.create({ data: { leadId: lead.id, agentId: agent.id, dueAt: now } });
      await tx.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_WARM_REPLY_ASSIGNED", entityType: "Lead", entityId: lead.id, reason: parsed.note, metadata: { assignedAgentId: agent.id } } });
    });
    revalidatePath("/admin/leads/replies");
    revalidatePath("/admin/leads");
    revalidatePath("/portal/inbox");
    revalidatePath("/portal/tasks");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Warm reply triage</h1><p className="mt-2 max-w-3xl text-gray-400">Unassigned active Leads that replied by verified GHL email or SMS in the last 14 days. Assigning a reply creates immediate owner follow-up work and a complete audit trail.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads">Lead review</Link></div><section className="mt-6 rounded-xl border border-ink-700 bg-ink-900 px-5 py-4 text-sm text-gray-300">Suppressed, DNC, closed, and already-owned Leads are intentionally excluded. This queue does not bypass normal compliance controls or create direct Open Pool placement.</section><section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Unassigned replies requiring sales assignment</h2></div>{queue.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No unassigned active warm replies are waiting for triage.</p> : <div className="divide-y divide-ink-700">{queue.map(({ lead, activity, note }) => <article className="px-6 py-5" key={lead.id}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p><p className="mt-1 text-xs text-gray-500">{label(lead.lifecycle)} · Reply received {pacific(activity?.occurredAt || null)} · Two-way contact {pacific(lead.twoWayContactAt)}</p>{note && <p className="mt-3 max-w-3xl rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm text-gray-300">{note.body}</p>}</div><Link className="shrink-0 rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/${lead.id}`}>Open Lead</Link></div><form action={assignWarmReply} className="mt-5 grid gap-3 border-t border-ink-700 pt-5 lg:grid-cols-[0.8fr_1fr_auto]"><input name="leadId" type="hidden" value={lead.id} /><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="agentId" defaultValue="" required><option value="" disabled>Assign active agent</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.preferredName || agent.legalName} · {agent.personalEmail}</option>)}</select><input className="min-w-0 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Assignment reason and next step" required /><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Assign and create callback</button></form></article>)}</div>}</section></main>;
}
