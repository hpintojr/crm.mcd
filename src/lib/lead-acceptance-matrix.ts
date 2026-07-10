import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const LEAD_ACCEPTANCE_MATRIX_VERSION = "2026-07-10-pr71";

export async function getLeadAcceptanceEvidenceMatrix() {
  const packet = await getLeadAcceptanceHandoffPacket();
  const rows = packet.evidence.steps.map((step, index) => ({
    ...step,
    rowNumber: index + 1,
    recordHref: `/admin/leads/testing#${step.id}`,
    isGap: step.status !== "PASS",
  }));

  return {
    ok: true,
    version: LEAD_ACCEPTANCE_MATRIX_VERSION,
    phase: packet.phase,
    latestProductionCommit: packet.latestProductionCommit,
    statusBaselineCommit: packet.statusBaselineCommit,
    counts: {
      totalSteps: packet.evidence.totalSteps,
      passed: packet.evidence.passed,
      failed: packet.evidence.failed,
      deferred: packet.evidence.deferred,
      missing: packet.evidence.missing,
      open: rows.filter((row) => row.isGap).length,
    },
    readyForOwnerDecision: packet.evidence.readyForOwnerDecision,
    fullyPassed: packet.evidence.fullyPassed,
    nextOpenStep: rows.find((row) => row.isGap) ?? null,
    rows,
    safetyBoundary:
      "Read-only acceptance evidence matrix only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
  };
}
