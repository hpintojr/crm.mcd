import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT } from "@/lib/lead-acceptance-findings";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";
import { LEAD_STATUS_BASELINE_COMMIT, leadProductionAcceptanceSteps } from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

type DiffTone = "text-emerald-200" | "text-amber-200" | "text-red-200" | "text-gray-300" | "text-brand-200";

type DiffRow = {
  id: string;
  label: string;
  expected: string;
  current: string;
  delta: string;
  href?: string | null;
  tone: DiffTone;
};

function deltaTone(delta: string): DiffTone {
  if (delta === "MATCH" || delta === "PASS_RECORDED") return "text-emerald-200";
  if (delta === "FAIL_RECORDED") return "text-red-200";
  if (delta === "DEFERRED_RECORDED" || delta === "MISSING_EVIDENCE" || delta === "DEPLOYMENT_AHEAD_OF_CATALOG") return "text-amber-200";
  if (delta === "CURRENT_DEPLOYMENT") return "text-brand-200";
  return "text-gray-300";
}

function commitShort(value: string | null | undefined) {
  return value ? value.slice(0, 12) : "unknown";
}

function formatOutcome(value: string | null | undefined) {
  return value ?? "MISSING";
}

export default async function LeadAcceptanceDiffPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const packet = await getLeadAcceptanceHandoffPacket();
  const deployedCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const deployedBranch = process.env.VERCEL_GIT_COMMIT_REF ?? "unknown";
  const expectedByStep = new Map(leadProductionAcceptanceSteps.map((step) => [step.id, step]));

  const commitRows: DiffRow[] = [
    {
      id: "status-baseline",
      label: "Deployment status baseline",
      expected: LEAD_STATUS_BASELINE_COMMIT,
      current: packet.statusBaselineCommit,
      delta: packet.statusBaselineCommit === LEAD_STATUS_BASELINE_COMMIT ? "MATCH" : "BASELINE_CHANGED",
      tone: packet.statusBaselineCommit === LEAD_STATUS_BASELINE_COMMIT ? "text-emerald-200" : "text-amber-200",
    },
    {
      id: "findings-catalog-marker",
      label: "Findings catalog production marker",
      expected: LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT,
      current: packet.latestProductionCommit,
      delta: packet.latestProductionCommit === LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT ? "MATCH" : "CATALOG_CHANGED",
      href: "/admin/leads/acceptance-findings",
      tone: packet.latestProductionCommit === LEAD_ACCEPTANCE_FINDINGS_LATEST_PRODUCTION_COMMIT ? "text-emerald-200" : "text-amber-200",
    },
    {
      id: "deployed-main-commit",
      label: "Current Vercel deployment commit",
      expected: "Production /api/status should report main at the deployed commit.",
      current: deployedCommit ? `${deployedBranch}:${deployedCommit}` : "Not exposed in this runtime",
      delta: deployedCommit && deployedCommit !== packet.latestProductionCommit ? "DEPLOYMENT_AHEAD_OF_CATALOG" : deployedCommit ? "CURRENT_DEPLOYMENT" : "UNKNOWN_RUNTIME_COMMIT",
      href: "/api/status",
      tone: deltaTone(deployedCommit && deployedCommit !== packet.latestProductionCommit ? "DEPLOYMENT_AHEAD_OF_CATALOG" : deployedCommit ? "CURRENT_DEPLOYMENT" : "UNKNOWN_RUNTIME_COMMIT"),
    },
  ];

  const evidenceRows: DiffRow[] = packet.evidence.steps.map((step) => {
    const expected = expectedByStep.get(step.id);
    const current = formatOutcome(step.outcome);
    const delta = step.outcome === "PASS" ? "PASS_RECORDED" : step.outcome === "FAIL" ? "FAIL_RECORDED" : step.outcome === "DEFERRED" ? "DEFERRED_RECORDED" : "MISSING_EVIDENCE";
    return {
      id: step.id,
      label: expected?.title ?? step.title,
      expected: expected?.evidence ?? "Acceptance evidence is required before owner decision.",
      current: `${current}${step.recordedAt ? ` · ${step.recordedAt}` : ""}`,
      delta,
      href: step.runbookHref,
      tone: deltaTone(delta),
    };
  });

  const openRows = evidenceRows.filter((row) => row.delta !== "PASS_RECORDED");
  const passRows = evidenceRows.filter((row) => row.delta === "PASS_RECORDED");

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-diff="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance diff</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only comparison between the required Lead Flow acceptance contract and the latest recorded production-acceptance evidence. This page does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Acceptance overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/deep-links#acceptance-diff">Deep link anchor</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-matrix">Evidence matrix</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Runbook</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">Acceptance board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Total evidence steps" value={packet.evidence.totalSteps} detail="Required checks" tone="text-brand-200" />
        <Metric label="Pass recorded" value={passRows.length} detail="Matches expectation" tone="text-emerald-200" />
        <Metric label="Open diff rows" value={openRows.length} detail="Missing/fail/deferred" tone={openRows.length ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Closed gates" value={packet.remainingClosedGates.length} detail="Still closed" tone="text-amber-200" />
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Commit and catalog diff</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Use this section to see whether the deployed build is ahead of the static acceptance catalog markers. If the deployed commit is ahead, the page is still read-only; update catalog markers only under a separate reviewed PR.
            </p>
          </div>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/status">Open /api/status</Link>
        </div>
        <DiffTable rows={commitRows} />
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Evidence diff</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Expected evidence comes from the 18-step production acceptance contract. Current state comes from the latest immutable acceptance audit record for each step.
            </p>
          </div>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Open gaps</Link>
        </div>
        <DiffTable rows={evidenceRows} />
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          Viewed by {actor.email}. This diff is an operator reference only. Hamilton-only authenticated production acceptance and owner production decision remain outside automation.
        </p>
      </section>
    </main>
  );
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-ink-700">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
          <tr>
            <th className="border-b border-ink-700 px-4 py-3 font-medium">Item</th>
            <th className="border-b border-ink-700 px-4 py-3 font-medium">Expected</th>
            <th className="border-b border-ink-700 px-4 py-3 font-medium">Current</th>
            <th className="border-b border-ink-700 px-4 py-3 font-medium">Delta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700 text-gray-200">
          {rows.map((row) => (
            <tr className="align-top" data-acceptance-diff-row={row.id} key={row.id}>
              <td className="px-4 py-3">
                {row.href ? <Link className="font-medium text-white underline decoration-ink-600 underline-offset-4 hover:text-brand-200" href={row.href}>{row.label}</Link> : <span className="font-medium text-white">{row.label}</span>}
                <p className="mt-1 break-all text-xs text-gray-500">{commitShort(row.id)}</p>
              </td>
              <td className="px-4 py-3 text-gray-300">{row.expected}</td>
              <td className="break-all px-4 py-3 text-gray-300">{row.current}</td>
              <td className={`px-4 py-3 font-medium ${row.tone}`}>{row.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: DiffTone }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-gray-500">{detail}</p>
    </div>
  );
}
