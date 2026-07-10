import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceEvidenceGaps } from "@/lib/lead-acceptance-gaps";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-white" | "text-gray-200";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "FAIL") return "border-red-700 bg-red-950/20 text-red-200";
  if (status === "DEFERRED") return "border-amber-700 bg-amber-950/20 text-amber-200";
  if (status === "MISSING") return "border-ink-700 bg-ink-950 text-gray-300";
  return "border-brand-700 bg-brand-950/20 text-brand-200";
}

function statusLabel(status: string) {
  if (status === "MISSING") return "Missing";
  return status[0] + status.slice(1).toLowerCase();
}

function pacific(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })
    : "Not recorded";
}

export default async function LeadAcceptanceGapsPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const gaps = await getLeadAcceptanceEvidenceGaps();
  const nextGap = gaps.nextGap;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-gaps="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance evidence gaps</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only view of incomplete, failed, or deferred Lead acceptance evidence. This filters the handoff packet down to only the steps that still need attention.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Handoff packet</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-matrix">Evidence matrix</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gates">Closed gates</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-gaps">JSON gaps</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Open gaps" value={gaps.counts.open} detail={`${gaps.counts.totalSteps} total steps`} tone={gaps.counts.open ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Missing" value={gaps.counts.missing} detail="Not recorded" tone={gaps.counts.missing ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Failed" value={gaps.counts.failed} detail="Must be zero" tone={gaps.counts.failed ? "text-red-200" : "text-gray-200"} />
        <Metric label="Deferred" value={gaps.counts.deferred} detail="Needs resolution" tone={gaps.counts.deferred ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Passed" value={gaps.counts.passed} detail="Already complete" tone="text-emerald-200" />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Next evidence gap</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {gaps.allClear
                ? "No evidence gaps remain. Keep the closed operational gates closed unless Hamilton separately approves opening them."
                : nextGap
                  ? `Work next on: ${nextGap.title}`
                  : "No acceptance gaps are configured."}
            </p>
            <p className="mt-2 break-all text-xs text-gray-500">Latest production commit: {gaps.latestProductionCommit}</p>
            <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {gaps.statusBaselineCommit}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextGap?.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextGap.href}>{nextGap.action || "Open next step"}</Link>}
            {nextGap?.runbookHref && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextGap.runbookHref}>Runbook step</Link>}
            {nextGap?.recordHref && <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={nextGap.recordHref}>Record evidence</Link>}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {gaps.allClear ? (
          <article className="rounded-2xl border border-emerald-800 bg-emerald-950/20 p-6">
            <h2 className="font-semibold text-emerald-100">All acceptance evidence is pass-recorded</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-100/80">Use the handoff packet, evidence matrix, closed-gates view, and command center for final review. This gaps page remains read-only.</p>
          </article>
        ) : (
          gaps.gaps.map((gap) => (
            <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" data-acceptance-gap={gap.id} key={gap.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-4xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs font-medium text-gray-400">Priority {gap.priority}</span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(gap.status)}`}>{statusLabel(gap.status)}</span>
                    <h2 className="font-semibold text-white">{gap.title}</h2>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Recorded: {pacific(gap.recordedAt)}</p>
                  {gap.note && <p className="mt-2 text-sm leading-6 text-gray-300">{gap.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {gap.href && <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={gap.href}>{gap.action || "Open step"}</Link>}
                  <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={gap.runbookHref}>Runbook</Link>
                  <Link className="h-fit rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={gap.recordHref}>Record</Link>
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Gaps session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Version: {gaps.version}. Phase: {gaps.phase}. {gaps.safetyBoundary}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
