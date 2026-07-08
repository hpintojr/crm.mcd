import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadActionPanel } from "@/components/lead-action-panel";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

function daysRemaining(value: Date | null) {
  if (!value) return "Not set";
  const diff = value.getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  if (!features.leads) notFound();
  const { leadId } = await searchParams;
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  const isAdmin = ADMIN_ROLES.includes(user.role);

  if (!leadId) {
    const [ownedLeads, dueCallbacks, recentActivity] = await Promise.all([
      agent
        ? db.lead.findMany({
          where: { ownerAgentId: agent.id, dnc: false, suppressed: false },
          orderBy: [{ nextActionAt: "asc" }, { lastActionAt: "desc" }],
          take: 25,
        })
        : Promise.resolve([]),
      agent
        ? db.leadCallback.findMany({
          where: { agentId: agent.id, status: "SCHEDULED" },
          orderBy: { dueAt: "asc" },
          take: 12,
        })
        : Promise.resolve([]),
      agent
        ? db.leadActivity.findMany({
          where: { agentId: agent.id },
          orderBy: { occurredAt: "desc" },
          take: 12,
        })
        : Promise.resolve([]),
    ]);

    const callbackLeadIds = Array.from(new Set(dueCallbacks.map((callback) => callback.leadId)));
    const callbackLeads = callbackLeadIds.length > 0
      ? await db.lead.findMany({ where: { id: { in: callbackLeadIds } }, select: { id: true, company: true, businessPhone: true } })
      : [];
    const callbackLeadMap = new Map(callbackLeads.map((lead) => [lead.id, lead]));

    return (
      <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">My Workspace</h1>
            <p className="mt-2 max-w-3xl text-gray-400">Your assigned records, callbacks, and claim-timer responsibilities. Cold Leads stay in the Lead workspace until a two-way contact unlocks claiming.</p>
          </div>
          <Link className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" href="/portal/leads">Work Cold Leads</Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Assigned records</p><p className="mt-2 text-3xl font-semibold text-white">{ownedLeads.length}</p></div>
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Scheduled callbacks</p><p className="mt-2 text-3xl font-semibold text-white">{dueCallbacks.length}</p></div>
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Claim access</p><p className={`mt-2 text-lg font-semibold ${agent?.canClaimLeads ? "text-emerald-300" : "text-amber-300"}`}>{agent?.canClaimLeads ? "Certified" : "Pending"}</p></div>
          <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">DNC rule</p><p className="mt-2 text-lg font-semibold text-red-200">Absolute blackout</p></div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
            <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">My active records</h2><p className="mt-1 text-sm text-gray-400">Claimed work only. Claim timers start after verified two-way contact.</p></div>
            {ownedLeads.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No assigned records yet. Work Cold Leads to create eligible claims.</p> : <div className="divide-y divide-ink-700">{ownedLeads.map((lead) => <Link className="block px-6 py-5 transition hover:bg-ink-800" href={`/portal/workspace?leadId=${lead.id}`} key={lead.id}><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><p className="font-medium text-white">{lead.company}</p><p className="mt-1 text-sm text-gray-400">{lead.businessPhone} · {label(lead.lifecycle)} · {label(lead.pool)}</p></div><div className="text-sm text-gray-400 md:text-right"><p>Next: {lead.nextActionAt ? pacific(lead.nextActionAt) : "Not scheduled"}</p><p className="mt-1 text-xs">Timer: {daysRemaining(lead.openPoolReleaseAt)}</p></div></div></Link>)}</div>}
          </section>

          <section className="space-y-6">
            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
              <h2 className="font-semibold text-white">Callback queue</h2>
              <div className="mt-4 space-y-3">{dueCallbacks.length === 0 ? <p className="text-sm text-gray-400">No callbacks scheduled.</p> : dueCallbacks.map((callback) => { const lead = callbackLeadMap.get(callback.leadId); return <Link className="block rounded-lg border border-ink-700 p-3 text-sm text-gray-300 transition hover:bg-ink-800" href={`/portal/workspace?leadId=${callback.leadId}`} key={callback.id}><span className="font-medium text-white">{lead?.company || "Lead"}</span><span className="block text-gray-400">Due {pacific(callback.dueAt)}</span><span className="block text-xs text-gray-500">{lead?.businessPhone || "Phone not loaded"}</span></Link>; })}</div>
            </div>

            <div className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
              <h2 className="font-semibold text-white">Recent activity</h2>
              <div className="mt-4 space-y-3">{recentActivity.length === 0 ? <p className="text-sm text-gray-400">No activity recorded yet.</p> : recentActivity.map((activity) => <p className="border-l border-ink-700 pl-3 text-sm text-gray-300" key={activity.id}>{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}<span className="block text-xs text-gray-500">{pacific(activity.occurredAt)}</span></p>)}</div>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) notFound();
  const [notes, activities, callbacks] = await Promise.all([
    db.leadNote.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.leadActivity.findMany({ where: { leadId: lead.id }, orderBy: { occurredAt: "desc" }, take: 25 }),
    db.leadCallback.findMany({ where: { leadId: lead.id }, orderBy: { dueAt: "asc" }, take: 12 }),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <a className="text-sm text-brand-400" href="/portal/workspace">← My Workspace</a>
      <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">{lead.company}</h1><p className="mt-2 text-gray-400">{lead.businessPhone} · {label(lead.lifecycle)} · {label(lead.pool)}</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-4 text-sm text-gray-300"><p className="text-gray-500">Claim timer</p><p className="mt-1 font-medium text-white">{daysRemaining(lead.openPoolReleaseAt)}</p><p className="mt-1 text-xs text-gray-500">Started only after two-way-contact claim.</p></div></div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1fr_0.9fr]">
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Business details</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-gray-500">Contact</dt><dd className="mt-1 text-gray-200">{[lead.contactFirstName, lead.contactLastName].filter(Boolean).join(" ") || "Not recorded"}</dd></div><div><dt className="text-gray-500">Industry</dt><dd className="mt-1 text-gray-200">{lead.industry || "Not recorded"}</dd></div><div><dt className="text-gray-500">Location</dt><dd className="mt-1 text-gray-200">{[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "Not recorded"}</dd></div><div><dt className="text-gray-500">Website</dt><dd className="mt-1 break-all text-gray-200">{lead.website || "Not recorded"}</dd></div><div><dt className="text-gray-500">Two-way contact</dt><dd className="mt-1 text-gray-200">{lead.twoWayContactAt ? pacific(lead.twoWayContactAt) : "Not recorded"}</dd></div></dl><p className="mt-6 text-xs text-amber-200">DNC requests block sales and marketing outreach immediately.</p></section>
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Activity</h2><div className="mt-5"><LeadActionPanel leadId={lead.id} phone={lead.businessPhone} /></div></section>
        <section className="space-y-6"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Callbacks</h2><div className="mt-4 space-y-2">{callbacks.length === 0 ? <p className="text-sm text-gray-400">No callbacks scheduled.</p> : callbacks.map((callback) => <p className="rounded-lg border border-ink-700 p-3 text-sm text-gray-300" key={callback.id}>{pacific(callback.dueAt)} · {label(callback.status)}</p>)}</div></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Timeline</h2><div className="mt-4 space-y-3">{activities.map((activity) => <p className="border-l border-ink-700 pl-3 text-sm text-gray-300" key={activity.id}>{label(activity.type)}{activity.disposition ? ` · ${label(activity.disposition)}` : ""}<span className="block text-xs text-gray-500">{pacific(activity.occurredAt)}</span></p>)}{notes.map((note) => <p className="border-l border-brand-800 pl-3 text-sm text-gray-300" key={note.id}>{note.body}<span className="block text-xs text-gray-500">{pacific(note.createdAt)}</span></p>)}</div></div></section>
      </div>
    </main>
  );
}
