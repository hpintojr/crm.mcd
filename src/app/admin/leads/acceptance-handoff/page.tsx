import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-white" | "text-gray-200";

export const dynamic = "force-dynamic";

function pacific(value: string | null) {
  return value
    ? new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })
    : "—";
}

export default async function LeadAcceptanceHandoffPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const packet = await getLeadAcceptanceHandoffPacket();
  const nextStep = packet.evidence.nextStep;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-handoff="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance handoff packet</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only operator packet combining current acceptance evidence, latest recorded activity, cataloged findings, and gates that remain closed. Use this as the starting point for Hamilton or Claude before any next acceptance pass.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Evidence gaps</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-history">Acceptance history</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-findings">Findings catalog</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-handoff">JSON packet</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Passed" value={packet.evidence.passed} detail={`${packet.evidence.totalSteps} total`} tone="text-emerald-200" />
        <Metric label="Failed" value={packet.evidence.failed} detail="Must be zero" tone={packet.evidence.failed ? "text-red-200" : "text-gray-200"} />
        <Metric label="Deferred" value={packet.evidence.deferred} detail="Needs resolution" tone={packet.evidence.deferred ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Missing" value={packet.evidence.missing} detail="Unrecorded evidence" tone={packet.evidence.missing ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Open gates" value={packet.findings.counts.openGates} detail="Still outside scope" tone="text-amber-200" />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Handoff recommendation</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {packet.evidence.fullyPassed
                ? "All acceptance evidence is pass-recorded. Keep the closed operational gates closed unless Hamilton separately approves opening them."
                : packet.evidence.readyForOwnerDecision
                  ? "All non-owner-decision evidence is pass-ready. Hamilton can record the owner production decision from the acceptance board."
                  : nextStep
                    ? `Continue with: ${nextStep.title}`
                    : "No acceptance steps are configured."}
            </p>
            <p className="mt-2 break-all text-xs text-gray-500">Latest production commit: {packet.latestProductionCommit}</p>
            <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {packet.statusBaselineCommit}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextStep?.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextStep.href}>{nextStep.action || "Open next step"}</Link>}
            {nextStep?.runbookHref && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextStep.runbookHref}>Runbook step</Link>}
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">View evidence gaps</Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Record evidence</Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Latest acceptance records</h2>
          {packet.latestRecords.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-800 bg-ink-950 p-4 text-sm text-amber-200">No production acceptance evidence has been recorded yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-950">
              {packet.latestRecords.map((record) => (
                <div className="grid gap-3 px-4 py-3 md:grid-cols-[9rem_1fr_auto]" key={record.id}>
                  <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500">{pacific(record.recordedAt)}</p>
                    <p className="mt-2 text-sm font-medium text-brand-200">{record.outcome}</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">{record.stepTitle}</h3>
                    <p className="mt-1 text-xs text-gray-500">Reviewer: {record.reviewer}</p>
                    <p className="mt-2 text-sm leading-6 text-gray-300">{record.note}</p>
                  </div>
                  <Link className="h-fit rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={record.runbookHref}>Runbook</Link>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
          <h2 className="font-semibold text-amber-100">Closed gates</h2>
          <div className="mt-4 grid gap-3 text-sm text-amber-100/80">
            {packet.remainingClosedGates.map((gate) => <Gate label={gate} key={gate} />)}
          </div>
          <p className="mt-5 text-xs leading-5 text-amber-100/70">These remain outside the acceptance-handoff scope. This page is summary-only and does not perform activation.</p>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Packet session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Packet version: {packet.packetVersion}. Phase: {packet.phase}. {packet.safetyBoundary}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}

function Gate({ label }: { label: string }) {
  return <div className="rounded-xl border border-amber-900/70 bg-ink-950/60 px-3 py-2">{label}</div>;
}
