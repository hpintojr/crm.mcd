import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceDeferredRunbook } from "@/lib/lead-acceptance-deferred";
import { getLeadAcceptanceOverview, type LeadAcceptanceOverviewEntry } from "@/lib/lead-acceptance-overview";

export const dynamic = "force-dynamic";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-gray-200" | "text-white";

function priorityClass(priority: LeadAcceptanceOverviewEntry["priority"]) {
  if (priority === "START") return "border-brand-700 bg-brand-950/20 text-brand-200";
  if (priority === "REVIEW") return "border-amber-700 bg-amber-950/20 text-amber-200";
  if (priority === "AUDIT") return "border-emerald-800 bg-emerald-950/20 text-emerald-200";
  return "border-ink-700 bg-ink-950 text-gray-300";
}

function statusClass(status: string) {
  if (status === "PASS") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (status === "FAIL") return "border-red-700 bg-red-950/20 text-red-200";
  if (status === "DEFERRED") return "border-amber-700 bg-amber-950/20 text-amber-200";
  return "border-ink-700 bg-ink-950 text-gray-300";
}

function statusLabel(status: string) {
  if (status === "MISSING") return "Missing";
  return status[0] + status.slice(1).toLowerCase();
}

export default async function LeadAcceptanceOverviewPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const [overview, deferred] = await Promise.all([
    getLeadAcceptanceOverview(),
    getLeadAcceptanceDeferredRunbook(),
  ]);
  const startEntries = overview.entrypoints.filter((entry) => entry.priority === "START");
  const reviewEntries = overview.entrypoints.filter((entry) => entry.priority === "REVIEW");
  const auditEntries = overview.entrypoints.filter((entry) => entry.priority === "AUDIT" || entry.priority === "REFERENCE");

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-overview="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance overview</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only landing page for Lead production acceptance. Start here to open owner decision prep, the handoff packet, evidence matrix, diff, gaps, closed gates, history, findings, report, runbook, and Hamilton-only acceptance board.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/owner-decision-prep">Owner decision prep</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Handoff packet</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-matrix">Evidence matrix</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-diff">Acceptance diff</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gates">Closed gates</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/deployment-verification">Deployment verification</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-overview">JSON overview</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/acceptance-summary.csv">CSV summary</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-6">
        <Metric label="Total steps" value={overview.evidence.totalSteps} detail="Acceptance rows" tone="text-brand-200" />
        <Metric label="Passed" value={overview.evidence.passed} detail="Complete evidence" tone="text-emerald-200" />
        <Metric label="Open evidence" value={overview.evidence.open} detail="Missing/failed/deferred" tone={overview.evidence.open ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Failed" value={overview.evidence.failed} detail="Must be zero" tone={overview.evidence.failed ? "text-red-200" : "text-gray-200"} />
        <Metric label="Closed gates" value={overview.gates.closed} detail={`${overview.gates.total} total`} tone="text-amber-200" />
        <Metric label="Open gates" value={overview.gates.open} detail="Must stay zero" tone={overview.gates.open ? "text-red-200" : "text-emerald-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Overview recommendation</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">{overview.recommendation}</p>
            <p className="mt-2 break-all text-xs text-gray-500">Latest production commit: {overview.latestProductionCommit}</p>
            <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {overview.statusBaselineCommit}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {overview.evidence.nextStep?.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={overview.evidence.nextStep.href}>{overview.evidence.nextStep.action || "Open next step"}</Link>}
            {overview.evidence.nextStep?.runbookHref && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={overview.evidence.nextStep.runbookHref}>Runbook step</Link>}
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/owner-decision-prep">Open owner prep</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-diff">Open acceptance diff</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/deployment-verification">Open deployment verification</Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/acceptance-summary.csv">Download CSV summary</Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Record evidence</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6" data-acceptance-overview-deferred="lead-flow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-amber-100">Deferred blockers</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-100/80">
              Read-only summary of the five deferred production-acceptance steps. Each row links to the runbook section and to the exact anchor on the acceptance board where Hamilton records the evidence. This section does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-amber-700 px-3 py-2 text-sm text-amber-100" href="/admin/leads/acceptance-runbook/deferred">Full deferred runbook</Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          <Metric label="Configured" value={deferred.counts.configured} detail="Fixed step list" tone="text-brand-200" />
          <Metric label="Still deferred" value={deferred.counts.currentDeferred} detail="Latest evidence" tone={deferred.counts.currentDeferred ? "text-amber-200" : "text-gray-200"} />
          <Metric label="Passed" value={deferred.counts.passed} detail="Resolved" tone="text-emerald-200" />
          <Metric label="Missing" value={deferred.counts.missing} detail="Needs evidence" tone={deferred.counts.missing ? "text-amber-200" : "text-gray-200"} />
          <Metric label="Failed" value={deferred.counts.failed} detail="Must be zero" tone={deferred.counts.failed ? "text-red-200" : "text-gray-200"} />
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-amber-800">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-amber-950/40 text-xs uppercase tracking-widest text-amber-200/80">
              <tr>
                <th className="border-b border-amber-800 px-4 py-3 font-medium">Step</th>
                <th className="border-b border-amber-800 px-4 py-3 font-medium">Status</th>
                <th className="border-b border-amber-800 px-4 py-3 font-medium">Evidence source</th>
                <th className="border-b border-amber-800 px-4 py-3 font-medium">Record on</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-900 text-amber-50">
              {deferred.steps.map((step) => (
                <tr className="align-top" data-acceptance-overview-deferred-row={step.id} key={step.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{step.title}</p>
                    <p className="mt-1 text-xs text-amber-200/80">Deferred {step.deferredIndex}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(step.status)}`}>{statusLabel(step.status)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link className="rounded-lg border border-amber-700 px-2.5 py-1 text-xs text-amber-100" href={step.runbookHref}>Runbook section</Link>
                      {step.href && <Link className="rounded-lg border border-amber-700 px-2.5 py-1 text-xs text-amber-100" href={step.href}>{step.action || "Open step"}</Link>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-amber-100/80">{step.whereToRecord}</p>
                    <Link className="mt-1 inline-block text-xs text-brand-200 underline decoration-amber-700 underline-offset-4" href={step.recordHref}>{step.recordHref}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <EntryGroup title="Start here" description="Primary places to begin or record acceptance work." entries={startEntries} />
        <EntryGroup title="Review status" description="Evidence and gate surfaces for current readiness." entries={reviewEntries} />
        <EntryGroup title="Audit and reference" description="History, findings, reports, and runbook reference surfaces." entries={auditEntries} />
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Overview session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Version: {overview.version}. Phase: {overview.phase}. {overview.safetyBoundary}</p>
      </section>
    </main>
  );
}

function EntryGroup({ title, description, entries }: { title: string; description: string; entries: LeadAcceptanceOverviewEntry[] }) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
      <h2 className="font-semibold text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
      <div className="mt-5 grid gap-3">
        {entries.map((entry) => (
          <Link className="rounded-xl border border-ink-700 bg-ink-950 p-4 transition hover:border-brand-600" data-acceptance-overview-entry={entry.id} href={entry.href} key={entry.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityClass(entry.priority)}`}>{entry.priority}</span>
              <h3 className="font-medium text-white">{entry.title}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-400">{entry.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
