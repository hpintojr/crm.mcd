import Link from "next/link";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { getLeadAcceptanceClosedGates } from "@/lib/lead-acceptance-gates";
import { getLeadAcceptanceDeferredRunbook } from "@/lib/lead-acceptance-deferred";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const dynamic = "force-dynamic";

type Status = "PASS" | "FAIL" | "DEFERRED" | "MISSING" | string;

function statusClass(status: Status) {
  if (status === "PASS") return "border-emerald-700 bg-emerald-950/20 text-emerald-200";
  if (status === "FAIL") return "border-red-700 bg-red-950/20 text-red-200";
  if (status === "DEFERRED") return "border-amber-700 bg-amber-950/20 text-amber-200";
  return "border-ink-700 bg-ink-950 text-gray-300";
}

function statusLabel(status: Status) {
  return status || "MISSING";
}

function pacific(iso: string | null) {
  if (!iso) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

export default async function OwnerDecisionPrepPage() {
  if (!features.leads) notFound();
  const actor = await requireRole(ADMIN_ROLES);
  const [packet, deferred, gates] = await Promise.all([
    getLeadAcceptanceHandoffPacket(),
    getLeadAcceptanceDeferredRunbook(),
    getLeadAcceptanceClosedGates(),
  ]);

  const ownerStep = packet.evidence.steps.find((step) => step.id === "owner-production-decision") ?? null;
  const nonOwnerBlockers = packet.evidence.steps.filter(
    (step) => step.id !== "owner-production-decision" && step.status !== "PASS",
  );
  const failedBlockers = nonOwnerBlockers.filter((step) => step.status === "FAIL");
  const missingBlockers = nonOwnerBlockers.filter((step) => step.status === "MISSING");
  const deferredBlockers = nonOwnerBlockers.filter((step) => step.status === "DEFERRED");
  const readyForHamiltonDecision = nonOwnerBlockers.length === 0 && ownerStep?.status !== "PASS";
  const ownerDecisionRecorded = ownerStep?.status === "PASS";
  const recommendation = ownerDecisionRecorded
    ? "Owner production decision has been recorded. Keep closed operational gates closed unless Hamilton separately approves opening them."
    : readyForHamiltonDecision
      ? "All non-owner acceptance evidence is pass-recorded. Hamilton can review this prep page, then record the owner decision from the acceptance board."
      : "Do not record the owner production decision yet. Clear the non-owner acceptance blockers listed below first.";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12" data-owner-decision-prep="lead-flow">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-brand-400">Mercury Call Desk</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Owner decision prep</h1>
          <p className="mt-2 max-w-4xl text-gray-400">
            Read-only Hamilton owner-decision prep for Lead production acceptance. This page summarizes non-owner evidence blockers, deferred steps, closed gates, and where Hamilton can record the final decision.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-overview">Overview</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-diff">Acceptance diff</Link>
          <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-runbook/deferred">Deferred steps</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/acceptance-gates">Closed gates</Link>
          <Link className="rounded-lg border border-ink-700 px-3 py-2 text-sm text-gray-200" href="/admin/leads/testing#owner-production-decision">Record on board</Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-5">
        <Metric label="Non-owner blockers" value={nonOwnerBlockers.length} detail="Must be zero" tone={nonOwnerBlockers.length ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Deferred blockers" value={deferredBlockers.length} detail="Steps not finished" tone={deferredBlockers.length ? "text-amber-200" : "text-emerald-200"} />
        <Metric label="Failed blockers" value={failedBlockers.length} detail="Must be zero" tone={failedBlockers.length ? "text-red-200" : "text-gray-200"} />
        <Metric label="Missing blockers" value={missingBlockers.length} detail="Need evidence" tone={missingBlockers.length ? "text-amber-200" : "text-gray-200"} />
        <Metric label="Closed gates" value={gates.counts.closed} detail={`${gates.counts.total} remain closed`} tone="text-amber-200" />
      </section>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold text-white">Decision recommendation</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-gray-300">{recommendation}</p>
            <p className="mt-3 break-all text-xs text-gray-500">Latest production commit: {packet.latestProductionCommit}</p>
            <p className="mt-1 break-all text-xs text-gray-500">Status baseline commit: {packet.statusBaselineCommit}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${ownerDecisionRecorded || readyForHamiltonDecision ? "border-emerald-700 bg-emerald-950/20 text-emerald-200" : "border-amber-700 bg-amber-950/20 text-amber-200"}`}>
            {ownerDecisionRecorded ? "RECORDED" : readyForHamiltonDecision ? "READY FOR HAMILTON" : "BLOCKED"}
          </span>
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Non-owner evidence blockers</h2>
              <p className="mt-2 text-sm text-gray-500">Hamilton-only owner decision should wait until this list is empty.</p>
            </div>
            <Link className="rounded-lg border border-brand-500 px-3 py-2 text-sm text-brand-200" href="/admin/leads/acceptance-gaps">Open gaps</Link>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-700 text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-gray-500">
                <tr><th className="py-3 pr-4">Step</th><th className="py-3 pr-4">Status</th><th className="py-3 pr-4">Recorded</th><th className="py-3 pr-4">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-800">
                {nonOwnerBlockers.length === 0 ? (
                  <tr><td className="py-4 text-emerald-200" colSpan={4}>All non-owner acceptance evidence is pass-recorded.</td></tr>
                ) : nonOwnerBlockers.map((step) => (
                  <tr data-owner-decision-blocker={step.id} key={step.id}>
                    <td className="py-4 pr-4"><p className="font-medium text-white">{step.title}</p><p className="mt-1 text-xs text-gray-500">{step.id}</p></td>
                    <td className="py-4 pr-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(step.status)}`}>{statusLabel(step.status)}</span></td>
                    <td className="py-4 pr-4 text-gray-300">{pacific(step.recordedAt)}</td>
                    <td className="py-4 pr-4"><div className="flex flex-wrap gap-2">{step.runbookHref && <Link className="rounded-lg border border-ink-700 px-2 py-1 text-xs text-gray-200" href={step.runbookHref}>Runbook</Link>}<Link className="rounded-lg border border-ink-700 px-2 py-1 text-xs text-gray-200" href={`/admin/leads/testing#${step.id}`}>Record</Link>{step.href && <Link className="rounded-lg border border-ink-700 px-2 py-1 text-xs text-gray-200" href={step.href}>Perform</Link>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Owner decision row</h2>
          <p className="mt-2 text-sm leading-6 text-gray-400">This page prepares the decision only. The actual owner production decision remains Hamilton-only and must be recorded from the acceptance board.</p>
          <div className="mt-5 rounded-xl border border-ink-700 bg-ink-950 p-4" data-owner-decision-row={ownerStep?.id ?? "owner-production-decision"}>
            <p className="text-sm font-medium text-white">{ownerStep?.title ?? "18. Record owner production decision"}</p>
            <p className="mt-2 text-xs text-gray-500">Status: <span className={`rounded-full border px-2 py-0.5 ${statusClass(ownerStep?.status ?? "MISSING")}`}>{statusLabel(ownerStep?.status ?? "MISSING")}</span></p>
            <p className="mt-2 text-xs text-gray-500">Recorded: {pacific(ownerStep?.recordedAt ?? null)}</p>
            {ownerStep?.note && <p className="mt-3 rounded-lg border border-ink-700 bg-ink-900 p-3 text-xs leading-5 text-gray-300">{ownerStep.note}</p>}
            <Link className="mt-4 inline-flex rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-ink-950" href="/admin/leads/testing#owner-production-decision">Open owner row</Link>
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Deferred acceptance steps</h2>
          <p className="mt-2 text-sm text-gray-500">Deferred configured steps: {deferred.counts.configured}. Current open deferred set: {deferred.counts.open}.</p>
          <div className="mt-5 grid gap-3">
            {deferred.steps.map((step) => (
              <Link className="rounded-xl border border-ink-700 bg-ink-950 p-4 transition hover:border-brand-600" data-owner-decision-deferred-step={step.id} href={step.recordHref} key={step.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{step.deferredIndex}. {step.title}</p>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(step.status)}`}>{statusLabel(step.status)}</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Record evidence on: {step.whereToRecord}</p>
              </Link>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-ink-700 bg-ink-900 p-6">
          <h2 className="font-semibold text-white">Gates that remain closed</h2>
          <p className="mt-2 text-sm text-gray-500">These gates do not open from the owner-decision prep page.</p>
          <div className="mt-5 grid gap-3">
            {gates.gates.map((gate) => (
              <div className="rounded-xl border border-ink-700 bg-ink-950 p-4" data-owner-decision-closed-gate={gate.id} key={gate.id}>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium text-white">{gate.sequence}. {gate.label}</p><span className="rounded-full border border-amber-700 bg-amber-950/20 px-2.5 py-1 text-xs font-medium text-amber-200">{gate.status}</span></div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{gate.reason}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900 p-6">
        <h2 className="font-semibold text-white">Owner prep session</h2>
        <p className="mt-2 text-sm leading-6 text-gray-400">Viewed by {actor.email}. Phase: {packet.phase}. Read-only owner decision prep only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.</p>
      </section>
    </main>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: number; detail: string; tone: string }) {
  return <div className="rounded-2xl border border-ink-700 bg-ink-900 p-5"><p className="text-sm text-gray-400">{label}</p><p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p><p className="mt-2 text-sm text-gray-500">{detail}</p></div>;
}
