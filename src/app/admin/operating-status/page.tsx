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
      name: "Production Lead Flow",
      gate: features.leads,
      status: state(features.leads),
      detail:
        "The 18-step production acceptance runbook is complete and the owner production decision is recorded PASS. Cold Lead activity-first calling, two-way-contact claim controls, DNC, aging, controlled GHL simulations, and deployment verification are deployed through PR #100.",
      next: "Monitor normal Lead Flow operations and Integration Monitor. Keep live external GHL workflow changes and new import/export runs separately controlled.",
      href: "/admin/leads/testing",
      commandHref: "/admin/leads/acceptance-command-center",
      reportHref: "/admin/leads/acceptance-report",
      exportHref: "/api/admin/leads/acceptance-report.csv",
    },
    {
      name: "Client Servicing Health",
      gate: features.servicing,
      status: state(features.servicing),
      detail:
        "The Client/Service tables are present in production and the onboarding, launch, trigger-based case, healthy-account protection, and House-transfer workspaces are built. Normal use remains gated.",
      next: "Use Project Readiness to confirm schema state, then obtain an explicit owner-authorized controlled Servicing acceptance window before opening the gate.",
      href: "/admin/servicing/testing",
    },
    {
      name: "Commission Eligibility & Ledger",
      gate: features.commissions,
      status: state(features.commissions),
      detail:
        "PR #100 corrected the staged Commission/Payout migration to match the application's raw SQL and added the missing Hold, Eligibility Decision, and Agent Profile tables. The exact DDL passed disposable-branch catalog and lifecycle tests, but remains unapplied to production.",
      next: "Do not enable Commissions. A production migration apply requires a new explicit Hamilton authorization, followed by a separately authorized controlled acceptance window.",
      href: "/admin/commissions/testing",
    },
    {
      name: "Finance & Payout Readiness",
      gate: features.finance,
      status: state(features.finance),
      detail:
        "Finance is a readiness-only boundary. It documents eligibility, clearance, hold, approval, and external destination prerequisites; it does not store bank details, initiate payment-provider actions, or move money.",
      next: "Remain locked until Commission schema and acceptance stabilize and Hamilton separately approves the Finance phase.",
      href: "/admin/finance",
    },
  ];

  return <main className="mx-auto min-h-screen max-w-7xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Operating status</h1><p className="mt-2 max-w-4xl text-gray-400">One place to review rollout sequence, feature gates, integration health, and the next approval required for each module.</p></div><div className="flex flex-wrap items-center gap-3"><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/project-readiness">Project readiness</Link><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Lead command center</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Lead acceptance runbook</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Lead acceptance report</Link><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/integrations">Integration monitor</Link><p className="text-sm text-gray-500">Admin session: {user.email}</p></div></div><section className="mt-8 grid gap-5 lg:grid-cols-2">{phases.map((phase) => <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" key={phase.name}><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold text-white">{phase.name}</h2><span className={`rounded-full border px-3 py-1 text-xs ${phase.gate ? "border-emerald-700 text-emerald-200" : "border-ink-700 text-gray-300"}`}>{phase.status}</span></div><p className="mt-4 text-sm leading-6 text-gray-300">{phase.detail}</p><p className="mt-4 text-sm text-brand-200">Next gate: {phase.next}</p><div className="mt-5 flex flex-wrap gap-2">{phase.commandHref && <Link className="inline-flex rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={phase.commandHref}>Command center</Link>}<Link className="inline-flex rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={phase.href}>Open module</Link>{phase.reportHref && <Link className="inline-flex rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={phase.reportHref}>Open report</Link>}{phase.exportHref && <Link className="inline-flex rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={phase.exportHref}>CSV export</Link>}</div></article>)}</section></main>;
}
