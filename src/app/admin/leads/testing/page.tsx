import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";
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

function statusClass(outcome: LeadProductionAcceptanceOutcome | null) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 text-amber-200";
  return "border-ink-700 text-gray-400";
}

function statusLabel(outcome: LeadProductionAcceptanceOutcome | null) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Not recorded";
}

export default async function LeadAcceptanceTestingPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({
    where: { actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION, entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const latestByStep = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  }
  const completed = leadProductionAcceptanceSteps.map((step) => ({ step, record: latestByStep.get(step.id) ?? null }));
  const passCount = completed.filter(({ record }) => readLeadProductionAcceptanceOutcome(record?.metadata) === "PASS").length;
  const failCount = completed.filter(({ record }) => readLeadProductionAcceptanceOutcome(record?.metadata) === "FAIL").length;
  const deferredCount = completed.filter(({ record }) => readLeadProductionAcceptanceOutcome(record?.metadata) === "DEFERRED").length;
  const unresolvedCount = leadProductionAcceptanceSteps.length - passCount;

  async function recordAcceptance(formData: FormData) {
    "use server";
    const reviewer = await requireRole(ADMIN_ROLES);
    const stepId = String(formData.get("stepId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const step = leadProductionAcceptanceSteps.find((item) => item.id === stepId);
    if (!step) throw new Error("Invalid production acceptance step.");
    if (outcome !== "PASS" && outcome !== "FAIL" && outcome !== "DEFERRED") throw new Error("Choose Pass, Fail, or Deferred.");
    if (note.length < 12) throw new Error("Add a clear test or remediation note.");
    await db.auditLog.create({
      data: {
        actorUserId: reviewer.id,
        actorRole: reviewer.role,
        actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION,
        entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
        entityId: step.id,
        reason: note,
        metadata: { module: "LEADS", phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE, statusBaselineCommit: LEAD_STATUS_BASELINE_COMMIT, outcome, stepId: step.id, stepTitle: step.title },
      },
    });
    revalidatePath("/admin/leads/testing");
    revalidatePath("/admin/leads/acceptance-command-center");
    revalidatePath("/admin/leads/acceptance-report");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Production Lead Flow acceptance</h1>
          <p className="mt-2 max-w-3xl text-gray-400">
            Controlled production acceptance for the deployed Lead Flow scope on the custom domain. Each result writes a new immutable production-acceptance audit event.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/status">
            Status endpoint
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-command-center">
            Command center
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-report">
            Acceptance report
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook">
            Acceptance runbook
          </Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/controlled-test-data">
            Controlled test data
          </Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/api/admin/leads/acceptance-report.csv">
            CSV export
          </Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">
            Readiness board
          </Link>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Lead feature gate</p>
          <p className={features.leads ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>
            {features.leads ? "Controlled production use enabled" : "Staged / locked"}
          </p>
          <p className="mt-2 text-sm text-gray-400">This board records acceptance only. It does not change feature flags.</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Deployment status baseline</p>
          <p className="mt-2 break-all text-sm font-semibold text-white">{LEAD_STATUS_BASELINE_COMMIT}</p>
          <p className="mt-2 text-sm text-gray-400">/api/status on the custom domain must report production/main. The current commit may be newer than this baseline.</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Production acceptance progress</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {passCount} of {leadProductionAcceptanceSteps.length} passed
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {unresolvedCount === 0 ? "All steps are marked pass. Owner decision is still required before expanding normal use." : `${unresolvedCount} step${unresolvedCount === 1 ? " remains" : "s remain"} without a passing result.`}
          </p>
          {(failCount > 0 || deferredCount > 0) && <p className="mt-2 text-xs text-gray-500">{failCount} failed · {deferredCount} deferred</p>}
        </div>
      </section>

      <section className="mt-8 space-y-8">
        {leadProductionAcceptanceGroups.map((group) => (
          <div className="space-y-4" key={group.title}>
            <div><h2 className="text-xl font-semibold text-white">{group.title}</h2><p className="mt-1 text-sm text-gray-400">{group.detail}</p></div>
            {group.steps.map((step) => {
              const record = latestByStep.get(step.id) ?? null;
              const outcome = readLeadProductionAcceptanceOutcome(record?.metadata);
              return (
                <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold text-white">{step.title}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(outcome)}`}>{statusLabel(outcome)}</span></div>
                      <p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-500">Evidence: {step.evidence}</p>
                      {record && <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm"><p className="text-gray-300">{record.reason}</p><p className="mt-2 text-xs text-gray-500">Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p></div>}
                    </div>
                    {step.href && <Link className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open"}</Link>}
                  </div>
                  <form action={recordAcceptance} className="mt-5 grid gap-3 border-t border-ink-700 pt-5">
                    <input name="stepId" type="hidden" value={step.id} />
                    <div className="flex flex-col gap-3 sm:flex-row"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 sm:w-44" name="outcome" defaultValue={outcome || ""} required><option value="" disabled>Record result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="DEFERRED">Deferred</option></select><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 sm:order-3" type="submit">Save audit result</button><textarea className="min-h-20 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={record?.reason || ""} placeholder="What you tested, evidence observed, and any remediation needed" required /></div>
                  </form>
                </article>
              );
            })}
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-900 bg-ink-900 p-6"><h2 className="font-semibold text-white">Exit criteria for the next merge section</h2><p className="mt-2 text-sm leading-6 text-gray-300">This board moves the scope from deployment smoke into authenticated production acceptance. Do not expand live Lead operations, activate external GHL workflows, or begin Servicing/Commissions/Finance until the owner decision step is recorded and the next scoped PR is opened.</p><p className="mt-3 text-xs text-gray-500">Recorded by current admin session: {actor.email}</p></section>
    </main>
  );
}
