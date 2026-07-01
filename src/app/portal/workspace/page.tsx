import { notFound } from "next/navigation";
import { LeadActionPanel } from "@/components/lead-action-panel";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  if (!features.leads) notFound();
  const { leadId } = await searchParams;
  if (!leadId) notFound();
  const user = await requireRole(["AGENT", ...ADMIN_ROLES]);
  const agent = await db.agent.findUnique({ where: { userId: user.id } });
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  const isAdmin = ADMIN_ROLES.includes(user.role);
  if (!lead || (!isAdmin && (!agent || lead.ownerAgentId !== agent.id))) notFound();
  const [notes, activities, callbacks] = await Promise.all([
    db.leadNote.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    db.leadActivity.findMany({ where: { leadId: lead.id }, orderBy: { occurredAt: "desc" }, take: 25 }),
    db.leadCallback.findMany({ where: { leadId: lead.id }, orderBy: { dueAt: "asc" }, take: 12 }),
  ]);
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <a className="text-sm text-brand-400" href="/portal/leads">← Lead workspace</a>
      <div className="mt-5"><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">{lead.company}</h1><p className="mt-2 text-gray-400">{lead.businessPhone} · {label(lead.lifecycle)} · {label(lead.pool)}</p></div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[0.85fr_1fr_0.9fr]">
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Business details</h2><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-gray-500">Contact</dt><dd className="mt-1 text-gray-200">{[lead.contactFirstName, lead.contactLastName].filter(Boolean).join(" ") || "Not recorded"}</dd></div><div><dt className="text-gray-500">Industry</dt><dd className="mt-1 text-gray-200">{lead.industry || "Not recorded"}</dd></div><div><dt className="text-gray-500">Location</dt><dd className="mt-1 text-gray-200">{[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "Not recorded"}</dd></div><div><dt className="text-gray-500">Website</dt><dd className="mt-1 break-all text-gray-200">{lead.website || "Not recorded"}</dd></div></dl><p className="mt-6 text-xs text-amber-200">DNC requests block sales and marketing outreach immediately.</p></section>
        <section className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Activity</h2><div className="mt-5"><LeadActionPanel leadId={lead.id} phone={lead.businessPhone} /></div></section>
        <section className="space-y-6"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Callbacks</h2><div className="mt-4 space-y-2">{callbacks.length === 0 ? <p className="text-sm text-gray-400">No callbacks scheduled.</p> : callbacks.map((callback) => <p className="rounded-lg border border-ink-700 p-3 text-sm text-gray-300" key={callback.id}>{callback.dueAt.toLocaleString()} · {label(callback.status)}</p>)}</div></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-6"><h2 className="font-semibold text-white">Timeline</h2><div className="mt-4 space-y-3">{activities.map((activity) => <p className="border-l border-ink-700 pl-3 text-sm text-gray-300" key={activity.id}>{label(activity.type)}<span className="block text-xs text-gray-500">{activity.occurredAt.toLocaleString()}</span></p>)}{notes.map((note) => <p className="border-l border-brand-800 pl-3 text-sm text-gray-300" key={note.id}>{note.body}<span className="block text-xs text-gray-500">{note.createdAt.toLocaleString()}</span></p>)}</div></div></section>
      </div>
    </main>
  );
}
