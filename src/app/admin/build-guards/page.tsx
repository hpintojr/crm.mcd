import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getBuildGuardRegistrySnapshot } from "@/lib/build-guard-control-plane";

export const dynamic = "force-dynamic";

function statusClass(enabled: boolean) {
  return enabled
    ? "border-emerald-700 bg-emerald-950/20 text-emerald-200"
    : "border-ink-700 bg-ink-950/60 text-gray-300";
}

export default async function BuildGuardRegistryPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = getBuildGuardRegistrySnapshot();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-build-guard-registry="mcd-source-control-plane">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Build guard registry</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Reviewed source manifest for production-build guard order, local script paths, required pass lines, Lead-flow execution membership, and deployment-verification visibility.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/build-guards">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/project-readiness">Project readiness</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/route-boundaries">Route boundaries</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Registered guards" value={String(snapshot.summary.guardCount)} detail="Exact manifest entries" />
        <Metric label="Lead-flow execution" value={String(snapshot.summary.leadFlowGuardCount)} detail="Sequential runner membership" />
        <Metric label="Build prelude" value={String(snapshot.summary.buildPreludeGuardCount)} detail="Executed before the Lead-flow group" />
        <Metric label="Deployment visible" value={String(snapshot.summary.deploymentVisibleCount)} detail="Pass lines shown in verification" />
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="border-b border-ink-700 px-6 py-4">
          <h2 className="font-semibold text-white">Ordered guard manifest</h2>
          <p className="mt-1 text-sm text-gray-400">Version {snapshot.version} · reviewed {snapshot.reviewedAt}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
              <tr>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Order</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Guard</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Local script</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Lead-flow</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Deployment</th>
                <th className="border-b border-ink-700 px-4 py-3 font-medium">Required pass line</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700 text-gray-200">
              {snapshot.guards.map((guard) => (
                <tr data-build-guard-entry={guard.id} key={guard.id}>
                  <td className="px-4 py-4 font-mono text-xs text-gray-400">{guard.order}</td>
                  <td className="px-4 py-4 font-mono text-xs text-brand-200">{guard.id}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-300">{guard.script}</td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(guard.runInLeadFlow)}`}>
                      {guard.runInLeadFlow ? "Runs" : "Prelude"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(guard.exposeInDeploymentVerification)}`}>
                      {guard.exposeInDeploymentVerification ? "Visible" : "Hidden"}
                    </span>
                  </td>
                  <td className="max-w-xl px-4 py-4 text-sm leading-6 text-gray-300">{guard.passLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">{snapshot.safetyBoundary}</p>
        <p className="mt-3 text-xs text-amber-200/70">Viewed with {actor.role} access.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </article>
  );
}
