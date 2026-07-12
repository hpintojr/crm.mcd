import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getProjectReadinessSnapshot, type ProjectModuleState } from "@/lib/project-readiness";

export const dynamic = "force-dynamic";

function stateLabel(state: ProjectModuleState) {
  return state.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function stateClass(state: ProjectModuleState) {
  if (state === "ACCEPTED") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (state === "CONTROLLED_TEST") return "border-brand-700 bg-brand-950/20 text-brand-200";
  if (state === "SCHEMA_DRIFT" || state === "UNKNOWN") return "border-red-800 bg-red-950/20 text-red-200";
  if (state === "MIGRATION_STAGED" || state === "BUILT_GATED") return "border-amber-800 bg-amber-950/20 text-amber-200";
  return "border-ink-700 bg-ink-950 text-gray-300";
}

function pacific(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

export default async function ProjectReadinessPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getProjectReadinessSnapshot();

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-project-readiness="mcd-control-plane">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Project readiness control plane</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            One read-only source for deployed commit, feature gates, acceptance evidence, integration health,
            Client/Service schema state, and Commission migration readiness. This page reports state; it never
            opens a gate or applies a migration.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/project-readiness">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/readiness">Readiness board</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/operating-status">Operating status</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/command-center">Command center</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Environment" value={snapshot.deployment.environment} detail="Current Vercel runtime" />
        <Metric label="Branch" value={snapshot.deployment.branch} detail="Expected main in production" />
        <Metric label="Commit" value={snapshot.deployment.commitShort} detail="Current deployed Git SHA" />
        <Metric label="Snapshot" value={snapshot.ok ? "Available" : "Read failed"} detail={`Version ${snapshot.version}`} alert={!snapshot.ok} />
      </section>

      {!snapshot.ok ? (
        <section className="mt-8 rounded-2xl border border-red-800 bg-red-950/20 p-6">
          <h2 className="font-semibold text-red-100">Readiness catalog unavailable</h2>
          <p className="mt-2 text-sm text-red-100/80">{snapshot.error}</p>
          <p className="mt-3 text-xs text-red-200/70">{snapshot.safetyBoundary}</p>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-4" data-project-readiness-modules="mcd">
            {snapshot.modules.map((module) => (
              <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-project-readiness-module={module.key} key={module.key}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="font-semibold text-white">{module.label}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${stateClass(module.state)}`}>{stateLabel(module.state)}</span>
                </div>
                <p className="mt-4 text-sm text-gray-300">Gate: <span className={module.gateEnabled ? "text-emerald-200" : "text-gray-400"}>{module.gateEnabled ? "Enabled" : "Staged / locked"}</span></p>
                <p className="mt-2 text-sm text-gray-300">Schema: {module.schemaState.replaceAll("_", " ").toLowerCase()}</p>
                {module.acceptance ? (
                  <div className="mt-4 rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm text-gray-300">
                    <p><span className="font-medium text-white">{module.acceptance.passed}</span> / {module.acceptance.totalSteps} passed</p>
                    <p className="mt-1 text-xs text-gray-500">{module.acceptance.failed} failed · {module.acceptance.deferred} deferred · {module.acceptance.missing} missing</p>
                    <p className="mt-1 text-xs text-gray-500">Latest evidence: {pacific(module.acceptance.latestRecordedAt)} PT</p>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm text-gray-500">No acceptance board in this readiness-only phase.</p>
                )}
                <p className="mt-4 text-sm leading-6 text-brand-200">Next: {module.nextAction}</p>
              </article>
            ))}
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-project-readiness-schema="client-service">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">Client / Service schema</h2>
                  <p className="mt-2 text-sm text-gray-400">Production catalog state for the four raw-SQL Client/Service tables.</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${snapshot.schema.clientService.state === "SOURCE_ALIGNED" ? "border-emerald-700 text-emerald-200" : "border-red-800 text-red-200"}`}>{snapshot.schema.clientService.state.replaceAll("_", " ")}</span>
              </div>
              <ObjectList title="Present" items={snapshot.schema.clientService.presentTables} empty="No expected Client/Service tables found." />
              <ObjectList title="Missing" items={snapshot.schema.clientService.missingTables} empty="None" warning={snapshot.schema.clientService.missingTables.length > 0} />
            </article>

            <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-project-readiness-schema="commission">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">Commission / Payout schema</h2>
                  <p className="mt-2 text-sm text-gray-400">Live catalog compared with the source-aligned PR #100 migration.</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${snapshot.schema.commission.state === "SOURCE_ALIGNED" ? "border-emerald-700 text-emerald-200" : snapshot.schema.commission.state === "STAGED_ONLY" ? "border-amber-800 text-amber-200" : "border-red-800 text-red-200"}`}>{snapshot.schema.commission.state.replaceAll("_", " ")}</span>
              </div>
              <ObjectList title="Present tables" items={snapshot.schema.commission.presentTables} empty="None — migration remains staged only." />
              <ObjectList title="Missing tables" items={snapshot.schema.commission.missingTables} empty="None" warning={snapshot.schema.commission.state === "PARTIAL_OR_DRIFTED"} />
              <ObjectList title="Legacy types detected" items={snapshot.schema.commission.legacyTypesPresent} empty="None" warning={snapshot.schema.commission.legacyTypesPresent.length > 0} />
              <ObjectList title="Legacy ledger columns detected" items={snapshot.schema.commission.legacyLedgerColumnsPresent} empty="None" warning={snapshot.schema.commission.legacyLedgerColumnsPresent.length > 0} />
            </article>
          </section>

          <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900" data-project-readiness-enums="commission">
            <div className="border-b border-ink-700 px-6 py-4">
              <h2 className="font-semibold text-white">Commission enum contract</h2>
              <p className="mt-1 text-sm text-gray-400">Exact enum order matters because the application casts raw SQL values by type name.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-ink-950/60 text-xs uppercase tracking-widest text-gray-400">
                  <tr>
                    <th className="border-b border-ink-700 px-4 py-3 font-medium">Enum</th>
                    <th className="border-b border-ink-700 px-4 py-3 font-medium">State</th>
                    <th className="border-b border-ink-700 px-4 py-3 font-medium">Actual values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-700 text-gray-200">
                  {snapshot.schema.commission.enums.map((item) => (
                    <tr key={item.name}>
                      <td className="px-4 py-3 font-mono text-xs text-brand-200">{item.name}</td>
                      <td className={`px-4 py-3 text-xs ${item.matches ? "text-emerald-200" : item.present ? "text-red-200" : "text-gray-500"}`}>{item.matches ? "MATCH" : item.present ? "DRIFT" : "NOT APPLIED"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{item.actualValues.length ? item.actualValues.join(", ") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 grid gap-4 md:grid-cols-2">
            <Metric label="Unresolved integration errors" value={String(snapshot.integrations.unresolvedErrors)} detail="IntegrationError.resolved = false" alert={snapshot.integrations.unresolvedErrors > 0} />
            <Metric label="Failed webhook events" value={String(snapshot.integrations.failedWebhooks)} detail="WebhookEvent.status = ERROR" alert={snapshot.integrations.failedWebhooks > 0} />
          </section>
        </>
      )}

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Safety boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">{snapshot.safetyBoundary}</p>
        <p className="mt-3 text-xs text-amber-200/70">Viewed by {actor.email}. Generated {pacific(snapshot.generatedAt)} PT.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, alert = false }: { label: string; value: string; detail: string; alert?: boolean }) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-2 break-all text-2xl font-semibold ${alert ? "text-red-200" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </article>
  );
}

function ObjectList({ title, items, empty, warning = false }: { title: string; items: readonly string[]; empty: string; warning?: boolean }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-medium uppercase tracking-widest text-gray-500">{title}</p>
      {items.length ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => <li className={`rounded-lg border px-2.5 py-1 font-mono text-xs ${warning ? "border-red-800 text-red-200" : "border-ink-700 text-gray-300"}`} key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{empty}</p>
      )}
    </div>
  );
}
