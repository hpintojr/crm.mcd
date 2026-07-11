import { acceptanceRunbookHref } from "@/lib/acceptance-runbook-links";
import { db } from "@/lib/db";
import {
  leadAcceptanceFindingCounts,
  leadAcceptanceFindings,
} from "@/lib/lead-acceptance-findings";
import { getLeadDeploymentVerificationSnapshot } from "@/lib/lead-deployment-verification";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceSteps,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const LEAD_ACCEPTANCE_HANDOFF_PACKET_VERSION = "2026-07-11-pr97";

export const leadAcceptanceClosedGates = [
  "Live GHL workflow activation",
  "Additional live imports or exports",
  "Servicing module expansion",
  "Commission or payout activation",
  "Finance or client-onboarding activation",
  "Production data changes outside controlled-test actions",
];

export async function getLeadAcceptanceHandoffPacket() {
  const records = await db.auditLog.findMany({
    where: {
      actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION,
      entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
    },
    orderBy: { createdAt: "desc" },
    take: 1_000,
  });

  const latestByStep = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latestByStep.has(record.entityId)) latestByStep.set(record.entityId, record);
  }

  const steps = leadProductionAcceptanceSteps.map((step) => {
    const record = latestByStep.get(step.id) ?? null;
    const outcome = readLeadProductionAcceptanceOutcome(record?.metadata);
    return {
      id: step.id,
      title: step.title,
      outcome,
      status: outcome ?? "MISSING",
      href: step.href ?? null,
      action: step.action ?? null,
      runbookHref: acceptanceRunbookHref(step.id),
      recordedAt: record?.createdAt.toISOString() ?? null,
      note: record?.reason ?? null,
    };
  });

  const passed = steps.filter((step) => step.outcome === "PASS").length;
  const failed = steps.filter((step) => step.outcome === "FAIL").length;
  const deferred = steps.filter((step) => step.outcome === "DEFERRED").length;
  const missing = steps.filter((step) => !step.outcome).length;
  const ownerOutcome = steps.find((step) => step.id === "owner-production-decision")?.outcome ?? null;
  const readyForOwnerDecision = failed === 0 && deferred === 0 && missing === 1 && !ownerOutcome;
  const fullyPassed = passed === steps.length;
  const nextStep = steps.find((step) => step.outcome !== "PASS") ?? steps[steps.length - 1] ?? null;
  const findingCounts = leadAcceptanceFindingCounts();

  return {
    ok: true,
    packetVersion: LEAD_ACCEPTANCE_HANDOFF_PACKET_VERSION,
    phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE,
    latestProductionCommit: getLeadDeploymentVerificationSnapshot().commitSha,
    statusBaselineCommit: LEAD_STATUS_BASELINE_COMMIT,
    evidence: {
      totalSteps: steps.length,
      passed,
      failed,
      deferred,
      missing,
      readyForOwnerDecision,
      fullyPassed,
      nextStep,
      steps,
    },
    findings: {
      counts: findingCounts,
      openGateFindings: leadAcceptanceFindings.filter((finding) => finding.status === "OPEN_GATE"),
      guardedFindings: leadAcceptanceFindings.filter((finding) => finding.status === "GUARDED"),
    },
    latestRecords: records.slice(0, 5).map((record) => {
      const metadata = readLeadProductionAcceptanceMetadata(record.metadata);
      return {
        id: record.id,
        stepId: metadata.stepId || record.entityId,
        stepTitle: metadata.stepTitle || record.entityId || "Acceptance step",
        outcome: metadata.outcome || "UNKNOWN",
        recordedAt: record.createdAt.toISOString(),
        reviewer: record.actorRole || "System",
        note: record.reason || "No note recorded.",
        runbookHref: acceptanceRunbookHref(metadata.stepId || record.entityId || "unknown-step"),
      };
    }),
    remainingClosedGates: leadAcceptanceClosedGates,
    safetyBoundary:
      "Read-only acceptance handoff packet only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
  };
}
