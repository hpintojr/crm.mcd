import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
}

function pacific(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

export default async function AdminLeadDetailPage({ params }: { params: Promise<{ leadId: string }> }) {
  if (!features.leads) notFound();
  await requireRole(ADMIN_ROLES);
  const { leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) notFound();

  const [owner, activities, notes, callbacks, claims, suppressions] = await Promise.all([
    lead.ownerAgentId ? db.agent.findUnique({ where: { id: lead.ownerAgentId }, select: { preferredName: true, legalName: true, personalEmail: true } }) : null,
    db.leadActivity.findMany({ where: { leadId: lead.id }, orderBy: { occurredAt: "desc" }, take: 100 }),
    db.leadNote.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.leadCallback.findMany({ where: { leadId: lead.id }, orderBy: { dueAt: "desc" }, take: 100 }),
    db.leadClaimEvent.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.leadSuppression.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const ownerName = owner?.preferredName || owner?.legalName || owner?.personalEmail || "House / unassigned";
  const eligibleForOnboarding = lead.lifecycle === "CLOSED_WON" && !lead.dnc && !lead.suppressed;

  async function recordCloseWon(formData: FormData) {
    "use server";

    const actor = await requireRole(ADMIN_ROLES);
    const actionLeadId = String(formData.get("leadId") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();

    if (note.length < 8) throw new Error("Document the verified win before moving a Lead to Closed Won.");

    const current = await db.lead.findUnique({ where: { id: actionLeadId } });
    if (!current) throw new Error("Lead not found.");
    if (current.dnc || current.suppressed) throw new Error("Suppressed Leads cannot be marked Closed Won.");
    if (current.lifecycle !== "DEMO_BOOKED") throw new Error("Only a demo-booked Lead can be moved to Closed Won from this control.");

    const now = new Date();
    await db.$transaction([
      db.lead.update({ where: { id: current.id }, data: { lifecycle: "CLOSED_WON", lastActionAt: now, nextActionAt: null } }),
      db.leadNote.create({ data: { leadId: current.id, agentId: current.ownerAgentId, body: `Verified Closed Won: ${note}` } }),
      db.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorRole: actor.role,
          actionType: "LEAD_CLOSED_WON_VERIFIED",
          entityType: "Lead",
          entityId: current.id,
          reason: note,
          metadata: { priorLifecycle: current.lifecycle, ownerAgentId: current.ownerAgentId },
        },
      }),
    ]);

    revalidatePath(`/admin/leads/${current.id}`);
    revalidatePath("/admin/leads");
    revalidatePath("/admin/servicing/onboarding");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{lead.company}</h1>
          <p className="mt-2 text-gray-400">{lead.businessPhone} · {lead.email || "No email recorded"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads">Lead review</Link>
          {lead.lifecycle === "DEMO_BOOKED" && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/handoff">GHL handoff</Link>}
          {eligibleForOnboarding && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/servicing/onboarding">Start client onboarding</Link>}
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Lifecycle</p><p className="mt-1 font-medium text-white">{label(lead.lifecycle)}</p></div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Pool</p><p className="mt-1 font-medium text-white">{label(lead.pool)}</p></div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Servicing / sales owner</p><p className="mt-1 font-medium text-white">{ownerName}</p></div>
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4"><p className="text-xs text-gray-500">Compliance</p><p className="mt-1 font-medium text-white">{lead.dnc ? "DNC" : lead.suppressed ? "Suppressed" : "Active"}</p></div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Source and attribution</h2>
          <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Original source</dt><dd className="text-gray-200">{label(lead.originalSource)}</dd></div>
            <div><dt className="text-gray-500">Intake</dt><dd className="text-gray-200">{label(lead.intakeMethod)}</dd></div>
            <div><dt className="text-gray-500">Campaign</dt><dd className="text-gray-200">{lead.campaignName || "—"}</dd></div>
            <div><dt className="text-gray-500">Referral</dt><dd className="text-gray-200">{lead.referrerName || lead.referralSource || "—"}</dd></div>
            <div><dt className="text-gray-500">Website</dt><dd className="break-all text-gray-200">{lead.website || "—"}</dd></div>
            <div><dt className="text-gray-500">Website opportunity</dt><dd className="text-gray-200">{label(lead.websiteOpportunityStatus)}</dd></div>
            <div><dt className="text-gray-500">UTM source</dt><dd className="text-gray-200">{lead.utmSource || "—"}</dd></div>
            <div><dt className="text-gray-500">UTM campaign</dt><dd className="text-gray-200">{lead.utmCampaign || "—"}</dd></div>
          </dl>
        </article>
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">CRM and GHL state</h2>
          <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-gray-500">Score</dt><dd className="text-gray-200">{lead.score}</dd></div>
            <div><dt className="text-gray-500">Two-way contact</dt><dd className="text-gray-200">{pacific(lead.twoWayContactAt)}</dd></div>
            <div><dt className="text-gray-500">Next action</dt><dd className="text-gray-200">{pacific(lead.nextActionAt)}</dd></div>
            <div><dt className="text-gray-500">Open Pool release</dt><dd className="text-gray-200">{pacific(lead.openPoolReleaseAt)}</dd></div>
            <div><dt className="text-gray-500">GHL contact</dt><dd className="break-all text-gray-200">{lead.ghlContactId || "—"}</dd></div>
            <div><dt className="text-gray-500">GHL appointment</dt><dd className="break-all text-gray-200">{lead.ghlAppointmentId || "—"}</dd></div>
          </dl>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Verified close decision</h2>
        {lead.lifecycle === "DEMO_BOOKED" && !lead.dnc && !lead.suppressed ? (
          <form action={recordCloseWon} className="mt-4 grid gap-3">
            <input name="leadId" type="hidden" value={lead.id} />
            <p className="text-sm text-gray-400">Use only after the sale has been verified through the approved business process. This records the lifecycle decision; it does not create a client account, commission, payment, or payout.</p>
            <textarea className="min-h-28 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" placeholder="Verification evidence and approved next step" required />
            <button className="justify-self-start rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Record Verified Closed Won</button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-gray-400">{lead.lifecycle === "CLOSED_WON" ? "This Lead is ready for controlled client onboarding." : "Closed Won is available only for an active Demo Booked Lead."}</p>
        )}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
          <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Activity timeline</h2></div>
          {activities.length === 0 ? <p className="px-6 py-8 text-sm text-gray-400">No activity recorded.</p> : <div className="divide-y divide-ink-700">{activities.map((activity) => <div className="px-6 py-4" key={activity.id}><p className="text-sm font-medium text-white">{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}</p><p className="mt-1 text-xs text-gray-500">{pacific(activity.occurredAt)}</p>{activity.metadata && <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-950 p-2 text-xs text-gray-400">{JSON.stringify(activity.metadata, null, 2)}</pre>}</div>)}</div>}
        </article>
        <div className="space-y-6">
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Callbacks</h2>{callbacks.length === 0 ? <p className="mt-3 text-sm text-gray-400">No callbacks.</p> : <div className="mt-3 space-y-3">{callbacks.map((callback) => <div className="rounded-lg border border-ink-700 p-3 text-sm" key={callback.id}><p className="text-gray-200">{label(callback.status)}</p><p className="mt-1 text-xs text-gray-500">Due {pacific(callback.dueAt)} · Completed {pacific(callback.completedAt)}</p></div>)}</div>}</article>
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Notes</h2>{notes.length === 0 ? <p className="mt-3 text-sm text-gray-400">No notes.</p> : <div className="mt-3 space-y-3">{notes.map((note) => <div className="rounded-lg border border-ink-700 p-3 text-sm text-gray-200" key={note.id}><p>{note.body}</p><p className="mt-1 text-xs text-gray-500">{pacific(note.createdAt)}</p></div>)}</div>}</article>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Claim history</h2>{claims.length === 0 ? <p className="mt-3 text-sm text-gray-400">No claim history.</p> : <div className="mt-3 space-y-3">{claims.map((claim) => <div className="rounded-lg border border-ink-700 p-3 text-sm" key={claim.id}><p className="text-gray-200">{label(claim.action)}</p><p className="mt-1 text-xs text-gray-500">{claim.reason || "No reason"} · {pacific(claim.createdAt)}</p></div>)}</div>}</article>
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Suppression history</h2>{suppressions.length === 0 ? <p className="mt-3 text-sm text-gray-400">No suppression history.</p> : <div className="mt-3 space-y-3">{suppressions.map((suppression) => <div className="rounded-lg border border-ink-700 p-3 text-sm" key={suppression.id}><p className="text-gray-200">{label(suppression.type)} · {suppression.active ? "Active" : "Lifted"}</p><p className="mt-1 text-xs text-gray-500">{suppression.reason || "No reason"} · {pacific(suppression.createdAt)}</p></div>)}</div>}</article>
      </section>
    </main>
  );
}
