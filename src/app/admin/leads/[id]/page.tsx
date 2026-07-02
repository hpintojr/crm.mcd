import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function AdminLeadDetailPage({ params }: PageProps) {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  const { id } = await params;
  const [lead, activities, notes, callbacks, audits] = await Promise.all([
    db.lead.findUnique({ where: { id } }),
    db.leadActivity.findMany({ where: { leadId: id }, orderBy: { occurredAt: "desc" }, take: 50 }),
    db.leadNote.findMany({ where: { leadId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.leadCallback.findMany({ where: { leadId: id }, orderBy: { dueAt: "desc" }, take: 30 }),
    db.auditLog.findMany({ where: { entityType: "Lead", entityId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  if (!lead) notFound();
  const owner = lead.ownerAgentId ? await db.agent.findUnique({ where: { id: lead.ownerAgentId }, select: { preferredName: true, legalName: true, personalEmail: true } }) : null;

  async function recordCloseWon(formData: FormData) {
    "use server";
    const actor = await requireRole(ADMIN_ROLES);
    const leadId = String(formData.get("leadId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    if (note.length < 8) throw new Error("Document the verified win before moving a Lead to Closed Won.");
    const current = await db.lead.findUnique({ where: { id: leadId } });
    if (!current) throw new Error("Lead not found.");
    if (current.dnc || current.suppressed) throw new Error("Suppressed Leads cannot be marked Closed Won.");
    if (current.lifecycle !== "DEMO_BOOKED") throw new Error("Only a demo-booked Lead can be moved to Closed Won from this control.");
    const now = new Date();
    await db.$transaction([
      db.lead.update({ where: { id: current.id }, data: { lifecycle: "CLOSED_WON", lastActionAt: now, nextActionAt: null } }),
      db.leadNote.create({ data: { leadId: current.id, agentId: current.ownerAgentId, body: `Verified Closed Won: ${note}` } }),
      db.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_CLOSED_WON_VERIFIED", entityType: "Lead", entityId: current.id, reason: note, metadata: { priorLifecycle: current.lifecycle, ownerAgentId: current.ownerAgentId } } }),
    ]);
    revalidatePath(`/admin/leads/${current.id}`);
    revalidatePath("/admin/leads");
    revalidatePath("/admin/servicing/onboarding");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  const eligibleForOnboarding = lead.lifecycle === "CLOSED_WON" && !lead.dnc && !lead.suppressed;
  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">{lead.company}</h1><p className="mt-2 text-gray-400">Admin Lead record, review history, and controlled lifecycle actions.</p></div><div className="flex flex-wrap gap-2"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads">Lead review</Link>{eligibleForOnboarding && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/servicing/onboarding">Start client onboarding</Link>}</div></div><section className="mt-8 grid gap-5 lg:grid-cols-3"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Lifecycle</p><p className="mt-2 text-xl font-semibold text-white">{label(lead.lifecycle)}</p><p className="mt-2 text-sm text-gray-400">Pool: {label(lead.pool)} · Score: {lead.score}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Contact</p><p className="mt-2 text-sm font-medium text-white">{lead.businessPhone}</p><p className="mt-1 text-sm text-gray-400">{lead.email || "No email recorded"}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Ownership</p><p className="mt-2 text-sm font-medium text-white">{owner ? owner.preferredName || owner.legalName : "House / unassigned"}</p><p className="mt-1 text-sm text-gray-400">{owner?.personalEmail || "No agent owner recorded"}</p></div></section><section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Source and safeguards</h2><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-gray-500">Original source</dt><dd className="mt-1 text-gray-200">{lead.originalSource ? label(lead.originalSource) : lead.source || "Not recorded"}</dd></div><div><dt className="text-gray-500">Intake</dt><dd className="mt-1 text-gray-200">{lead.intakeMethod ? label(lead.intakeMethod) : "Not recorded"}</dd></div><div><dt className="text-gray-500">GHL contact</dt><dd className="mt-1 break-all text-gray-200">{lead.ghlContactId || "Not linked"}</dd></div><div><dt className="text-gray-500">Contact safety</dt><dd className="mt-1 text-gray-200">{lead.dnc ? "DNC" : lead.suppressed ? "Suppressed" : "Eligible for controlled workflow"}</dd></div></dl></article><article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><h2 className="font-semibold text-white">Verified close decision</h2>{lead.lifecycle === "DEMO_BOOKED" && !lead.dnc && !lead.suppressed ? <form action={recordCloseWon} className="mt-4 grid gap-3"><input name="leadId" type="hidden" value={lead.id} /><p className="text-sm text-gray-400">Use only after the sale has been verified through the approved business process. This records the lifecycle decision; it does not create a client account, commission, payment, or payout.</p><textarea className="min-h-28 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Verification evidence and approved next step" required /><button className="justify-self-start rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Record Verified Closed Won</button></form> : <p className="mt-3 text-sm text-gray-400">{lead.lifecycle === "CLOSED_WON" ? "This Lead is ready for controlled client onboarding." : "Closed Won is available only for an active Demo Booked Lead."}</p>}</article></section><section className="mt-6 grid gap-5 lg:grid-cols-2"><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-5 py-4"><h2 className="font-semibold text-white">Interactions and callbacks</h2></div><div className="divide-y divide-ink-700">{activities.length === 0 && callbacks.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No interaction activity recorded.</p> : <>{activities.map((activity) => <div className="px-5 py-4" key={activity.id}><p className="text-sm font-medium text-white">{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}</p><p className="mt-1 text-xs text-gray-500">{pacific(activity.occurredAt)}</p></div>)}{callbacks.map((callback) => <div className="px-5 py-4" key={callback.id}><p className="text-sm font-medium text-white">Callback · {label(callback.status)}</p><p className="mt-1 text-xs text-gray-500">Due {pacific(callback.dueAt)}{callback.completedAt ? ` · Completed ${pacific(callback.completedAt)}` : ""}</p></div>)}</>}</div></article><article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900"><div className="border-b border-ink-700 px-5 py-4"><h2 className="font-semibold text-white">Notes and audit history</h2></div><div className="divide-y divide-ink-700">{notes.length === 0 && audits.length === 0 ? <p className="px-5 py-6 text-sm text-gray-400">No notes or audit history recorded.</p> : <>{notes.map((note) => <div className="px-5 py-4" key={note.id}><p className="text-sm text-gray-200">{note.body}</p><p className="mt-1 text-xs text-gray-500">{pacific(note.createdAt)}</p></div>)}{audits.map((audit) => <div className="px-5 py-4" key={audit.id}><p className="text-sm font-medium text-white">{label(audit.actionType)}</p>{audit.reason && <p className="mt-1 text-sm text-gray-300">{audit.reason}</p>}<p className="mt-1 text-xs text-gray-500">{pacific(audit.createdAt)}</p></div>)}</>}</div></article></section></main>;
}
