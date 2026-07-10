import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import {
  LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION,
  LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT,
  leadAcceptanceFindingCounts,
  leadAcceptanceFindings,
  type LeadAcceptanceFindingStatus,
} from "@/lib/lead-acceptance-findings";

export const dynamic = "force-dynamic";

function statusClass(status: LeadAcceptanceFindingStatus) {
  if (status === "GUARDED") return "border-emerald-700 text-emerald-200";
  if (status === "OPEN_GATE") return "border-amber-700 text-amber-200";
  return "border-brand-700 text-brand-200";
}

function statusLabel(status: LeadAcceptanceFindingStatus) {
  if (status === "OPEN_GATE") return "Open gate";
  return status[0] + status.slice(1).toLowerCase();
}

export default async function LeadAcceptanceFindingsPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const counts = leadAcceptanceFindingCounts();

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12" data-acceptance-findings="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance findings catalog</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only catalog of known Lead acceptance findings, guarded contracts, and gates that remain outside the current production-acceptance tooling scope.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Command center</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Handoff packet</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-history">Acceptance history</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-findings">JSON findings</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Cataloged" value={counts.cataloged} detail="Known observations" tone="text-brand-200" />
        <Metric label="Guarded" value={counts.guarded} detail="Protected by alignment checks" tone="text-emerald-200" />
        <Metric label="Open gates" value={counts.openGates} detail="Still require Hamilton/action" tone="text-amber-200" />
        <Metric label="Total findings" value={counts.total} detail="Visible in this catalog" tone="text-white" />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Catalog baseline</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Version {LEAD_ACCEPTANCE_FINDINGS_CATALOG_VERSION}. Latest production commit observed by this catalog: <span className="break-all text-gray-500">{LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT}</span>.
            </p>
            <p className="mt-2 text-xs leading-5 text-gray-500">
              This page is static/read-only application content plus the current admin session. It does not read Leads, mutate audit records, change feature flags, call GHL, or submit exports.
            </p>
          </div>
          <Link className="h-fit rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-handoff">Open handoff packet</Link>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        {leadAcceptanceFindings.map((finding) => (
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" data-acceptance-finding={finding.id} key={finding.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-4xl">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold text-white">{finding.title}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(finding.status)}`}>{statusLabel(finding.status)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-300">{finding.detail}</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">Evidence: {finding.evidence}</p>
              </div>
              <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={finding.href}>Open surface</Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Findings session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Continue recording acceptance outcomes only from the acceptance board.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
