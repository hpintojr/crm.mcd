import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

type Outcome = "PASS" | "FAIL" | "DEFERRED";
type Step = { id: string; title: string; detail: string; href?: string; action?: string };

const steps: Step[] = [
  { id: "schema-approval", title: "1. Confirm schema approval", detail: "Validate the isolated commission migration on the approved Neon safety branch before considering a production migration. Do not insert production-like data during this check.", href: "/admin/operating-status", action: "Review operating status" },
  { id: "gate-separation", title: "2. Confirm Commission gate and Finance separation", detail: "Open Commission only for a supervised test window. Keep Finance disabled. The Commission workspace must not initiate a transfer, collect a payment, or expose bank details.", href: "/admin/commissions", action: "Open commissions" },
  { id: "active-agent-eligibility", title: "3. Validate active agent eligibility", detail: "Use a test Client Account with an active servicing owner. Confirm eligibility requires the documented owner, an eligible profile, payment clearance, and no active hold.", href: "/admin/commissions", action: "Open eligibility review" },
  { id: "retirement-termination", title: "4. Validate retirement and termination policy", detail: "Confirm a retired test agent retains existing-client eligibility when policy conditions are met. Confirm a terminated agent cannot receive future eligibility entries.", href: "/admin/commissions", action: "Open agent profiles" },
  { id: "holds", title: "5. Validate holds", detail: "Create a controlled hold scenario for an uncleared payment, refund, chargeback, or manual review. Confirm the ledger item stays on hold and cannot advance through review.", href: "/admin/commissions", action: "Open ledger review" },
  { id: "clearance", title: "6. Validate clearance path", detail: "After documented payment clearance and hold removal, confirm the entry can be reviewed as eligible. A review result is not a payout authorization.", href: "/admin/commissions", action: "Open eligibility review" },
  { id: "audit-history", title: "7. Validate audit history", detail: "Confirm profile changes, eligibility reviews, hold activity, and clearance evidence appear in the audit trail with the responsible admin and reason.", href: "/admin/audit", action: "Open audit history" },
  { id: "no-money-movement", title: "8. Confirm no-money-movement boundary", detail: "Verify that no Commission test creates a payment-provider action, payment instruction, payout release, or Finance approval. Those remain separately gated.", href: "/admin/finance", action: "Open Finance readiness" },
];

function outcomeFromMetadata(metadata: unknown): Outcome | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const outcome = (metadata as { outcome?: unknown }).outcome;
  return outcome === "PASS" || outcome === "FAIL" || outcome === "DEFERRED" ? outcome : null;
}

function label(outcome: Outcome | null) {
  return outcome ? outcome[0] + outcome.slice(1).toLowerCase() : "Not recorded";
}

function badge(outcome: Outcome | null) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-700 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-700 text-amber-200";
  return "border-ink-700 text-gray-400";
}

export default async function CommissionAcceptanceTestingPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await db.auditLog.findMany({ where: { actionType: "COMMISSION_ACCEPTANCE_RECORDED", entityType: "CommissionAcceptanceStep" }, orderBy: { createdAt: "desc" }, take: 250 });
  const latest = new Map<string, typeof records[number]>();
  for (const record of records) if (record.entityId && !latest.has(record.entityId)) latest.set(record.entityId, record);
  const results = steps.map((step) => ({ step, record: latest.get(step.id) ?? null }));
  const passed = results.filter(({ record }) => outcomeFromMetadata(record?.metadata) === "PASS").length;

  async function recordOutcome(formData: FormData) {
    "use server";
    const reviewer = await requireRole(ADMIN_ROLES);
    const stepId = String(formData.get("stepId") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const step = steps.find((item) => item.id === stepId);
    if (!step) throw new Error("Invalid acceptance step.");
    if (outcome !== "PASS" && outcome !== "FAIL" && outcome !== "DEFERRED") throw new Error("Choose Pass, Fail, or Deferred.");
    if (note.length < 8) throw new Error("Add a clear test or remediation note.");
    await db.auditLog.create({ data: { actorUserId: reviewer.id, actorRole: reviewer.role, actionType: "COMMISSION_ACCEPTANCE_RECORDED", entityType: "CommissionAcceptanceStep", entityId: step.id, reason: note, metadata: { module: "COMMISSIONS", outcome, stepId: step.id, stepTitle: step.title } } });
    revalidatePath("/admin/commissions/testing");
    revalidatePath("/admin/readiness");
    revalidatePath("/admin/audit");
  }

  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p><h1 className="mt-2 text-3xl font-semibold text-white">Commission acceptance test</h1><p className="mt-2 max-w-3xl text-gray-400">A controlled eligibility-and-ledger test path. Every outcome is recorded in the audit trail; it never authorizes or executes a payout.</p></div><Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/readiness">Readiness board</Link></div><section className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Commission feature gate</p><p className={features.commissions ? "mt-2 text-xl font-semibold text-emerald-200" : "mt-2 text-xl font-semibold text-amber-200"}>{features.commissions ? "Controlled test enabled" : "Staged / locked"}</p><p className="mt-2 text-sm text-gray-400">Finance remains separately gated.</p></div><div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">Acceptance progress</p><p className="mt-2 text-xl font-semibold text-white">{passed} of {steps.length} passed</p><p className="mt-2 text-sm text-gray-400">{steps.length - passed === 0 ? "All controls are marked pass; owner review is still required." : `${steps.length - passed} step${steps.length - passed === 1 ? " remains" : "s remain"} without a passing result.`}</p></div></section><section className="mt-8 space-y-4">{results.map(({ step, record }) => { const outcome = outcomeFromMetadata(record?.metadata); return <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" key={step.id}><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold text-white">{step.title}</h2><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${badge(outcome)}`}>{label(outcome)}</span></div><p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>{record && <div className="mt-3 rounded-xl border border-ink-700 bg-ink-950 px-3 py-3 text-sm"><p className="text-gray-300">{record.reason}</p><p className="mt-2 text-xs text-gray-500">Recorded {record.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Los_Angeles" })}</p></div>}</div>{step.href && <Link className="shrink-0 rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={step.href}>{step.action || "Open"}</Link>}</div><form action={recordOutcome} className="mt-5 grid gap-3 border-t border-ink-700 pt-5"><input name="stepId" type="hidden" value={step.id} /><div className="flex flex-col gap-3 sm:flex-row"><select className="rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100 sm:w-44" name="outcome" defaultValue={outcome || ""} required><option value="" disabled>Record result</option><option value="PASS">Pass</option><option value="FAIL">Fail</option><option value="DEFERRED">Deferred</option></select><button className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200 sm:order-3" type="submit">Save audit result</button><textarea className="min-h-20 flex-1 rounded-lg border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-gray-100" name="note" defaultValue={record?.reason || ""} placeholder="What you tested, evidence observed, and any remediation needed" required /></div></form></article>; })}</section><section className="mt-8 rounded-2xl border border-emerald-900 bg-ink-900 p-6"><h2 className="font-semibold text-white">Exit criteria</h2><p className="mt-2 text-sm leading-6 text-gray-300">Proceed only after schema approval, eligibility policy, retirement and termination rules, payment clearance, holds, and audit evidence have passing results. An eligible ledger item remains review-only until the separately gated Finance phase is approved.</p><p className="mt-3 text-xs text-gray-500">Recorded by current admin session: {actor.email}</p></section></main>;
}
