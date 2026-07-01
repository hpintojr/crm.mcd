import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export default async function AgentsPage() {
  await requireRole(ADMIN_ROLES);
  const agents = await db.agent.findMany({
    include: { user: { select: { status: true } }, onboardingDocs: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Agent operations</h1>
      <p className="mt-2 text-gray-400">Review onboarding, CRM access, and lead eligibility.</p>
      <section className="mt-10 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {agents.length === 0 ? <p className="px-6 py-10 text-sm text-gray-400">No agents have registered yet.</p> : (
          <div className="divide-y divide-ink-700">
            {agents.map((agent) => {
              const documentsComplete = agent.onboardingDocs.filter((document) => document.status === "COMPLETED").length;
              return (
                <article className="flex flex-wrap items-center justify-between gap-4 px-6 py-5" key={agent.id}>
                  <div>
                    <p className="font-medium text-white">{agent.preferredName || agent.legalName}</p>
                    <p className="mt-1 text-sm text-gray-400">{agent.personalEmail} · {agent.status}</p>
                    <p className="mt-1 text-xs text-gray-500">Documents: {documentsComplete}/4 · Account: {agent.user?.status ?? "Not provisioned"}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={agent.canClaimLeads ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>{agent.canClaimLeads ? "Lead eligible" : "Lead access pending"}</span>
                    <a className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200 hover:border-brand-500" href={`/admin/agents/${agent.id}/certify`}>Certification</a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
