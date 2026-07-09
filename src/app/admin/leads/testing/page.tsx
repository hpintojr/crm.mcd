import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

const ACCEPTANCE_ACTION = "LEAD_PRODUCTION_ACCEPTANCE_RECORDED";
const ACCEPTANCE_ENTITY = "LeadProductionAcceptanceStep";
const ACCEPTANCE_PHASE = "PRODUCTION_ACCEPTANCE_20260709";
const STATUS_BASELINE_COMMIT = "85241b306e9799983226450a6876e71e52665995";

type Outcome = "PASS" | "FAIL" | "DEFERRED";
type Step = {
  id: string;
  title: string;
  detail: string;
  evidence: string;
  href?: string;
  action?: string;
};
type StepGroup = { title: string; detail: string; steps: Step[] };

const stepGroups: StepGroup[] = [
  {
    title: "Release and domain readiness",
    detail: "Non-mutating production checks that prove the public hostname is on the deployment-status baseline or a newer main build and protected routes are healthy.",
    steps: [
      {
        id: "custom-domain-status-smoke",
        title: "1. Confirm custom-domain deployment status",
        detail:
          "Open /api/status on crm.mercurycalldesk.com and confirm production, branch main, and a commit at or newer than the deployment-status baseline. This proves the public hostname is not serving a stale pre-status deployment.",
        evidence: `Status baseline commit: ${STATUS_BASELINE_COMMIT}. Record the current response timestamp and current commit SHA from /api/status.`,
        href: "/api/status",
        action: "Open status",
      },
      {
        id: "protected-route-boundaries",
        title: "2. Confirm protected route boundaries",
        detail:
          "Check /portal/workspace, /portal/leads, and /admin/leads/testing from the custom domain. Unauthenticated access should resolve to the sign-in boundary or authenticated UI, not a 404 or 500.",
        evidence: "Record which routes were checked and whether each route returned sign-in/authenticated UI.",
        href: "/portal/workspace",
        action: "Open workspace",
      },
      {
        id: "cron-auth-boundary",
        title: "3. Confirm secured cron boundary",
        detail:
          "Open /api/cron/leads/aging without Authorization. It must return 401 Unauthorized. Do not run the cron with CRON_SECRET during this acceptance step.",
        evidence: "Expected unauthenticated response: HTTP 401 with {\"error\":\"Unauthorized.\"}.",
        href: "/api/cron/leads/aging",
        action: "Check cron",
      },
      {
        id: "runtime-error-log-check",
        title: "4. Confirm latest deployment runtime logs",
        detail:
          "Check Vercel runtime logs for the latest production deployment and confirm there are no error or fatal logs in the reviewed window.",
        evidence: "Record the deployment ID, time window, and whether error/fatal logs were found.",
      },
      {
        id: "corrected-batch-state",
        title: "5. Confirm corrected production Lead state",
        detail:
          "Confirm the first imported batch remains 50 COLD / AVAILABLE Leads, 0 OPEN / AVAILABLE claimable Leads, and correction audit evidence exists. This should be read-only verification.",
        evidence: "Record count evidence only. Do not move Leads or change production data for this step.",
        href: "/admin/leads",
        action: "Review Leads",
      },
    ],
  },
  {
    title: "Authenticated Lead Flow acceptance",
    detail: "Controlled test-agent checks for the PR #34 business rules now deployed on the production custom domain.",
    steps: [
      {
        id: "cold-lead-visibility",
        title: "6. Verify Cold Lead workspace visibility",
        detail:
          "A certified test agent should see unowned COLD / AVAILABLE records in /portal/leads. The workspace should present this as activity-first work, not an ownership queue.",
        evidence: "Record the test agent and the Lead state observed. Do not include sensitive contact payloads.",
        href: "/portal/leads",
        action: "Open Cold Leads",
      },
      {
        id: "click-to-call-logs-first",
        title: "7. Verify click-to-call logs activity first",
        detail:
          "Use the Cold Lead click-to-call button. Confirm it calls /api/portal/leads/call-start, writes CALL_INITIATED evidence, and only then opens the device dialer.",
        evidence: "Record the activity/audit evidence and confirm no ownership was created by call start.",
        href: "/portal/leads",
        action: "Test click-to-call",
      },
      {
        id: "click-to-call-blocks-on-error",
        title: "8. Verify dialer blocks if logging fails",
        detail:
          "Confirm the client has no fallback dial link after an API/logging failure. The dialer must not open when call activity cannot be logged first.",
        evidence: "Record the failure path reviewed or tested and the user-facing message observed.",
        href: "/portal/leads",
        action: "Review failure path",
      },
      {
        id: "no-answer-boundary",
        title: "9. Verify no-answer and voicemail stay unowned",
        detail:
          "Record No Answer and Voicemail outcomes on controlled Cold Leads. Confirm each Lead remains unowned and not claimable from that outcome alone.",
        evidence: "Record lifecycle/pool/owner claim state before and after the disposition.",
        href: "/portal/leads",
        action: "Record no-answer",
      },
      {
        id: "two-way-contact-claim-gate",
        title: "10. Verify two-way-contact claim gate",
        detail:
          "Record callback-requested, qualified, or follow-up on a controlled Cold Lead. Confirm twoWayContactAt is recorded, the Lead becomes claim eligible, and claim is still not automatic.",
        evidence: "Record twoWayContactAt, pool/lifecycle transition, and claim eligibility state.",
        href: "/portal/leads",
        action: "Test claim gate",
      },
      {
        id: "claim-responsibility-timer",
        title: "11. Verify claim starts 45-day timer",
        detail:
          "Claim an eligible Lead only after two-way contact. Confirm ownerAgentId, claimedAt, lifecycle CLAIMED, and openPoolReleaseAt about 45 days after claim are set with audit/activity evidence.",
        evidence: "Record claimedAt and openPoolReleaseAt. Do not expose contact details.",
        href: "/portal/leads",
        action: "Claim eligible Lead",
      },
      {
        id: "dnc-blackout",
        title: "12. Verify DNC absolute blackout",
        detail:
          "Apply DNC from unowned Cold Lead flow and owned Lead flow. Confirm callbacks cancel, the record is suppressed, and the Lead disappears from sales workflows.",
        evidence: "Record suppression, DNC, and callback cancellation evidence.",
        href: "/portal/leads",
        action: "Test DNC",
      },
      {
        id: "my-workspace-dashboard",
        title: "13. Verify My Workspace dashboard",
        detail:
          "Open /portal/workspace without leadId. Confirm it shows assigned records, callback queue, claim access, recent activity, DNC reminder, and claim-timer responsibility instead of returning not found.",
        evidence: "Record visible sections and confirm no selected Lead is required to load the dashboard.",
        href: "/portal/workspace",
        action: "Open My Workspace",
      },
    ],
  },
  {
    title: "Relay, timer, and owner decision gates",
    detail: "Checks that remain controlled and do not activate broader live workflows unless separately approved.",
    steps: [
      {
        id: "warm-reply-timer",
        title: "14. Verify Warm Reply Triage timer",
        detail:
          "Assign an eligible unowned warm reply. Confirm two-way contact is required, a callback is created, and openPoolReleaseAt starts at about 45 days after assignment.",
        evidence: "Record assignment, callback, and openPoolReleaseAt evidence.",
        href: "/admin/leads/replies",
        action: "Open warm replies",
      },
      {
        id: "ghl-appointment-hardening",
        title: "15. Verify GHL appointment hardening",
        detail:
          "Use controlled test events only. Confirm suppressed/DNC Leads are ignored, booked/confirmed/rescheduled events record two-way contact, cancelled/no-show events create or expedite one callback, and Closed Won is preserved.",
        evidence: "Record webhook outcome fields and audit evidence. Do not enable live workflow automation from this board.",
        href: "/admin/integrations",
        action: "Open integrations",
      },
      {
        id: "ghl-opportunity-hardening",
        title: "16. Verify GHL opportunity hardening",
        detail:
          "Use controlled Won/Lost events only. Confirm terminal outcomes cancel scheduled callbacks, suppressed/DNC Leads are ignored, and late Lost cannot roll back Closed Won.",
        evidence: "Record webhook outcome fields and callback cancellation/preservation evidence.",
        href: "/admin/integrations",
        action: "Open integrations",
      },
      {
        id: "aging-sweep-contract",
        title: "17. Verify aging sweep contract",
        detail:
          "Verify the secured route requires Authorization, then use controlled test data only to confirm expired owned Leads return to Open Pool and 21-day stale Open Pool records move to Shark Tank with audit evidence.",
        evidence: "Record test data identifiers and audit evidence. Do not run the live cron against uncontrolled records.",
        href: "/api/cron/leads/aging",
        action: "Check cron route",
      },
      {
        id: "owner-production-decision",
        title: "18. Record owner production decision",
        detail:
          "Record the owner decision for normal Lead Flow use after production acceptance. This does not activate GHL workflows, Servicing, Commissions, Finance, or additional imports.",
        evidence: "Record approved use boundary, remaining gates, and the next merge section.",
        href: "/admin/audit",
        action: "Open audit history",
      },
    ],
  },
];

const steps = stepGroups.flatMap((group) => group.steps);

function outcomeFromMetadata(metadata: unknown): Outcome | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const outcome = (metadata as { outcome?: unknown }).outcome;
  return outcome === "PASS" || outcome === "FAIL" || outcome === "DEFERRED" ? outcome : null;
}

function statusClass(outcome: Outcome | null) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 text-amber-200";
  return "border-ink-700 text-gray-400";
}

function statusLabel(outcome: Outcome | null) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Not recorded";
}

export default async function LeadAcceptanceTestingPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({
    where: { actionType: ACCEPTANCE_ACTION, entityType: ACCEPTANCE_ENTITY },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const latestByStep = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  }
  const completed = steps.map((step) => ({ step, record: latestByStep.get(step.id) ?? null }));
  const passCount = completed.filter(({ record }) => outcomeFromMetadata(record?.metadata) === "PASS").length;
  const failCount = completed.filter(({ record }) => outcomeFromMetadata(record?.metadata) === "FAIL").length;
  const deferredCount = completed.filter(({ record }) => outcomeFromMetadata(record?.metadata) === "DEFERRED").length;
  const unresolvedCount = steps.length - passCount;

  async function recordAcceptance(formData: FormData) {
    "use server";
    const reviewer = await requireRole(ADMIN_ROLES);
    const stepId = String(formData.get("stepId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const step = steps.find((item) => item.id === stepId);
    if (!step) throw new Error("Invalid production acceptance step.");
    if (outcome !== "PASS" && outcome !== "FAIL" && outcome !== "DEFERRED") throw new Error("Choose Pass, Fail, or Deferred.");
    if (note.length < 12) throw new Error("Add a clear test or remediation note.");
    await db.auditLog.create({
      data: {
        actorUserId: reviewer.id,
        actorRole: reviewer.role,
        actionType: ACCEPTANCE_ACTION,
        entityType: ACCEPTANCE_ENTITY,
        entityId: step.id,
        reason: note,
        metadata: {
          module: "LEADS",
          phase: ACCEPTANCE_PHASE,
          statusBaselineCommit: STATUS_BASELINE_COMMIT,
          outcome,
          stepId: step.id,
          stepTitle: step.title,
        },
      },
    });
    revalidatePath("/admin/leads/testing");
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
          <p className="mt-2 break-all text-sm font-semibold text-white">{STATUS_BASELINE_COMMIT}</p>
          <p className="mt-2 text-sm text-gray-400">/api/status on the custom domain must report production/main. The current commit may be newer than this baseline.</p>
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5">
          <p className="text-sm text-gray-400">Production acceptance progress</p>
          <p className="mt-2 text-xl font-semibold text-white">
            {passCount} of {steps.length} passed
          </p>
          <p className="mt-2 text-sm text-gray-400">
            {unresolvedCount === 0
              ? "All steps are marked pass. Owner decision is still required before expanding normal use."
              : `${unresolvedCount} step${unresolvedCount === 1 ? " remains" : "s remain"} without a passing result.`}
          </p>
          {(failCount > 0 || deferredCount > 0) && (
            <p className="mt-2 text-xs text-gray-500">
              {failCount} failed · {deferredCount} deferred
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 space-y-8">
        {stepGroups.map((group) => (
          <div className="space-y-4" key={group.title}>
            <div>
              <h2 className="text-xl font-semibold text-white">{group.title}</h2>
              <p className="mt-1 text-sm text-gray-400">{group.detail}</p>
            </div>
            {group.steps.map((step) => {
              const record = latestByStep.get(step.id) ?? null;
              const outcome = outcomeFromMetadata(record?.metadata);
              return (
                <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}>
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-semibold text-white">{step.title}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(outcome)}`}>
                          {statusLabel(outcome)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>
                      <p className="mt-2 text-xs leading-5 text-gray-500">Evidence: {step.evidence}</p>
                      {record && (
                        <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm">
                          <p className="text-gray-300">{record.reason}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}
                          </p>
                        </div>
                      )}
                    </div>
                    {step.href && (
                      <Link className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>
                        {step.action || "Open"}
                      </Link>
                    )}
                  </div>
                  <form action={recordAcceptance} className="mt-5 grid gap-3 border-t border-ink-700 pt-5">
                    <input name="stepId" type="hidden" value={step.id} />
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 sm:w-44" name="outcome" defaultValue={outcome || ""} required>
                        <option value="" disabled>
                          Record result
                        </option>
                        <option value="PASS">Pass</option>
                        <option value="FAIL">Fail</option>
                        <option value="DEFERRED">Deferred</option>
                      </select>
                      <button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 sm:order-3" type="submit">
                        Save audit result
                      </button>
                      <textarea
                        className="min-h-20 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100"
                        name="note"
                        defaultValue={record?.reason || ""}
                        placeholder="What you tested, evidence observed, and any remediation needed"
                        required
                      />
                    </div>
                  </form>
                </article>
              );
            })}
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-900 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Exit criteria for the next merge section</h2>
        <p className="mt-2 text-sm leading-6 text-gray-300">
          This board moves the scope from deployment smoke into authenticated production acceptance. Do not expand live Lead operations, activate external GHL workflows, or begin Servicing/Commissions/Finance until the owner decision step is recorded and the next scoped PR is opened.
        </p>
        <p className="mt-3 text-xs text-gray-500">Recorded by current admin session: {actor.email}</p>
      </section>
    </main>
  );
}
