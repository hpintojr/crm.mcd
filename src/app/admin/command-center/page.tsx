import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-gray-500">{detail}</p></article>;
}

export default async function CommandCenterPage() {
  await requireRole(ADMIN_ROLES);
  const [agents, submitted, approved, invitedUsers, unresolvedErrors, failedWebhooks, openCertifications] = await Promise.all([
    db.agent.count(),
    db.agent.count({ where: { status: { in: ["SUBMITTED", "PENDING_REVIEW", "NEEDS_CORRECTION"] } } }),
    db.agent.count({ where: { status: "APPROVED" } }),
    db.user.count({ where: { status: "INVITED", role: "AGENT" } }),
    db.integrationError.count({ where: { resolved: false } }),
    db.webhookEvent.count({ where: { status: "ERROR" } }),
    db.agent.count({ where: { canClaimLeads: false, status: { in: ["APPROVED", "ACTIVE"] } } }),
  ]);

  return <main className="mx-auto min-h-screen max-w-6xl px-6 py-12"><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Command center</h1><p className="mt-2 text-gray-400">Live operations snapshot for onboarding, integrations, and production acceptance entrypoints.</p><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Metric label="Registered agents" value={agents} detail="All Mini CRM agent profiles" /><Metric label="Awaiting review" value={submitted} detail="Submitted, pending review, or correction requested" /><Metric label="Approved agents" value={approved} detail="Approved before or during onboarding" /><Metric label="Invited portal users" value={invitedUsers} detail="Provisioned agents who have not activated" /><Metric label="Integration attention" value={unresolvedErrors} detail="Unresolved integration error records" /><Metric label="Failed webhooks" value={failedWebhooks} detail="Retry-safe webhook events requiring review" /><Metric label="Certification pending" value={openCertifications} detail="Approved or active agents without lead eligibility" /></div><div className="mt-8 flex flex-wrap gap-3">{features.leads && <a className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 hover:border-brand-400" href="/admin/leads/acceptance-command-center">Lead command center</a>}<a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin">Applicant review</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/agents">Agent operations</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/certification">Certification</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/integrations/errors">Integration errors</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/audit">Audit history</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/finance-preview">Commission preview</a><a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/settings">Module readiness</a>{features.leads && <a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href="/admin/leads">Lead review</a>}</div></main>;
}
