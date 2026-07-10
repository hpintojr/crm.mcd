import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type AuditPageProps = { searchParams: Promise<{ action?: string; entity?: string; outcome?: string }> };

const acceptanceActions = [
  "LEAD_PRODUCTION_ACCEPTANCE_RECORDED",
  "LEAD_ACCEPTANCE_RECORDED",
  "SERVICING_ACCEPTANCE_RECORDED",
  "COMMISSION_ACCEPTANCE_RECORDED",
];

const actionFilters = [
  { value: "all", label: "All actions" },
  { value: "acceptance", label: "Acceptance" },
  { value: "controlled", label: "Controlled data / harness" },
  { value: "lead", label: "Lead activity" },
  { value: "ghl", label: "GHL relay" },
  { value: "integration", label: "Integration errors" },
];

const outcomeFilters = ["all", "PASS", "FAIL", "DEFERRED"] as const;

type AcceptanceOutcome = "PASS" | "FAIL" | "DEFERRED";

type AcceptanceMetadata = {
  module?: string;
  phase?: string;
  outcome?: AcceptanceOutcome;
  stepId?: string;
  stepTitle?: string;
  expectedCommit?: string;
  statusBaselineCommit?: string;
};

function readAcceptanceMetadata(metadata: unknown): AcceptanceMetadata {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const source = metadata as Record<string, unknown>;
  const outcome = source.outcome === "PASS" || source.outcome === "FAIL" || source.outcome === "DEFERRED" ? source.outcome : undefined;
  return {
    module: typeof source.module === "string" ? source.module : undefined,
    phase: typeof source.phase === "string" ? source.phase : undefined,
    outcome,
    stepId: typeof source.stepId === "string" ? source.stepId : undefined,
    stepTitle: typeof source.stepTitle === "string" ? source.stepTitle : undefined,
    expectedCommit: typeof source.expectedCommit === "string" ? source.expectedCommit : undefined,
    statusBaselineCommit: typeof source.statusBaselineCommit === "string" ? source.statusBaselineCommit : undefined,
  };
}

function outcomeClass(outcome?: AcceptanceOutcome) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 text-amber-200";
  return "border-ink-700 text-gray-400";
}

function outcomeLabel(outcome?: AcceptanceOutcome) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Recorded";
}

function formatAction(actionType: string) {
  return actionType.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function pacific(value: Date) {
  return value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

function matchesActionFilter(actionType: string, filter: string) {
  if (filter === "acceptance") return acceptanceActions.includes(actionType);
  if (filter === "controlled") return actionType.includes("CONTROLLED") || actionType.includes("TEST_EVENT");
  if (filter === "lead") return actionType.startsWith("LEAD_") || actionType.startsWith("COLD_LEAD_");
  if (filter === "ghl") return actionType.startsWith("GHL_");
  if (filter === "integration") return actionType.startsWith("INTEGRATION_");
  return true;
}

function metadataPreview(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const source = metadata as Record<string, unknown>;
  const safeKeys = ["phase", "module", "outcome", "family", "eventType", "leadId", "pool", "lifecycle", "priorPool", "priorLifecycle", "claimCreated", "controlledTestLead", "simulatedOnly", "liveGhlWorkflowActivated", "liveGhlExportSubmitted"];
  return safeKeys
    .filter((key) => source[key] !== undefined && source[key] !== null)
    .slice(0, 8)
    .map((key) => `${key}: ${String(source[key])}`);
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireRole(ADMIN_ROLES);
  const params = await searchParams;
  const actionFilter = actionFilters.some((item) => item.value === params.action) ? params.action || "all" : "all";
  const entityFilter = params.entity?.trim() || "all";
  const outcomeFilter = outcomeFilters.includes(params.outcome as (typeof outcomeFilters)[number]) ? params.outcome || "all" : "all";

  const [entries, rolloutEvidence] = await Promise.all([
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 500 }),
    db.auditLog.findMany({ where: { actionType: { in: acceptanceActions } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);

  const filteredEntries = entries.filter((entry) => {
    const acceptance = readAcceptanceMetadata(entry.metadata);
    const actionOk = matchesActionFilter(entry.actionType, actionFilter);
    const entityOk = entityFilter === "all" || entry.entityType === entityFilter;
    const outcomeOk = outcomeFilter === "all" || acceptance.outcome === outcomeFilter;
    return actionOk && entityOk && outcomeOk;
  });
  const entityTypes = Array.from(new Set(entries.map((entry) => entry.entityType))).sort();
  const acceptanceCount = entries.filter((entry) => acceptanceActions.includes(entry.actionType)).length;
  const controlledCount = entries.filter((entry) => matchesActionFilter(entry.actionType, "controlled")).length;
  const leadCount = entries.filter((entry) => matchesActionFilter(entry.actionType, "lead")).length;
  const integrationCount = entries.filter((entry) => matchesActionFilter(entry.actionType, "integration")).length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Audit history</h1>
          <p className="mt-2 max-w-4xl text-gray-400">NextCRM-inspired timeline view for recent sensitive, acceptance, lead, and integration actions. Filter and review evidence without changing data.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Lead command center</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Lead acceptance runbook</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Lead acceptance report</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/audit/export">Export audit</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Acceptance evidence" value={acceptanceCount} detail="Recorded rollout steps" />
        <Metric label="Controlled evidence" value={controlledCount} detail="Test data / GHL harness" />
        <Metric label="Lead actions" value={leadCount} detail="Workspace and Lead events" />
        <Metric label="Integration actions" value={integrationCount} detail="Resolution and relay evidence" />
      </section>

      <form className="mt-6 grid gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-5 md:grid-cols-[1fr_1fr_1fr_auto]" data-audit-ux="filter-bar">
        <label className="text-sm text-gray-300">Action group<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="action" defaultValue={actionFilter}>{actionFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm text-gray-300">Entity type<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="entity" defaultValue={entityFilter}><option value="all">All entities</option>{entityTypes.map((entity) => <option key={entity} value={entity}>{entity}</option>)}</select></label>
        <label className="text-sm text-gray-300">Acceptance outcome<select className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="outcome" defaultValue={outcomeFilter}>{outcomeFilters.map((outcome) => <option key={outcome} value={outcome}>{outcome === "all" ? "All outcomes" : outcome}</option>)}</select></label>
        <div className="flex items-end gap-2"><button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950" type="submit">Apply filters</button><Link className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-gray-200" href="/admin/audit">Reset</Link></div>
      </form>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 px-6 py-4">
          <div>
            <h2 className="font-semibold text-white">Rollout acceptance evidence</h2>
            <p className="mt-1 text-sm text-gray-400">Recorded Pass, Fail, and Deferred results from production Lead Flow acceptance and controlled Servicing/Commission testing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">Lead command center</Link><Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">Lead acceptance runbook</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/testing">Leads board</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Leads report</Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/leads/acceptance-report.csv">Leads CSV</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/servicing/testing">Servicing</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/commissions/testing">Commissions</Link>
          </div>
        </div>
        {rolloutEvidence.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400">No acceptance results have been recorded yet.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {rolloutEvidence.map((entry) => {
              const metadata = readAcceptanceMetadata(entry.metadata);
              const commitEvidence = metadata.statusBaselineCommit || metadata.expectedCommit;
              return (
                <article className="px-6 py-4" data-audit-ux="acceptance-row" key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{metadata.stepTitle || formatAction(entry.actionType)}</p><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${outcomeClass(metadata.outcome)}`}>{outcomeLabel(metadata.outcome)}</span>{metadata.module && <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-gray-300">{metadata.module}</span>}</div>
                      <p className="mt-1 text-sm text-gray-400">{entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}{metadata.phase ? ` · ${metadata.phase}` : ""}</p>
                      {entry.reason && <p className="mt-2 text-sm leading-6 text-gray-300">{entry.reason}</p>}
                      {commitEvidence && <p className="mt-2 break-all text-xs text-gray-500">{metadata.statusBaselineCommit ? "Status baseline" : "Expected commit"}: {commitEvidence}</p>}
                    </div>
                    <div className="text-right text-xs text-gray-500"><p>{entry.actorRole || "System"}</p><p className="mt-1">{pacific(entry.createdAt)}</p></div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900" data-audit-ux="timeline">
        <div className="border-b border-ink-700 px-6 py-4"><h2 className="font-semibold text-white">Filtered audit timeline</h2><p className="mt-1 text-sm text-gray-400">Showing {filteredEntries.length} of {entries.length} recent records.</p></div>
        {filteredEntries.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No audit records match these filters.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {filteredEntries.map((entry) => {
              const acceptance = readAcceptanceMetadata(entry.metadata);
              const preview = metadataPreview(entry.metadata);
              return (
                <article className="px-6 py-4" data-audit-ux="timeline-row" key={entry.id}>
                  <div className="grid gap-4 lg:grid-cols-[auto_1fr_auto]">
                    <div className="hidden pt-1 lg:block"><span className="block h-3 w-3 rounded-full bg-brand-500" /></div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><p className="font-medium text-white">{formatAction(entry.actionType)}</p>{acceptance.outcome && <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${outcomeClass(acceptance.outcome)}`}>{outcomeLabel(acceptance.outcome)}</span>}<span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-gray-300">{entry.entityType}</span></div>
                      <p className="mt-1 break-all text-sm text-gray-400">{entry.entityId || "No entity id"}</p>
                      {entry.reason && <p className="mt-2 text-sm leading-6 text-gray-300">Reason: {entry.reason}</p>}
                      {preview.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{preview.map((item) => <span className="rounded-lg border border-ink-700 bg-ink-950 px-2.5 py-1 text-xs text-gray-400" key={item}>{item}</span>)}</div>}
                    </div>
                    <div className="text-left text-xs text-gray-500 lg:text-right"><p>{entry.actorRole || "System"}</p><p className="mt-1">{pacific(entry.createdAt)}</p></div>
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

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className="mt-2 text-3xl font-semibold text-white">{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
