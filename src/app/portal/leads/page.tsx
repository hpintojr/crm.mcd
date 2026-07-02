import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { claimAvailableLead } from "@/lib/claims";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { PortalFeaturePage } from "@/components/portal-feature-page";
import { getPortalContext } from "@/lib/portal-context";

export const dynamic = "force-dynamic";

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

export default async function LeadsPage() {
  const { agent } = await getPortalContext();

  if (!features.leads) {
    return (
      <PortalFeaturePage eyebrow="Pipeline" title="Leads" description="Assigned leads and future open-pool opportunities will be managed here.">
        <section className="portal-card max-w-3xl">
          <h2 className="portal-heading text-lg font-semibold">Lead workspace is staged</h2>
          <p className="portal-copy mt-3 text-sm">The lead module is intentionally held until assignment rules, controlled migrations, and operational testing are complete.</p>
          <div className="portal-callout mt-5 text-sm"><span className={`font-medium ${agent?.canClaimLeads ? "portal-status-good" : "portal-status-pending"}`}>{agent?.canClaimLeads ? "Certification recorded" : "Certification required"}</span><span className="portal-muted"> · Lead records will appear here when the rollout is enabled.</span></div>
        </section>
      </PortalFeaturePage>
    );
  }

  const [available, mine] = await Promise.all([
    db.lead.findMany({ where: { ownerAgentId: null, lifecycle: "AVAILABLE", dnc: false, suppressed: false }, orderBy: [{ pool: "asc" }, { score: "desc" }, { createdAt: "asc" }], take: 100 }),
    agent ? db.lead.findMany({ where: { ownerAgentId: agent.id, dnc: false, suppressed: false }, orderBy: [{ nextActionAt: "asc" }, { lastActionAt: "desc" }], take: 100 }) : Promise.resolve([]),
  ]);

  async function claim(formData: FormData) {
    "use server";
    const actor = await requireRole(["AGENT", ...ADMIN_ROLES]);
    const leadId = String(formData.get("leadId") ?? "");
    if (!leadId) throw new Error("Lead is required.");
    await claimAvailableLead({ userId: actor.id, role: actor.role }, leadId);
    revalidatePath("/portal/leads");
  }

  return (
    <PortalFeaturePage eyebrow="Pipeline" title="Leads" description="Only work company-owned records. Log each meaningful interaction, next step, and opt-out immediately.">
      <section className="grid gap-6 xl:grid-cols-2">
        <div className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">Available pool</h2><p className="portal-copy mt-1 text-sm">Claiming is atomic. Cold-lead protection begins only after documented two-way contact.</p></div>{available.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No available records.</p> : <div>{available.map((lead) => <article className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 portal-border" key={lead.id}><div><p className="portal-heading font-medium">{lead.company}</p><p className="portal-copy mt-1 text-sm">{lead.industry || "Industry pending"} · {lead.city || "Location pending"}</p><p className="portal-copy mt-1 text-xs">{label(lead.pool)} · Score {lead.score}</p></div>{agent?.canClaimLeads && <form action={claim}><input name="leadId" type="hidden" value={lead.id} /><button className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950 hover:bg-brand-400" type="submit">Claim</button></form>}</article>)}</div>}</div>
        <div className="portal-card p-0"><div className="border-b px-6 py-4 portal-border"><h2 className="portal-heading font-semibold">My active records</h2><p className="portal-copy mt-1 text-sm">Callbacks and next actions are shown first.</p></div>{mine.length === 0 ? <p className="portal-copy px-6 py-10 text-sm">No records are assigned to you.</p> : <div>{mine.map((lead) => <a className="block border-b px-6 py-5 transition hover:bg-black/5 portal-border" href={`/portal/leads?selected=${lead.id}`} key={lead.id}><p className="portal-heading font-medium">{lead.company}</p><p className="portal-copy mt-1 text-sm">{lead.businessPhone} · {label(lead.lifecycle)}</p><p className="portal-copy mt-1 text-xs">Next action: {lead.nextActionAt ? lead.nextActionAt.toLocaleString() : "Not scheduled"}</p></a>)}</div>}</div>
      </section>
    </PortalFeaturePage>
  );
}
