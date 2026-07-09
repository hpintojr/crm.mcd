import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceGroups,
  leadProductionAcceptanceSteps,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

type AcceptanceRecord = Awaited<ReturnType<typeof getAcceptanceRecords>>[number];

async function getAcceptanceRecords() {
  return db.auditLog.findMany({
    where: { actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION, entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY },
    orderBy: { createdAt: "desc" },
    take: 1_000,
  });
}

function latestByStep(records: AcceptanceRecord[]) {
  const latest = new Map<string, AcceptanceRecord>();
  for (const record of records) {
    if (record.entityId && !latest.has(record.entityId)) latest.set(record.entityId, record);
  }
  return latest;
}

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const records = await getAcceptanceRecords();
  const latest = latestByStep(records);
  const steps = leadProductionAcceptanceSteps.map((step) => {
    const record = latest.get(step.id) ?? null;
    const metadata = readLeadProductionAcceptanceMetadata(record?.metadata);
    const outcome = readLeadProductionAcceptanceOutcome(record?.metadata);
    return {
      id: step.id,
      title: step.title,
      detail: step.detail,
      evidenceRequired: step.evidence,
      href: step.href ?? null,
      action: step.action ?? null,
      outcome,
      recordedAt: record?.createdAt.toISOString() ?? null,
      recordedByRole: record?.actorRole ?? null,
      note: record?.reason ?? null,
      metadata,
    };
  });
  const passCount = steps.filter((step) => step.outcome === "PASS").length;
  const failCount = steps.filter((step) => step.outcome === "FAIL").length;
  const deferredCount = steps.filter((step) => step.outcome === "DEFERRED").length;
  const notRecordedCount = steps.filter((step) => !step.outcome).length;
  const ownerDecision = steps.find((step) => step.id === "owner-production-decision")?.outcome ?? null;
  const readyForOwnerDecision = failCount === 0 && notRecordedCount === 1 && ownerDecision === null;
  const fullyPassed = passCount === steps.length;

  return NextResponse.json(
    {
      ok: true,
      reportType: "lead-production-acceptance",
      phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE,
      statusBaselineCommit: LEAD_STATUS_BASELINE_COMMIT,
      generatedAt: new Date().toISOString(),
      generatedByRole: actor.role,
      summary: {
        totalSteps: steps.length,
        passCount,
        failCount,
        deferredCount,
        notRecordedCount,
        ownerDecision,
        readyForOwnerDecision,
        fullyPassed,
      },
      groups: leadProductionAcceptanceGroups.map((group) => ({
        title: group.title,
        detail: group.detail,
        totalSteps: group.steps.length,
        passCount: group.steps.filter((step) => latest.get(step.id) && readLeadProductionAcceptanceOutcome(latest.get(step.id)?.metadata) === "PASS").length,
        failCount: group.steps.filter((step) => latest.get(step.id) && readLeadProductionAcceptanceOutcome(latest.get(step.id)?.metadata) === "FAIL").length,
        deferredCount: group.steps.filter((step) => latest.get(step.id) && readLeadProductionAcceptanceOutcome(latest.get(step.id)?.metadata) === "DEFERRED").length,
        notRecordedCount: group.steps.filter((step) => !latest.get(step.id)).length,
        stepIds: group.steps.map((step) => step.id),
      })),
      steps,
      gates: {
        doesNotEnableFeatureFlags: true,
        doesNotActivateGhlWorkflows: true,
        doesNotMutateProductionData: true,
        servicingCommissionsFinanceRemainGated: true,
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
