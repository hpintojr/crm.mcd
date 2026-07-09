import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
import { getAcceptanceEvidenceSummary } from "@/lib/acceptance-evidence-summary";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceGroups,
  leadProductionAcceptanceSteps,
  readLeadProductionAcceptanceOutcome,
  type LeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

type StepState = {
  id: string;
  title: string;
  groupTitle: string;
  outcome: LeadProductionAcceptanceOutcome | null;
  href: string | null;
  action: string | null;
  recordedAt: Date | null;
  note: string | null;
};

function statusClass(outcome: LeadProductionAcceptanceOutcome | null) {
  if (outcome === "PASS") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 bg-red-950/20 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 bg-amber-950/20 text-amber-200";
  return "border-ink-700 bg-ink-950 text-gray-400";
}

function statusLabel(outcome: LeadProductionAcceptanceOutcome | null) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Not recorded";
}

function pacific(value: Date | null) {
  return value ? value.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" }) : "—";
}

function firstActionableStep(steps: StepState[]) {
  return steps.find((step) => step.outcome !== "PASS") ?? steps[steps.length - 1] ?? null;
}

export default async function LeadAcceptanceCommandCenterPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
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

  const steps: StepState[] = leadProductionAcceptanceGroups.flatMap((group) =>
    group.steps.map((step) => {
      const record = latestByStep.get(step.id) ?? null;
      return {
        id: step.id,
        title: step.title,
        groupTitle: group.title,
        outcome: readLeadProductionAcceptanceOutcome(record?.metadata),
        href: step.href ?? null,
        action: step.action ?? null,
        recordedAt: record?.createdAt ?? null,
        note: record?.reason ?? null,
      };
    }),
  );

  const passed = steps.filter((step) => step.outcome === "PASS").length;
  const failed = steps.filter((step) => step.outcome === "FAIL").length;
  const deferred = steps.filter((step) => step.outcome === "DEFERRED").length;
  const missing = steps.filter((step) => !step.outcome).length;
  const ownerOutcome = steps.find((step) => step.id === "owner-production-decision")?.outcome ?? null;
  const readyForOwnerDecision = failed === 0 && deferred === 0 && missing === 1 && !ownerOutcome;
  const allPassed = passed === leadProductionAcceptanceSteps.length;
  const nextStep = firstActionableStep(steps);

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-acceptance-command-center="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Lead acceptance command center</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Guided production-acceptance cockpit for the deployed Lead Flow scope. This page is read-only: it does not mutate Leads, change feature flags, run GHL workflows, or activate broader live operations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/testing">Record evidence</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">Acceptance report</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/audit?action=acceptance">Audit timeline</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Passed" value={passed} detail={`${leadProductionAcceptanceSteps.length} total`} tone="text-emerald-200" />
        <Metric label="Failed" value={failed} detail="Must be zero" tone={failed ? "text-red-200" : "text-gray-200"} />
        <Metric label="Deferred" value={deferred} detail="Needs resolution" tone={deferred ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Missing" value={missing} detail="Unrecorded steps" tone={missing ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Controlled evidence" value={controlledEvidence.recentEvidence.length} detail="Recent data/harness proofs" tone="text-white" />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Next safe action</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              {allPassed
                ? "All acceptance steps are recorded as pass. Keep live GHL workflow activation, Servicing, Commissions, and Finance gated until separately approved."
                : readyForOwnerDecision
                  ? "All non-owner-decision steps are pass-ready. Record the owner production decision before broader Lead Flow use."
                  : nextStep
                    ? `Work next on: ${nextStep.title}`
                    : "No acceptance steps are configured."}
            </p>
            <p className="mt-2 break-all text-xs text-gray-500">Status baseline commit: {LEAD_STATUS_BASELINE_COMMIT}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {nextStep?.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={nextStep.href}>{nextStep.action || "Open next step"}</Link>}
            <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/status">Status endpoint</Link>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Acceptance assets</h2>
          <div className="mt-4 grid gap-3">
            <Asset href="/admin/leads/controlled-test-data" title="Controlled test data" detail={`${controlledEvidence.counts.controlledLeadCount} controlled Leads · ${controlledEvidence.counts.activeControlledLeadCount} active`} />
            <Asset href="/admin/integrations/test-events" title="Controlled GHL event harness" detail={`${controlledEvidence.counts.recentHarnessAppliedCount} recent applied simulations`} />
            <Asset href="/api/admin/leads/aging-preview" title="Aging dry-run preview" detail="Read-only dry-run endpoint; mutationPerformed:false must remain true for preview checks." />
            <Asset href="/portal/leads?mode=agent" title="Agent-friendly Lead workspace" detail="Large-target Lead workspace for authenticated agent acceptance testing." />
            <Asset href="/admin/audit?action=controlled" title="Audit command center" detail="Filtered timeline for controlled data and harness evidence." />
          </div>
        </article>

        <article className="rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
          <h2 className="font-semibold text-amber-100">Gates that remain closed</h2>
          <div className="mt-4 grid gap-3 text-sm text-amber-100/80">
            <Gate label="Live GHL workflow activation" />
            <Gate label="Additional live imports or exports" />
            <Gate label="Servicing module expansion" />
            <Gate label="Commission or payout activation" />
            <Gate label="Finance/client onboarding activation" />
            <Gate label="Production data changes outside controlled-test actions" />
          </div>
          <p className="mt-5 text-xs leading-5 text-amber-100/70">This command center is intentionally non-mutating. Use the acceptance board to record evidence after authenticated checks.</p>
        </article>
      </section>

      <section className="mt-8 space-y-6">
        {leadProductionAcceptanceGroups.map((group) => {
          const groupSteps = steps.filter((step) => step.groupTitle === group.title);
          const groupPass = groupSteps.filter((step) => step.outcome === "PASS").length;
          return (
            <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900" data-acceptance-group={group.title} key={group.title}>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 px-6 py-4">
                <div>
                  <h2 className="font-semibold text-white">{group.title}</h2>
                  <p className="mt-1 text-sm text-gray-400">{group.detail}</p>
                </div>
                <span className="rounded-full border border-ink-700 px-3 py-1 text-xs text-gray-300">{groupPass} / {groupSteps.length} pass</span>
              </div>
              <div className="divide-y divide-ink-700">
                {groupSteps.map((step) => (
                  <div className="grid gap-4 px-6 py-4 lg:grid-cols-[1fr_auto]" data-acceptance-step={step.id} key={step.id}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-white">{step.title}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(step.outcome)}`}>{statusLabel(step.outcome)}</span>
                      </div>
                      {step.note && <p className="mt-2 text-sm leading-6 text-gray-300">{step.note}</p>}
                      <p className="mt-2 text-xs text-gray-500">Recorded: {pacific(step.recordedAt)}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      {step.href && <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open"}</Link>}
                      <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href={`/admin/leads/testing#${step.id}`}>Record</Link>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Operator session</h2>
        <p className="mt-2 text-sm text-gray-400">Viewed by {actor.email}. Phase: {LEAD_PRODUCTION_ACCEPTANCE_PHASE}. This page uses existing AuditLog and controlled evidence only.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}

function Asset({ href, title, detail }: { href: string; title: string; detail: string }) {
  return <Link className="rounded-xl border border-ink-700 bg-ink-950 p-4 transition hover:border-brand-500" href={href}><span className="block font-medium text-white">{title}</span><span className="mt-1 block text-sm leading-6 text-gray-400">{detail}</span></Link>;
}

function Gate({ label }: { label: string }) {
  return <div className="rounded-xl border border-amber-900/70 bg-ink-950/60 px-3 py-2">{label}</div>;
}
