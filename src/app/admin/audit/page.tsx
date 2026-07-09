import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const acceptanceActions = [
  "LEAD_PRODUCTION_ACCEPTANCE_RECORDED",
  "LEAD_ACCEPTANCE_RECORDED",
  "SERVICING_ACCEPTANCE_RECORDED",
  "COMMISSION_ACCEPTANCE_RECORDED",
];

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
  return actionType.replaceAll("_", " ");
}

export default async function AuditPage() {
  await requireRole(ADMIN_ROLES);
  const [entries, rolloutEvidence] = await Promise.all([
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 250 }),
    db.auditLog.findMany({ where: { actionType: { in: acceptanceActions } }, orderBy: { createdAt: "desc" }, take: 75 }),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Audit history</h1>
          <p className="mt-2 text-gray-400">Recent sensitive and operational actions recorded by the Mini CRM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">
            Readiness board
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">
            Lead acceptance report
          </Link>
        </div>
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 px-6 py-4">
          <div>
            <h2 className="font-semibold text-white">Rollout acceptance evidence</h2>
            <p className="mt-1 text-sm text-gray-400">Recorded Pass, Fail, and Deferred results from production Lead Flow acceptance and controlled Servicing/Commission testing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/testing">
              Leads board
            </Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">
              Leads report
            </Link>
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/leads/acceptance-report.csv">
              Leads CSV
            </Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/servicing/testing">
              Servicing
            </Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/commissions/testing">
              Commissions
            </Link>
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
                <article className="px-6 py-4" key={entry.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-white">{metadata.stepTitle || formatAction(entry.actionType)}</p>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${outcomeClass(metadata.outcome)}`}>{outcomeLabel(metadata.outcome)}</span>
                        {metadata.module && <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs text-gray-300">{metadata.module}</span>}
                      </div>
                      <p className="mt-1 text-sm text-gray-400">
                        {entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}
                        {metadata.phase ? ` · ${metadata.phase}` : ""}
                      </p>
                      {entry.reason && <p className="mt-2 text-sm leading-6 text-gray-300">{entry.reason}</p>}
                      {commitEvidence && (
                        <p className="mt-2 break-all text-xs text-gray-500">
                          {metadata.statusBaselineCommit ? "Status baseline" : "Expected commit"}: {commitEvidence}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{entry.actorRole || "System"}</p>
                      <p className="mt-1">{entry.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900">
        {entries.length === 0 ? (
          <p className="px-6 py-10 text-sm text-gray-400">No audit records yet.</p>
        ) : (
          <div className="divide-y divide-ink-700">
            {entries.map((entry) => (
              <article className="px-6 py-4" key={entry.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{entry.actionType}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {entry.entityType}{entry.entityId ? ` · ${entry.entityId}` : ""}
                    </p>
                    {entry.reason && <p className="mt-2 text-sm text-gray-300">Reason: {entry.reason}</p>}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{entry.actorRole || "System"}</p>
                    <p className="mt-1">{entry.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
