import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceClosedGates } from "@/lib/lead-acceptance-gates";

declare type MetricTone = "text-emerald-200" | "text-red-200" | "text-amber-200" | "text-brand-200" | "text-gray-200";

export const dynamic = "force-dynamic";

export default async function LeadAcceptanceGatesPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const gates = await getLeadAcceptanceClosedGates();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-gates="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance closed gates</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only control surface for operational gates that remain closed during Lead production acceptance. This page does not activate GHL, imports, exports, commissions, payouts, finance, or onboarding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Handoff packet</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-matrix">Evidence matrix</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Evidence gaps</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-gates">JSON gates</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Closed gates" value={gates.counts.closed} detail={`${gates.counts.total} total gates`} tone="text-amber-200" />
        <Metric label="Open gates" value={gates.counts.open} detail="Must stay zero" tone={gates.counts.open ? "text-red-200" : "text-emerald-200"} />
        <Metric label="Evidence passed" value={gates.evidence.passed} detail={`${gates.evidence.totalSteps} total steps`} tone="text-emerald-200" />
        <Metric label="Evidence open" value={gates.evidence.open} detail="Missing/failed/deferred" tone={gates.evidence.open ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Activation actions" value={0} detail="Performed here" tone="text-emerald-200" />
      </section>

      <section className="mt-6 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Closed-gates recommendation</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          Keep every listed gate closed unless Hamilton separately approves opening it outside this read-only acceptance tooling lane. Use the evidence matrix and handoff packet for review; do not treat this page as authorization to activate anything.
        </p>
        <p className="mt-3 break-all text-xs text-amber-100/70">Latest production commit: {gates.latestProductionCommit}</p>
        <p className="mt-1 break-all text-xs text-amber-100/70">Status baseline commit: {gates.statusBaselineCommit}</p>
      </section>

      <section className="mt-8 grid gap-4">
        {gates.gates.map((gate) => (
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" data-acceptance-gate={gate.id} key={gate.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs font-medium text-gray-400">Gate {gate.sequence}</span>
                  <span className="rounded-full border border-amber-700 bg-amber-950/20 px-2.5 py-1 text-xs font-medium text-amber-200">{gate.status}</span>
                  <h2 className="font-semibold text-white">{gate.label}</h2>
                </div>
                <p className="mt-3 text-sm leading-6 text-gray-300">{gate.reason}</p>
                <p className="mt-2 text-xs text-gray-500">Authorization required: {gate.authorizationRequired}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={gate.handoffHref}>Handoff</Link>
                <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={gate.evidenceMatrixHref}>Matrix</Link>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Gates session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Version: {gates.version}. Phase: {gates.phase}. {gates.safetyBoundary}</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: MetricTone }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
