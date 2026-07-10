import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceEvidenceMatrix } from "@/lib/lead-acceptance-matrix";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-gray-200";

export const dynamic = "force-dynamic";

function statusClass(status: string) {
  if (status === "PASS") return "border-emerald-800 bg-emerald-950/20 text-emerald-200";
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

export default async function LeadAcceptanceMatrixPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const matrix = await getLeadAcceptanceEvidenceMatrix();
  const nextStep = matrix.nextOpenStep;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-matrix="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance evidence matrix</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only matrix of every Lead production acceptance step with current outcome, record timestamp, runbook link, action surface, and acceptance-board record anchor.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Handoff packet</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gates">Closed gates</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Evidence gaps</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-matrix">JSON matrix</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-6">
        <Metric label="Total" value={matrix.counts.totalSteps} detail="Acceptance steps" tone="text-brand-200" />
        <Metric label="Passed" value={matrix.counts.passed} detail="Complete evidence" tone="text-emerald-200" />
        <Metric label="Open" value={matrix.counts.open} detail="Needs attention" tone={matrix.counts.open ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Failed" value={matrix.counts.failed} detail="Must be zero" tone={matrix.counts.failed ? "text-red-200" : "text-gray-200"} />
        <Metric label="Deferred" value={matrix.counts.deferred} detail="Needs resolution" tone={matrix.counts.deferred ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Missing" value={matrix.counts.missing} detail="Not recorded" tone={matrix.counts.missing ? "text-amber-200" : "text-gray-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Matrix recommendation</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {matrix.fullyPassed
                ? "All acceptance evidence is pass-recorded. Keep the closed operational gates closed unless Hamilton separately approves opening them."
                : matrix.readyForOwnerDecision
                  ? "All non-owner-decision evidence is pass-ready. Hamilton can record the owner production decision from the acceptance board."
                  : nextStep
                    ? `Next open matrix row: ${nextStep.title}`
                    : "No acceptance matrix rows are configured."}
            </p>
            <p className="mt-2 break-all text-xs text-gray-500">Latest production commit: {matrix.latestProductionCommit}</p>
            <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {matrix.statusBaselineCommit}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextStep?.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextStep.href}>{nextStep.action || "Open next step"}</Link>}
            {nextStep?.runbookHref && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextStep.runbookHref}>Runbook step</Link>}
            {nextStep?.recordHref && <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={nextStep.recordHref}>Record evidence</Link>}
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gates">View closed gates</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-5 py-4">
          <h2 className="font-semibold text-white">All acceptance evidence rows</h2>
          <p className="mt-1 text-sm text-gray-500">Rows are read-only and preserve Hamilton-only production acceptance.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-ink-700 text-sm">
            <thead className="bg-ink-950/70 text-left text-xs uppercase tracking-widest text-gray-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Evidence step</th>
                <th className="px-4 py-3">Recorded</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {matrix.rows.map((row) => (
                <tr className={row.isGap ? "bg-amber-950/10" : "bg-ink-900"} data-acceptance-matrix-row={row.id} key={row.id}>
                  <td className="px-4 py-4 text-gray-500">{row.rowNumber}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(row.status)}`}>{statusLabel(row.status)}</span></td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-white">{row.title}</p>
                    <p className="mt-1 text-xs text-gray-500">{row.id}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-300">{pacific(row.recordedAt)}</td>
                  <td className="max-w-md px-4 py-4 text-gray-300">{row.note || "No note recorded."}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {row.href && <Link className="rounded-lg border border-brand-500 px-2.5 py-1.5 text-xs text-brand-200" href={row.href}>{row.action || "Open"}</Link>}
                      <Link className="rounded-lg border border-brand-500 px-2.5 py-1.5 text-xs text-brand-200" href={row.runbookHref}>Runbook</Link>
                      <Link className="rounded-lg border border-ink-700 px-2.5 py-1.5 text-xs text-gray-200" href={row.recordHref}>Record</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Matrix session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Version: {matrix.version}. Phase: {matrix.phase}. {matrix.safetyBoundary}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
