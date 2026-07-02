import Link from "next/link";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { ViewerTime } from "@/components/viewer-time";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { getPortalContext } from "@/lib/portal-context";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { agent } = await getPortalContext();

  if (!agent) {
    return <PortalFeaturePage eyebrow="Daily work" title="Tasks" description="Your callbacks, follow-ups, and booking actions will be organized here."><section className="portal-card max-w-3xl"><h2 className="portal-heading text-lg font-semibold">No personal task list</h2><p className="portal-copy mt-3 text-sm">This account is not linked to an agent profile.</p></section></PortalFeaturePage>;
  }

  if (!features.leads) {
    return (
      <PortalFeaturePage eyebrow="Daily work" title="Tasks" description="Your callbacks, follow-ups, and booking actions will be organized here.">
        <section className="portal-card max-w-3xl">
          <h2 className="portal-heading text-lg font-semibold">Task workspace is staged</h2>
          <p className="portal-copy mt-3 text-sm">The callback queue will activate only after Lead Management, source controls, suppression safeguards, and controlled production testing are complete.</p>
          <div className="portal-callout mt-5 text-sm"><span className="font-medium portal-heading">Current access:</span><span className="portal-muted"> Lead workflows are not live yet.</span></div>
        </section>
      </PortalFeaturePage>
    );
  }

  const callbacks = await db.leadCallback.findMany({
    where: { agentId: agent.id, status: "SCHEDULED" },
    orderBy: { dueAt: "asc" },
    take: 100,
  });
  const leadIds = [...new Set(callbacks.map((callback) => callback.leadId))];
  const leads = leadIds.length ? await db.lead.findMany({ where: { id: { in: leadIds }, ownerAgentId: agent.id }, select: { id: true, company: true, businessPhone: true, lifecycle: true } }) : [];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const now = new Date();
  const overdue = callbacks.filter((callback) => callback.dueAt < now);
  const upcoming = callbacks.filter((callback) => callback.dueAt >= now);

  function CallbackList({ items, empty }: { items: typeof callbacks; empty: string }) {
    if (!items.length) return <p className="portal-copy px-6 py-8 text-sm">{empty}</p>;
    return <div>{items.map((callback) => {
      const lead = leadById.get(callback.leadId);
      if (!lead) return null;
      return <article className="flex flex-col gap-3 border-b px-6 py-5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between portal-border" key={callback.id}><div><p className="portal-heading font-medium">{lead.company}</p><p className="portal-copy mt-1 text-sm">{lead.businessPhone} · {lead.lifecycle.replaceAll("_", " ").toLowerCase()}</p><ViewerTime startAt={callback.dueAt.toISOString()} /></div><Link className="portal-action-link" href={`/portal/leads?selected=${lead.id}`}>Open lead</Link></article>;
    })}</div>;
  }

  return (
    <PortalFeaturePage eyebrow="Daily work" title="Tasks" description="Your callbacks and follow-ups are ordered by their due time. Record the result and set the next step from the lead workspace.">
      <section className="grid max-w-5xl gap-6 xl:grid-cols-2">
        <section className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">Overdue follow-ups</h2><p className="portal-copy mt-1 text-sm">Complete these first or schedule the next action.</p></div><CallbackList items={overdue} empty="No overdue follow-ups." /></section>
        <section className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">Upcoming follow-ups</h2><p className="portal-copy mt-1 text-sm">Your assigned callback queue.</p></div><CallbackList items={upcoming} empty="No scheduled follow-ups." /></section>
      </section>
    </PortalFeaturePage>
  );
}
