import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Phase = {
  name: string;
  gate: boolean;
  status: string;
  detail: string;
  next: string;
  href: string;
  commandHref?: string;
  reportHref?: string;
  exportHref?: string;
};

function state(enabled: boolean) {
  return enabled ? "Controlled test enabled" : "Staged / locked";
}

export default async function OperatingStatusPage() {
  const user = await requireRole(ADMIN_ROLES);
  const phases: Phase[] = [
    {
      name: "Production Lead Flow acceptance",
      gate: features.leads,
      status: state(features.leads),
      detail:
        "PR #34 through PR #50 are deployed. Custom-domain smoke passed. The Lead acceptance command center now sits above the acceptance board, report, controlled test data, controlled GHL harness, aging dry-run, agent-friendly workspace, and audit evidence views.",
      next: "Use the command center as the starting point, record controlled production Lead Flow acceptance results, review the report, then record the owner decision before expanding normal agent use or external GHL workflow activation.",
      href: "/admin/leads/testing",
      commandHref: "/admin/leads/acceptance-command-center",
      reportHref: "/admin/leads/acceptance-report",
      exportHref: "/api/admin/leads/acceptance-report.csv",
    },
    { name: "Client Servicing Health", gate: features.servicing, status: state(features.servicing), detail: "Production schema and gated admin/agent workspaces are deployed. Service work is trigger-driven; healthy current-paying accounts are not reassigned because they are quiet.", next: "Run the controlled Client Servicing acceptance board before normal client-account use.", href: "/admin/servicing/testing" },
    { name: "Commission Eligibility & Ledger", gate: features.commissions, status: state(features.commissions), detail: "Gated dashboard, ledger controls, policy checks, and an isolated commission-only schema migration are prepared. No payout action exists in this phase.", next: "Validate the isolated Neon branch, approve the separate commission schema migration, then run the controlled Commission acceptance board.", href: "/admin/commissions/testing" },
    { name: "Finance & Payout Readiness", gate: features.finance, status: state(features.finance), detail: "A gated readiness boundary is built. It blocks manual review until eligibility, clearance, no active holds, finance approval, and an externally verified destination are all present; it never moves funds.", next: "Begin controlled review only after Commission Eligibility & Ledger stabilizes and receives owner approval.", href: "/admin/finance" },
  ];

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Operating status</h1><p className="mt-2 max-w-4xl text-gray-400">One place to review rollout sequence, feature gates, integration health, and the next approval required for each module.</p></div><div className="flex flex-wrap items-center gap-3"><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Lead command center</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Lead acceptance runbook</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Lead acceptance report</Link><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/integrations">Integration monitor</Link><p className="text-sm text-gray-500">Admin session: {user.email}</p></div></div><section className="mt-8 grid gap-5 lg:grid-cols-2">{phases.map((phase) => <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" key={phase.name}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold text-white">{phase.name}</h2><span className={`rounded-full border px-3 py-1 text-xs ${phase.gate ? "border-emerald-700 text-emerald-200" : "border-ink-700 text-gray-300"}`}>{phase.status}</span></div><p className="mt-4 text-sm leading-6 text-gray-300">{phase.detail}</p><p className="mt-4 text-sm text-brand-200">Next gate: {phase.next}</p><div className="mt-5 flex flex-wrap gap-2">{phase.commandHref && <Link className="inline-flex rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={phase.commandHref}>Command center</Link>}<Link className="inline-flex rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={phase.href}>Open module</Link>{phase.reportHref && <Link className="inline-flex rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={phase.reportHref}>Open report</Link>}{phase.exportHref && <Link className="inline-flex rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={phase.exportHref}>CSV export</Link>}</div></article>)}</section></main>;
}
