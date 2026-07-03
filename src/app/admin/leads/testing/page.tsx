import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Outcome = "PASS" | "FAIL" | "DEFERRED";
type Step = { id: string; title: string; detail: string; href?: string; action?: string };

const steps: Step[] = [
  { id: "controlled-test-setup", title: "1. Confirm controlled test setup", detail: "Use test agents and test records only. Use one active, documented certified agent and one non-certified test agent. Keep the Lead module gated until the owner intentionally opens a controlled test window.", href: "/admin/agents", action: "Review agent controls" },
  { id: "import-preview", title: "2. Preview controlled import samples", detail: "Use the controlled import templates. Preview must identify valid rows, invalid rows, duplicate-in-batch rows, and suppression matches before any commit.", href: "/admin/leads", action: "Open controlled import" },
  { id: "import-commit", title: "3. Commit approved test records", detail: "Committed rows must land in admin review only. Confirm they do not enter Open Pool automatically.", href: "/admin/leads", action: "Open review queue" },
  { id: "admin-review", title: "4. Validate review controls", detail: "Approve one test Lead to Cold or Hot, disqualify one with a reason, and suppress one with a compliance reason. Confirm audit history on each record.", href: "/admin/leads", action: "Review Leads" },
  { id: "claim-boundaries", title: "5. Validate claim boundaries", detail: "A certified test agent may claim one eligible Open Pool Lead. A non-certified agent and a second agent must not be able to claim or act on that Lead.", href: "/portal/leads", action: "Open agent Leads" },
  { id: "agent-work", title: "6. Validate agent work", detail: "Create a note, set an outcome, schedule a callback, and confirm the callback appears in Tasks. Verify the Lead is visible only to its owner.", href: "/portal/tasks", action: "Open Tasks" },
  { id: "contact-safety", title: "7. Validate contact-safety controls", detail: "Use a test Lead to submit DNC. Confirm scheduled callbacks cancel, the Lead is suppressed, and the record no longer appears in the agent workflow. Separately test Wrong Number or Out of Business.", href: "/portal/leads", action: "Open agent Leads" },
  { id: "open-pool-returns", title: "8. Validate documented Open Pool returns", detail: "A previously assigned non-referral Lead with two-way contact may return to Open Pool only with a reason. Confirm a new import cannot be placed in Open Pool directly.", href: "/admin/leads/release", action: "Open return controls" },
  { id: "ghl-attribution", title: "9. Validate GHL handoff, appointments, opportunity results, and inbound replies", detail: "Confirm handoff stores the GHL Contact ID. Test appointment Booked, Confirmed, Rescheduled, Cancelled, and No-show behavior. Test Opportunity Won to move a matched Lead to Closed Won, Opportunity Lost to move an open Lead to Closed Lost, a late Lost event that must not undo Closed Won, and a suppressed Lead that must not be changed. Then send one controlled Email or SMS reply to an owned test Lead and verify exactly one immediate callback appears in Tasks and Inbox; test an unassigned active Lead and verify it appears in Warm Reply Triage; resend the same event ID and verify no duplicate work; confirm a suppressed Lead remains unchanged.", href: "/admin/integrations/replies", action: "Open reply relay setup" },
  { id: "owner-decision", title: "10. Record owner decision", detail: "Do not enable normal agent Lead access until every required test passes and exceptions have an approved remediation plan.", href: "/admin/audit", action: "Open audit history" },
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
  const records = await db.auditLog.findMany({
    where: { actionType: "LEAD_ACCEPTANCE_RECORDED", entityType: "LeadAcceptanceStep" },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const latestByStep = new Map<string, typeof records[number]>();
  for (const record of records) {
    if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  }
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
    await db.auditLog.create({
      data: {
        actorUserId: reviewer.id,
        actorRole: reviewer.role,
        actionType: "LEAD_ACCEPTANCE_RECORDED",
        entityType: "LeadAcceptanceStep",
        entityId: step.id,
        reason: note,
        metadata: { module: "LEADS", outcome, stepId: step.id, stepTitle: step.title },
      },
    });
    revalidatePath("/admin/leads/testing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Lead MVP acceptance test</h1><p className="mt-2 max-w-3xl text-gray-400">A controlled, owner-approved test path for Leads. Each recorded result creates an immutable audit event; recording a pass never enables the module.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link></div><section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Lead feature gate</p><p className={features.leads ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>{features.leads ? "Controlled test enabled" : "Staged / locked"}</p><p className="mt-2 text-sm text-gray-400">Open the gate only for the short, supervised test window.</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Acceptance progress</p><p className="mt-2 text-xl font-semibold text-white">{passCount} of {steps.length} passed</p><p className="mt-2 text-sm text-gray-400">{unresolvedCount === 0 ? "All controls are marked pass. Owner review is still required before normal Lead access." : `${unresolvedCount} step${unresolvedCount === 1 ? " remains" : "s remain"} without a passing result.`}</p></div></section><section className="mt-8 space-y-4">{completed.map(({ step, record }) => { const outcome = outcomeFromMetadata(record?.metadata); return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-white">{step.title}</h2><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(outcome)}`}>{statusLabel(outcome)}</span></div><p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>{record && <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm"><p className="text-gray-300">{record.reason}</p><p className="mt-2 text-xs text-gray-500">Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p></div>}</div>{step.href && <Link className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open"}</Link>}</div><form action={recordAcceptance} className="mt-5 grid gap-3 border-t border-ink-700 pt-5"><input name="stepId" type="hidden" value={step.id} /><div className="flex flex-col gap-3 sm:flex-row"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 sm:w-44" name="outcome" defaultValue={outcome || ""} required><option value="" disabled>Record result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="DEFERRED">Deferred</option></select><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 sm:order-3" type="submit">Save audit result</button><textarea className="min-h-20 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={record?.reason || ""} placeholder="What you tested, evidence observed, and any remediation needed" required /></div></form></article>; })}</section><section className="mt-8 rounded-2xl border border-emerald-900 bg-ink-900 p-6"><h2 className="font-semibold text-white">Exit criteria</h2><p className="mt-2 text-sm leading-6 text-gray-300">Approve normal Lead use only after all required controls have a current Pass result, any exception has a documented remediation plan, and the owner makes a deliberate gate decision. Audit results do not switch feature flags automatically.</p><p className="mt-3 text-xs text-gray-500">Recorded by current admin session: {actor.email}</p></section></main>;
}
