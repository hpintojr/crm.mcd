import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Outcome = "PASS" | "FAIL" | "DEFERRED";
type Step = { id: string; title: string; detail: string; href?: string; action?: string };

const steps: Step[] = [
  { id: "controlled-test-setup", title: "1. Confirm controlled PR #34 test setup", detail: "Use internal test agents and test records only. Confirm one certified agent can work Leads and one non-certified agent remains blocked. PR #34 is ready for review but must not merge until this board records the current acceptance result and the owner makes a merge decision.", href: "/admin/agents", action: "Review agent controls" },
  { id: "production-correction-state", title: "2. Verify corrected production Lead state", detail: "Confirm the first imported batch remains 50 COLD / AVAILABLE Leads, 0 OPEN / AVAILABLE claimable Leads, and correction audit evidence exists. Do not move records back to Open Pool to make testing easier.", href: "/admin/leads", action: "Open Lead review" },
  { id: "cold-lead-visibility", title: "3. Verify Cold Lead workspace visibility", detail: "A certified test agent should see unowned COLD / AVAILABLE records in /portal/leads. The workspace should identify this as activity-first work, not an ownership queue.", href: "/portal/leads", action: "Open Cold Leads" },
  { id: "click-to-call-logs-first", title: "4. Verify click-to-call logs activity first", detail: "Use the Cold Lead click-to-call button. Confirm it calls /api/portal/leads/call-start, writes CALL_INITIATED activity/audit evidence, and only then opens the device dialer.", href: "/portal/leads", action: "Test click-to-call" },
  { id: "click-to-call-no-lock", title: "5. Verify click-to-call creates no ownership", detail: "After click-to-call, confirm ownerAgentId, claimedAt, openPoolReleaseAt, and any reservation/soft-lock behavior remain empty. Call start must be activity only.", href: "/portal/leads", action: "Inspect Lead" },
  { id: "click-to-call-blocks-on-error", title: "6. Verify dialer is blocked if logging fails", detail: "Confirm the client has no fallback dial link after an API/logging failure. The dialer must not open when call activity cannot be logged first.", href: "/portal/leads", action: "Review failure path" },
  { id: "no-answer-boundary", title: "7. Verify no-answer and voicemail stay unowned", detail: "Record No Answer and Voicemail outcomes on test Cold Leads. Confirm the Lead remains unowned and not claimable from that outcome alone.", href: "/portal/leads", action: "Record no-answer" },
  { id: "two-way-contact-claim-gate", title: "8. Verify two-way-contact claim gate", detail: "Record callback-requested, qualified, or follow-up on a Cold Lead. Confirm twoWayContactAt is recorded, the Lead becomes claim eligible, and claim is still not automatic.", href: "/portal/leads", action: "Test claim gate" },
  { id: "claim-responsibility-timer", title: "9. Verify claim starts 45-day timer", detail: "Claim an eligible Lead only after two-way contact. Confirm ownerAgentId, claimedAt, lifecycle CLAIMED, and openPoolReleaseAt about 45 days after claim are set with audit/activity evidence.", href: "/portal/leads", action: "Claim eligible Lead" },
  { id: "dnc-blackout", title: "10. Verify DNC absolute blackout", detail: "Apply DNC from unowned Cold Lead flow and owned Lead flow. Confirm callbacks cancel, the record is suppressed, and the Lead disappears from sales workflows.", href: "/portal/leads", action: "Test DNC" },
  { id: "my-workspace-dashboard", title: "11. Verify My Workspace dashboard", detail: "Open /portal/workspace without leadId. Confirm it shows assigned records, callback queue, claim access, recent activity, DNC rule reminder, and claim-timer responsibility instead of returning not found.", href: "/portal/workspace", action: "Open My Workspace" },
  { id: "warm-reply-timer", title: "12. Verify Warm Reply Triage timer", detail: "Assign an eligible unowned warm reply. Confirm two-way contact is required, a callback is created, and openPoolReleaseAt starts at about 45 days after assignment.", href: "/admin/leads/replies", action: "Open warm replies" },
  { id: "ghl-appointment-hardening", title: "13. Verify GHL appointment hardening", detail: "Use controlled test events to confirm suppressed/DNC Leads are ignored, booked/confirmed/rescheduled events record two-way contact, cancelled/no-show events create or expedite one callback, and Closed Won is preserved.", href: "/admin/integrations", action: "Open integrations" },
  { id: "ghl-opportunity-hardening", title: "14. Verify GHL opportunity hardening", detail: "Use controlled Won/Lost events to confirm terminal outcomes cancel scheduled callbacks, suppressed/DNC Leads are ignored, and late Lost cannot roll back Closed Won.", href: "/admin/integrations", action: "Open integrations" },
  { id: "aging-sweep-contract", title: "15. Verify aging sweep contract", detail: "Verify the secured aging route requires Authorization, then use controlled test data to confirm expired owned Leads return to Open Pool and 21-day stale Open Pool records move to Shark Tank with audit evidence.", href: "/api/cron/leads/aging", action: "Check cron route" },
  { id: "owner-decision", title: "16. Record owner decision", detail: "Do not merge PR #34 or approve normal Lead use until every required step has a current Pass result or an approved remediation plan. Audit results do not enable feature flags automatically.", href: "/admin/audit", action: "Open audit history" },
];

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
  const records = await db.auditLog.findMany({ where: { actionType: "LEAD_ACCEPTANCE_RECORDED", entityType: "LeadAcceptanceStep" }, orderBy: { createdAt: "desc" }, take: 400 });
  const latestByStep = new Map<string, typeof records[number]>();
  for (const record of records) if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  const completed = steps.map((step) => ({ step, record: latestByStep.get(step.id) ?? null }));
  const passCount = completed.filter(({ record }) => outcomeFromMetadata(record?.metadata) === "PASS").length;
  const unresolvedCount = steps.length - passCount;

  async function recordAcceptance(formData: FormData) {
    "use server";
    const reviewer = await requireRole(ADMIN_ROLES);
    const stepId = String(formData.get("stepId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const step = steps.find((item) => item.id === stepId);
    if (!step) throw new Error("Invalid acceptance step.");
    if (outcome !== "PASS" && outcome !== "FAIL" && outcome !== "DEFERRED") throw new Error("Choose Pass, Fail, or Deferred.");
    if (note.length < 8) throw new Error("Add a clear test or remediation note.");
    await db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "LEAD_ACCEPTANCE_RECORDED", entityType: "LeadAcceptanceStep", entityId: step.id, reason: note, metadata: { module: "LEADS", phase: "PR_34_LEAD_FLOW_ALIGNMENT", outcome, stepId: step.id, stepTitle: step.title } } });
    revalidatePath("/admin/leads/testing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Lead Flow Alignment acceptance test</h1><p className="mt-2 max-w-3xl text-gray-400">A controlled, owner-approved test path for PR #34. Each recorded result creates an immutable audit event; recording a pass never enables the module or merges the PR.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link></div><section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Lead feature gate</p><p className={features.leads ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>{features.leads ? "Controlled test enabled" : "Staged / locked"}</p><p className="mt-2 text-sm text-gray-400">Open the gate only for the short, supervised test window.</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">PR #34 acceptance progress</p><p className="mt-2 text-xl font-semibold text-white">{passCount} of {steps.length} passed</p><p className="mt-2 text-sm text-gray-400">{unresolvedCount === 0 ? "All controls are marked pass. Owner review is still required before merge or normal Lead access." : `${unresolvedCount} step${unresolvedCount === 1 ? " remains" : "s remain"} without a passing result.`}</p></div></section><section className="mt-8 space-y-4">{completed.map(({ step, record }) => { const outcome = outcomeFromMetadata(record?.metadata); return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-white">{step.title}</h2><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(outcome)}`}>{statusLabel(outcome)}</span></div><p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>{record && <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm"><p className="text-gray-300">{record.reason}</p><p className="mt-2 text-xs text-gray-500">Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p></div>}</div>{step.href && <Link className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open"}</Link>}</div><form action={recordAcceptance} className="mt-5 grid gap-3 border-t border-ink-700 pt-5"><input name="stepId" type="hidden" value={step.id} /><div className="flex flex-col gap-3 sm:flex-row"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 sm:w-44" name="outcome" defaultValue={outcome || ""} required><option value="" disabled>Record result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="DEFERRED">Deferred</option></select><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 sm:order-3" type="submit">Save audit result</button><textarea className="min-h-20 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={record?.reason || ""} placeholder="What you tested, evidence observed, and any remediation needed" required /></div></form></article>; })}</section><section className="mt-8 rounded-2xl border border-emerald-900 bg-ink-900 p-6"><h2 className="font-semibold text-white">Exit criteria</h2><p className="mt-2 text-sm leading-6 text-gray-300">Merge PR #34 only after all required controls have a current Pass result, any exception has a documented remediation plan, and the owner makes a deliberate merge/gate decision. Audit results do not switch feature flags automatically.</p><p className="mt-3 text-xs text-gray-500">Recorded by current admin session: {actor.email}</p></section></main>;
}
