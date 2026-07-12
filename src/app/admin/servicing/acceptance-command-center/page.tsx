import Link from "next/link";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import {
  getServicingAcceptanceReadinessSnapshot,
  type ServicingReadinessDecision,
} from "@/lib/servicing-acceptance-readiness";

export const dynamic = "force-dynamic";

function decisionLabel(decision: ServicingReadinessDecision) {
  return decision.replaceAll("_", " ").toLowerCase().replace(/^./, (letter) => letter.toUpperCase());
}

function decisionClass(decision: ServicingReadinessDecision) {
  if (decision === "CONTROLLED_WINDOW_OPEN") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (decision === "OWNER_AUTHORIZATION_REQUIRED") return "border-amber-800 bg-amber-950/20 text-amber-200";
  return "border-red-800 bg-red-950/20 text-red-200";
}

function outcomeClass(outcome: string | null) {
  if (outcome === "PASS") return "border-emerald-700 text-emerald-200";
  if (outcome === "FAIL") return "border-red-800 text-red-200";
  if (outcome === "DEFERRED") return "border-amber-800 text-amber-200";
  return "border-ink-700 text-gray-400";
}

function pacific(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  });
}

export default async function ServicingAcceptanceCommandCenterPage() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getServicingAcceptanceReadinessSnapshot();
  const queues = snapshot.queues;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-servicing-acceptance-command-center="read-only">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Servicing acceptance command center</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only preflight for a future controlled Client Servicing test window. It combines schema,
            feature-gate separation, Lead Flow prerequisite evidence, acceptance history, and aggregate
            operational queues without opening or changing any account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/api/admin/servicing/acceptance-readiness">JSON API</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/project-readiness">Project readiness</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/servicing/testing">Acceptance board</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/operating-status">Operating status</Link>
        </div>
      </div>

      <section className={`mt-8 rounded-2xl border p-6 ${decisionClass(snapshot.decision)}`} data-servicing-readiness-decision={snapshot.decision}>
        <p className="text-xs font-medium uppercase tracking-widest opacity-75">Current decision</p>
        <h2 className="mt-2 text-2xl font-semibold">{decisionLabel(snapshot.decision)}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-6 opacity-90">
          {snapshot.decision === "OWNER_AUTHORIZATION_REQUIRED"
            ? "Technical prerequisites are ready, but the Servicing feature gate is still closed. Hamilton must explicitly authorize the controlled acceptance window before any Client Account or Service Case test activity begins."
            : snapshot.decision === "CONTROLLED_WINDOW_OPEN"
              ? "The technical preflight is ready and the Servicing gate is open. Use only controlled test records and keep Commission and Finance closed."
              : snapshot.decision === "BLOCKED_SCHEMA"
                ? "The Client/Service schema is incomplete. Stop before any Servicing test activity."
                : snapshot.decision === "BLOCKED_LEAD_ACCEPTANCE"
                  ? "Lead Flow acceptance is not complete. Servicing must remain downstream and closed."
                  : "Commission or Finance is enabled alongside Servicing. Stop and restore the required gate separation before testing."
          }
        </p>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {snapshot.checks.map((check) => (
          <article className="rounded-2xl border border-ink-700 bg-ink-900 p-5" data-servicing-readiness-check={check.id} key={check.id}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-medium text-white">{check.label}</h2>
              <span className={`rounded-full border px-2 py-1 text-xs ${check.passed ? "border-emerald-700 text-emerald-200" : "border-amber-800 text-amber-200"}`}>{check.passed ? "Ready" : "Open"}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-400">{check.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-servicing-gate-matrix="read-only">
          <h2 className="font-semibold text-white">Gate separation</h2>
          <p className="mt-2 text-sm text-gray-400">A controlled Servicing window must remain independent from Commission and Finance.</p>
          <div className="mt-5 space-y-3">
            <GateRow label="Lead Flow" enabled={snapshot.gates.leads} expected="Enabled / accepted" />
            <GateRow label="Client Servicing" enabled={snapshot.gates.servicing} expected="Closed until owner authorization" />
            <GateRow label="Commissions" enabled={snapshot.gates.commissions} expected="Closed" />
            <GateRow label="Finance" enabled={snapshot.gates.finance} expected="Closed" />
          </div>
          <div className="mt-6 rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm text-gray-300">
            <p className="font-medium text-white">Schema</p>
            <p className="mt-2">{snapshot.schema.presentTables.length} of {snapshot.schema.expectedTables.length} required tables present.</p>
            {snapshot.schema.missingTables.length > 0 && <p className="mt-2 text-red-200">Missing: {snapshot.schema.missingTables.join(", ")}</p>}
          </div>
        </article>

        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6" data-servicing-queue-summary="aggregate-only">
          <h2 className="font-semibold text-white">Aggregate test and operations queues</h2>
          <p className="mt-2 text-sm text-gray-400">Counts only. No client or Lead identities are exposed by this preflight.</p>
          {queues ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Onboarding candidates" value={queues.onboardingCandidates} detail="Verified Closed Won, unsuppressed, no Client Account" />
              <Metric label="Client Accounts" value={queues.clientAccounts} detail="All current service accounts" />
              <Metric label="Pending launch" value={queues.pendingLaunch} detail="Checklist incomplete" />
              <Metric label="Active accounts" value={queues.activeAccounts} detail="Normal servicing status" />
              <Metric label="Healthy and current" value={queues.healthyCurrentAccounts} detail="No cadence-driven case required" />
              <Metric label="Payment attention" value={queues.paymentAttentionAccounts} detail="Payment or health attention state" alert={queues.paymentAttentionAccounts > 0} />
              <Metric label="House / unassigned" value={queues.houseOrUnassignedAccounts} detail="Requires ownership review when testing" />
              <Metric label="Open cases" value={queues.openCases} detail="Open, in progress, or waiting" />
              <Metric label="Overdue cases" value={queues.overdueCases} detail="Open with past due time" alert={queues.overdueCases > 0} />
              <Metric label="Urgent / high cases" value={queues.urgentHighCases} detail="Priority queue" alert={queues.urgentHighCases > 0} />
              <Metric label="Service activities" value={queues.serviceActivities} detail="Documented activity history" />
              <Metric label="Assignment events" value={queues.assignmentEvents} detail="Ownership/House history" />
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-red-800 bg-red-950/20 p-4 text-sm text-red-200">Queue metrics are unavailable because the required Client/Service schema is incomplete.</p>
          )}
        </article>
      </section>

      <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700 bg-ink-900" data-servicing-acceptance-progress="read-only">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-700 px-6 py-5">
          <div>
            <h2 className="font-semibold text-white">Acceptance sequence</h2>
            <p className="mt-1 text-sm text-gray-400">Read-only view of the nine controlled steps and their latest recorded evidence.</p>
          </div>
          <div className="text-right text-sm text-gray-300">
            <p><span className="font-semibold text-white">{snapshot.servicingAcceptance.passed}</span> of {snapshot.servicingAcceptance.total} PASS</p>
            <p className="mt-1 text-xs text-gray-500">{snapshot.servicingAcceptance.failed} failed · {snapshot.servicingAcceptance.deferred} deferred · {snapshot.servicingAcceptance.missing} not recorded</p>
          </div>
        </div>
        <div className="divide-y divide-ink-700">
          {snapshot.servicingAcceptance.steps.map((step) => (
            <article className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_auto] lg:items-start" data-servicing-acceptance-step={step.id} key={step.id}>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-medium text-white">{step.title}</h3>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${outcomeClass(step.outcome)}`}>{step.outcome ?? "NOT RECORDED"}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-gray-300">{step.detail}</p>
                {step.note && <p className="mt-3 rounded-xl border border-ink-700 bg-ink-950 p-3 text-sm text-gray-300">{step.note}</p>}
                <p className="mt-2 text-xs text-gray-500">Latest evidence: {pacific(step.recordedAt)} PT</p>
              </div>
              <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href={`/admin/servicing/testing#${step.id}`}>Open board step</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/20 p-6">
        <h2 className="font-semibold text-amber-100">Owner authorization boundary</h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">{snapshot.safetyBoundary}</p>
        <p className="mt-3 text-sm text-amber-100/80">This page becoming technically ready is not approval to open the Servicing gate or use the two available Closed Won Leads. Hamilton must authorize that controlled window separately.</p>
        <p className="mt-3 text-xs text-amber-200/70">Viewed by {actor.email}. Snapshot {snapshot.version}; generated {pacific(snapshot.generatedAt)} PT.</p>
      </section>
    </main>
  );
}

function GateRow({ label, enabled, expected }: { label: string; enabled: boolean; expected: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-ink-700 bg-ink-950 px-4 py-3">
      <div><p className="text-sm font-medium text-white">{label}</p><p className="mt-1 text-xs text-gray-500">Expected: {expected}</p></div>
      <span className={`rounded-full border px-2.5 py-1 text-xs ${enabled ? "border-emerald-700 text-emerald-200" : "border-ink-700 text-gray-400"}`}>{enabled ? "Enabled" : "Closed"}</span>
    </div>
  );
}

function Metric({ label, value, detail, alert = false }: { label: string; value: number; detail: string; alert?: boolean }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-950 p-4">
      <p className="text-xs uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${alert ? "text-red-200" : "text-white"}`}>{value}</p>
      <p className="mt-2 text-xs leading-5 text-gray-500">{detail}</p>
    </div>
  );
}
