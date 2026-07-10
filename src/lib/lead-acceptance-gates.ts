import { getLeadAcceptanceHandoffPacket, leadAcceptanceClosedGates } from "@/lib/lead-acceptance-handoff";

export const LEAD_ACCEPTANCE_GATES_VERSION = "2026-07-10-pr72";

const CLOSED_GATE_REASONS: Record<string, string> = {
  "Live GHL workflow activation":
    "Live workflow activation remains outside acceptance tooling until Hamilton separately approves operational cutover.",
  "Additional live imports or exports":
    "Additional live import/export actions remain closed so acceptance work cannot change production lead inventory or external systems.",
  "Servicing module expansion":
    "Servicing changes remain closed because acceptance evidence is limited to read-only Lead flow review surfaces.",
  "Commission or payout activation":
    "Commission and payout activation remains closed because compensation workflows require separate owner approval.",
  "Finance or client-onboarding activation":
    "Finance and client-onboarding activation remains closed because those lanes are outside the current Lead acceptance scope.",
  "Production data changes outside controlled-test actions":
    "Production data changes remain closed unless they are already part of the controlled-test acceptance workflow and explicitly authorized.",
};

function gateId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function getLeadAcceptanceClosedGates() {
  const packet = await getLeadAcceptanceHandoffPacket();
  const gates = leadAcceptanceClosedGates.map((label, index) => ({
    id: gateId(label),
    sequence: index + 1,
    label,
    status: "CLOSED" as const,
    authorizationRequired: "Hamilton approval outside this read-only acceptance tooling lane.",
    reason: CLOSED_GATE_REASONS[label] ?? "This operational gate remains closed unless Hamilton separately approves opening it.",
    handoffHref: "/admin/leads/acceptance-handoff",
    evidenceMatrixHref: "/admin/leads/acceptance-matrix",
  }));

  return {
    ok: true,
    version: LEAD_ACCEPTANCE_GATES_VERSION,
    phase: packet.phase,
    latestProductionCommit: packet.latestProductionCommit,
    statusBaselineCommit: packet.statusBaselineCommit,
    evidence: {
      totalSteps: packet.evidence.totalSteps,
      passed: packet.evidence.passed,
      open: packet.evidence.failed + packet.evidence.deferred + packet.evidence.missing,
      failed: packet.evidence.failed,
      deferred: packet.evidence.deferred,
      missing: packet.evidence.missing,
      fullyPassed: packet.evidence.fullyPassed,
      readyForOwnerDecision: packet.evidence.readyForOwnerDecision,
    },
    counts: {
      total: gates.length,
      closed: gates.length,
      open: 0,
    },
    gates,
    safetyBoundary:
      "Read-only closed acceptance gates only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
  };
}
