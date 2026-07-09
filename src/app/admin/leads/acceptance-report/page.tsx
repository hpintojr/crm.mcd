import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { getAcceptanceEvidenceSummary } from "@/lib/acceptance-evidence-summary";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceGroups,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
  type LeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

function statusClass(outcome: LeadProductionAcceptanceOutcome | null) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 text-amber-200";
  return "border-ink-700 text-gray-400";
}

function statusLabel(outcome: LeadProductionAcceptanceOutcome | null) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Not recorded";
}

function pacific(value: string) {
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" });
}

export default async function LeadProductionAcceptanceReportPage() {
  await requireRole(ADMIN_ROLES);
  const [records, controlledEvidence] = await Promise.all([
    db.auditLog.findMany({
      where: { actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION, entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY },
      orderBy: { createdAt: "desc" },
      take: 1_000,
    }),
    getAcceptanceEvidenceSummary(),
  ]);
  const latestByStep = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  }
  const groupSummaries = leadProductionAcceptanceGroups.map((group) => {
    const outcomes = group.steps.map((step) => readLeadProductionAcceptanceOutcome(latestByStep.get(step.id)?.metadata));
    return {
      title: group.title,
      detail: group.detail,
      total: group.steps.length,
      pass: outcomes.filter((outcome) => outcome === "PASS").length,
      fail: outcomes.filter((outcome) => outcome === "FAIL").length,
      deferred: outcomes.filter((outcome) => outcome === "DEFERRED").length,
      missing: outcomes.filter((outcome) => !outcome).length,
    };
  });
  const totalSteps = groupSummaries.reduce((total, group) => total + group.total, 0);
  const passCount = groupSummaries.reduce((total, group) => total + group.pass, 0);
  const failCount = groupSummaries.reduce((total, group) => total + group.fail, 0);
  const deferredCount = groupSummaries.reduce((total, group) => total + group.deferred, 0);
  const missingCount = groupSummaries.reduce((total, group) => total + group.missing, 0);
  const ownerRecord = latestByStep.get("owner-production-decision") ?? null;
  const ownerOutcome = readLeadProductionAcceptanceOutcome(ownerRecord?.metadata);
  const readyForOwnerDecision = failCount === 0 && missingCount === 1 && !ownerOutcome;
  const fullyPassed = passCount === totalSteps;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead Production Acceptance Report</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Live read-only report for the {LEAD_PRODUCTION_ACCEPTANCE_PHASE} acceptance lane. This page summarizes acceptance evidence, controlled test data, and controlled GHL harness activity; it does not change feature flags or mutate Leads.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">
            Command center
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-report">
            JSON report
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/leads/acceptance-report.csv">
            CSV export
          </Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing">
            Acceptance board
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-4">
        <Metric label="Passed" value={passCount} detail={`${totalSteps} total steps`} tone="text-emerald-200" />
        <Metric label="Failed" value={failCount} detail="Must be zero before owner approval" tone={failCount ? "text-red-200" : "text-gray-200"} />
        <Metric label="Deferred" value={deferredCount} detail="Needs explicit remediation or owner note" tone={deferredCount ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Not recorded" value={missingCount} detail={readyForOwnerDecision ? "Only owner decision remains" : "Acceptance evidence still needed"} tone={missingCount ? "text-amber-200" : "text-emerald-200"} />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Owner decision readiness</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {fullyPassed
                ? "All acceptance steps are marked pass. Broader live operations still require the owner-approved scope boundaries to remain explicit."
                : readyForOwnerDecision
                  ? "All non-owner-decision steps are pass-ready with no failures. Record the owner production decision before expanding normal Lead Flow use."
                  : "Not ready for owner production decision yet. Resolve failed, deferred, or unrecorded acceptance evidence first."}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${fullyPassed || readyForOwnerDecision ? "border-emerald-700 text-emerald-200" : "border-amber-700 text-amber-200"}`}>
            {fullyPassed ? "Fully passed" : readyForOwnerDecision ? "Owner decision ready" : "Acceptance pending"}
          </span>
        </div>
        <p className="mt-4 break-all text-xs text-gray-500">Deployment status baseline: {LEAD_STATUS_BASELINE_COMMIT}</p>
      </section>

      <section className="mt-6 rounded-2xl border border-brand-900 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Controlled acceptance evidence</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">Evidence from PR #45 controlled test data and PR #46 controlled GHL harness is summarized here for acceptance review and CSV export.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={controlledEvidence.links.controlledTestDataHref}>Controlled data</Link>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={controlledEvidence.links.controlledGhlHarnessHref}>GHL harness</Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <Metric label="Controlled Leads" value={controlledEvidence.counts.controlledLeadCount} detail={`${controlledEvidence.counts.activeControlledLeadCount} active · ${controlledEvidence.counts.archivedControlledLeadCount} archived`} tone="text-white" />
          <Metric label="Recent data audits" value={controlledEvidence.counts.recentControlledCreateAuditCount + controlledEvidence.counts.recentControlledArchiveAuditCount} detail="Create/archive evidence" tone="text-white" />
          <Metric label="Harness runs" value={controlledEvidence.counts.recentHarnessAppliedCount} detail="Recent controlled simulations" tone="text-white" />
        </div>
        {controlledEvidence.recentEvidence.length === 0 ? (
          <p className="mt-5 rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm text-gray-400">No controlled data or harness evidence has been recorded yet.</p>
        ) : (
          <div className="mt-5 divide-y divide-ink-700 rounded-xl border border-ink-700 bg-ink-950">
            {controlledEvidence.recentEvidence.slice(0, 6).map((evidence) => (
              <div className="px-4 py-3" key={evidence.id}>
                <p className="text-sm font-medium text-white">{evidence.actionType}</p>
                <p className="mt-1 text-xs text-gray-500">{evidence.kind} · {evidence.entityId || "No entity"} · {pacific(evidence.createdAt)}</p>
                {evidence.reason && <p className="mt-1 text-sm text-gray-300">{evidence.reason}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-3">
        {groupSummaries.map((group) => (
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={group.title}>
            <h2 className="font-semibold text-white">{group.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">{group.detail}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <p className="rounded-lg border border-ink-700 bg-ink-950 p-3 text-emerald-200">Pass: {group.pass}</p>
              <p className="rounded-lg border border-ink-700 bg-ink-950 p-3 text-red-200">Fail: {group.fail}</p>
              <p className="rounded-lg border border-ink-700 bg-ink-950 p-3 text-amber-200">Deferred: {group.deferred}</p>
              <p className="rounded-lg border border-ink-700 bg-ink-950 p-3 text-gray-300">Missing: {group.missing}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-8 space-y-6">
        {leadProductionAcceptanceGroups.map((group) => (
          <div className="space-y-3" key={group.title}>
            <h2 className="text-xl font-semibold text-white">{group.title}</h2>
            {group.steps.map((step) => {
              const record = latestByStep.get(step.id) ?? null;
              const outcome = readLeadProductionAcceptanceOutcome(record?.metadata);
              const metadata = readLeadProductionAcceptanceMetadata(record?.metadata);
              return (
                <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-semibold text-white">{step.title}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(outcome)}`}>{statusLabel(outcome)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-500">Evidence required: {step.evidence}</p>
                      {record ? (
                        <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 p-3 text-sm">
                          <p className="text-gray-300">{record.reason}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })} · {record.actorRole || "System"}
                          </p>
                          {(metadata.statusBaselineCommit || metadata.expectedCommit) && <p className="mt-1 break-all text-xs text-gray-600">Commit evidence: {metadata.statusBaselineCommit || metadata.expectedCommit}</p>}
                        </div>
                      ) : (
                        <p className="mt-3 rounded-xl border border-amber-800 bg-ink-950 p-3 text-sm text-amber-200">No acceptance evidence recorded yet.</p>
                      )}
                    </div>
                    {step.href && (
                      <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>
                        {step.action || "Open"}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className={`mt-2 text-4xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-2 text-sm text-gray-500">{detail}</p>
    </div>
  );
}
