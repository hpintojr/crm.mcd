import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const LEAD_ACCEPTANCE_DEFERRED_VERSION = "2026-07-10-pr80";

export const DEFERRED_ACCEPTANCE_STEP_IDS = [
  "runtime-error-log-check",
  "click-to-call-blocks-on-error",
  "warm-reply-timer",
  "ghl-appointment-hardening",
  "ghl-opportunity-hardening",
] as const;

const deferredStepIdSet = new Set<string>(DEFERRED_ACCEPTANCE_STEP_IDS);

export async function getLeadAcceptanceDeferredRunbook() {
  const packet = await getLeadAcceptanceHandoffPacket();
  const steps = packet.evidence.steps
    .filter((step) => deferredStepIdSet.has(step.id))
    .map((step, index) => ({
      ...step,
      deferredIndex: index + 1,
      recordHref: `/admin/leads/testing#${step.id}`,
      whereToRecord: "Acceptance board",
    }));

  return {
    ok: true,
    version: LEAD_ACCEPTANCE_DEFERRED_VERSION,
    phase: packet.phase,
    latestProductionCommit: packet.latestProductionCommit,
    statusBaselineCommit: packet.statusBaselineCommit,
    counts: {
      configured: DEFERRED_ACCEPTANCE_STEP_IDS.length,
      currentDeferred: steps.filter((step) => step.status === "DEFERRED").length,
      passed: steps.filter((step) => step.status === "PASS").length,
      missing: steps.filter((step) => step.status === "MISSING").length,
      failed: steps.filter((step) => step.status === "FAIL").length,
      open: steps.filter((step) => step.status !== "PASS").length,
    },
    steps,
    allClear: steps.every((step) => step.status === "PASS"),
    safetyBoundary:
      "Read-only deferred acceptance runbook only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
  };
}
