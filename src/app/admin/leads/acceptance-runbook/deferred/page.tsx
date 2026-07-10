import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceDeferredRunbook } from "@/lib/lead-acceptance-deferred";

export const dynamic = "force-dynamic";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-gray-200" | "text-white";

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

function pacific(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })
    : "Not recorded";
}

export default async function LeadAcceptanceDeferredRunbookPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const deferred = await getLeadAcceptanceDeferredRunbook();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-deferred-runbook="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Deferred acceptance runbook</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only view of the five deferred production-acceptance steps: Vercel runtime logs, Cold Lead second call attempt, Warm Reply Triage timer, controlled GHL appointment, and controlled GHL opportunity. This page only links to evidence surfaces; it does not record outcomes or mutate Leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Acceptance overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Full runbook</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Evidence gaps</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-matrix">Evidence matrix</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Configured deferred" value={deferred.counts.configured} detail="Fixed step list" tone="text-brand-200" />
        <Metric label="Still deferred" value={deferred.counts.currentDeferred} detail="Latest evidence" tone={deferred.counts.currentDeferred ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Passed" value={deferred.counts.passed} detail="Resolved" tone="text-emerald-200" />
        <Metric label="Missing" value={deferred.counts.missing} detail="Needs evidence" tone={deferred.counts.missing ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Failed" value={deferred.counts.failed} detail="Must be zero" tone={deferred.counts.failed ? "text-red-200" : "text-gray-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Deferred-step boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          These steps remain follow-up evidence only. Runtime-log review stays read-only, Cold Lead second-call verification stays controlled-test only, Warm Reply Triage is verified only when an eligible controlled warm reply exists, and GHL appointment/opportunity checks must use the controlled harness only. Live GHL workflows, live imports/exports, feature flags, and real Lead business rules remain closed.
        </p>
      </section>

      <section className="mt-8 space-y-4">
        {deferred.steps.map((step) => (
          <article className="scroll-mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-5" data-deferred-acceptance-step={step.id} id={step.id} key={step.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs font-medium text-gray-400">Deferred {step.deferredIndex}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(step.status)}`}>{statusLabel(step.status)}</span>
                  <h2 className="font-semibold text-white">{step.title}</h2>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-300">{step.note || "No operator note has been recorded for this deferred step yet."}</p>
                <p className="mt-2 text-xs text-gray-500">Recorded: {pacific(step.recordedAt)}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">Where to record: {step.whereToRecord} at <code className="rounded bg-ink-950 px-1.5 py-0.5 text-brand-200">/admin/leads/testing#{step.id}</code></p>
              </div>
              <div className="flex flex-wrap gap-2">
                {step.href && <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open step"}</Link>}
                <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.runbookHref}>Runbook section</Link>
                <Link className="h-fit rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={step.recordHref}>Record evidence</Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Deferred runbook session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Version: {deferred.version}. Phase: {deferred.phase}. {deferred.safetyBoundary}</p>
        <p className="mt-2 break-all text-xs text-gray-500">Latest production commit: {deferred.latestProductionCommit}</p>
        <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {deferred.statusBaselineCommit}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
