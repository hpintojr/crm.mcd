import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { controlledTestLeadWhere } from "@/lib/controlled-test-leads";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Tone = "text-emerald-200" | "text-amber-200" | "text-gray-200" | "text-brand-200";

function label(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase()) : "—";
}

function pacific(value: Date | null | undefined) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function scenarioFromSourceDetail(value: string | null | undefined) {
  if (!value) return "No scenario note recorded.";
  const marker = "Scenario:";
  const markerIndex = value.indexOf(marker);
  if (markerIndex === -1) return value.replace("Controlled test Lead; GHL export blocked by default until a controlled harness explicitly allows it.", "").trim() || "No scenario note recorded.";
  return value.slice(markerIndex + marker.length).trim() || "No scenario note recorded.";
}

export default async function ControlledTestDataHistoryPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);

  const leads = await db.lead.findMany({
    where: controlledTestLeadWhere,
    orderBy: { createdAt: "desc" },
    take: 250,
    select: {
      id: true,
      company: true,
      sourceReference: true,
      sourceDetail: true,
      campaignExternalId: true,
      pool: true,
      lifecycle: true,
      suppressed: true,
      dnc: true,
      ownerAgentId: true,
      claimedAt: true,
      openPoolReleaseAt: true,
      lastActionAt: true,
      createdAt: true,
    },
  });

  const leadIds = leads.map((lead) => lead.id);
  const auditRows = leadIds.length
    ? await db.auditLog.findMany({
        where: { entityType: "Lead", entityId: { in: leadIds } },
        orderBy: { createdAt: "desc" },
        take: 2_000,
        select: { entityId: true, actionType: true, createdAt: true },
      })
    : [];

  const auditByLead = new Map<string, { count: number; latestAction: string | null; latestAt: Date | null }>();
  for (const row of auditRows) {
    if (!row.entityId) continue;
    const existing = auditByLead.get(row.entityId) ?? { count: 0, latestAction: null, latestAt: null };
    auditByLead.set(row.entityId, {
      count: existing.count + 1,
      latestAction: existing.latestAction ?? row.actionType,
      latestAt: existing.latestAt ?? row.createdAt,
    });
  }

  const archivedCount = leads.filter((lead) => lead.suppressed).length;
  const activeCount = leads.length - archivedCount;
  const claimedCount = leads.filter((lead) => lead.ownerAgentId || lead.claimedAt).length;
  const dncCount = leads.filter((lead) => lead.dnc).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-controlled-test-data-history="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Controlled test data history</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only history of controlled test Leads, lifecycle end state, scenario notes, and audit event counts. This page does not create, archive, claim, suppress, export, or mutate Leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/controlled-test-data">Controlled test data</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Acceptance overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook/deferred">Deferred steps</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Controlled Leads" value={leads.length} detail="Latest 250 max" tone="text-brand-200" />
        <Metric label="Active" value={activeCount} detail="Not suppressed" tone={activeCount ? "text-emerald-200" : "text-gray-200"} />
        <Metric label="Archived" value={archivedCount} detail="Suppressed test records" tone={archivedCount ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Claimed/DNC" value={claimedCount + dncCount} detail={`${claimedCount} claimed · ${dncCount} DNC`} tone={claimedCount + dncCount ? "text-amber-200" : "text-gray-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-5">
        <h2 className="font-semibold text-amber-100">Read-only safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          This history page reads only controlled test Lead records and their Lead audit rows. It does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.
        </p>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Lifecycle history</h2>
          <p className="mt-1 text-sm text-gray-400">Scenario, current lifecycle state, and audit count for each controlled test Lead.</p>
        </div>
        {leads.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No controlled test Leads have been created yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
                <tr>
                  <th className="border-b border-ink-700 px-4 py-3 font-medium">Lead</th>
                  <th className="border-b border-ink-700 px-4 py-3 font-medium">Scenario</th>
                  <th className="border-b border-ink-700 px-4 py-3 font-medium">End state</th>
                  <th className="border-b border-ink-700 px-4 py-3 font-medium">Dates</th>
                  <th className="border-b border-ink-700 px-4 py-3 font-medium">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700 text-gray-200">
                {leads.map((lead) => {
                  const audit = auditByLead.get(lead.id) ?? { count: 0, latestAction: null, latestAt: null };
                  return (
                    <tr className="align-top" data-controlled-test-history-lead={lead.id} key={lead.id}>
                      <td className="px-4 py-4">
                        <Link className="font-medium text-white hover:text-brand-200" href={`/admin/leads/${lead.id}`}>{lead.company}</Link>
                        <p className="mt-1 break-all text-xs text-gray-500">{lead.sourceReference}</p>
                        <p className="mt-1 text-xs text-amber-200">GHL export blocked · {lead.campaignExternalId}</p>
                      </td>
                      <td className="max-w-sm px-4 py-4 text-gray-300">{scenarioFromSourceDetail(lead.sourceDetail)}</td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-white">{label(lead.pool)} / {label(lead.lifecycle)}</p>
                        <p className={lead.suppressed ? "mt-1 text-xs text-amber-200" : "mt-1 text-xs text-emerald-200"}>{lead.suppressed ? "Archived / suppressed" : "Active controlled record"}</p>
                        {lead.dnc && <p className="mt-1 text-xs text-amber-200">DNC flagged</p>}
                      </td>
                      <td className="px-4 py-4 text-xs leading-5 text-gray-400">
                        <p>Created: {pacific(lead.createdAt)}</p>
                        <p>Last action: {pacific(lead.lastActionAt)}</p>
                        <p>Claimed: {pacific(lead.claimedAt)}</p>
                        <p>Release: {pacific(lead.openPoolReleaseAt)}</p>
                      </td>
                      <td className="px-4 py-4 text-xs leading-5 text-gray-400">
                        <p className="text-sm font-semibold text-white">{audit.count} event{audit.count === 1 ? "" : "s"}</p>
                        <p>Latest: {audit.latestAction ?? "—"}</p>
                        <p>{pacific(audit.latestAt)}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">History session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Controlled test data history is read-only and limited to controlled Lead records.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: Tone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
