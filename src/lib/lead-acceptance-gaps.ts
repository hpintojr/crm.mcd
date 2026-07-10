import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const LEAD_ACCEPTANCE_GAPS_VERSION = "2026-07-10-pr70";

export async function getLeadAcceptanceEvidenceGaps() {
  const packet = await getLeadAcceptanceHandoffPacket();
  const gaps = packet.evidence.steps
    .filter((step) => step.status !== "PASS")
    .map((step, index) => ({
      ...step,
      priority: index + 1,
      recordHref: `/admin/leads/testing#${step.id}`,
    }));

  const missing = gaps.filter((step) => step.status === "MISSING").length;
  const failed = gaps.filter((step) => step.status === "FAIL").length;
  const deferred = gaps.filter((step) => step.status === "DEFERRED").length;

  return {
    ok: true,
    version: LEAD_ACCEPTANCE_GAPS_VERSION,
    phase: packet.phase,
    latestProductionCommit: packet.latestProductionCommit,
    statusBaselineCommit: packet.statusBaselineCommit,
    counts: {
      totalSteps: packet.evidence.totalSteps,
      passed: packet.evidence.passed,
      open: gaps.length,
      missing,
      failed,
      deferred,
    },
    nextGap: gaps[0] ?? null,
    gaps,
    allClear: gaps.length === 0,
    safetyBoundary:
      "Read-only acceptance evidence gaps only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
  };
}
