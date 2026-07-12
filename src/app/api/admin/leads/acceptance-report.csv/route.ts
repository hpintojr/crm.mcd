import { NextRequest } from "next/server";
import { authenticatedCsvDownload, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { getAcceptanceEvidenceSummary } from "@/lib/acceptance-evidence-summary";
import {
  LEAD_PRODUCTION_ACCEPTANCE_ACTION,
  LEAD_PRODUCTION_ACCEPTANCE_ENTITY,
  LEAD_PRODUCTION_ACCEPTANCE_PHASE,
  LEAD_STATUS_BASELINE_COMMIT,
  leadProductionAcceptanceSteps,
  readLeadProductionAcceptanceMetadata,
  readLeadProductionAcceptanceOutcome,
} from "@/lib/lead-production-acceptance";

export const dynamic = "force-dynamic";

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const [records, controlledEvidence] = await Promise.all([
    db.auditLog.findMany({
      where: { actionType: LEAD_PRODUCTION_ACCEPTANCE_ACTION, entityType: LEAD_PRODUCTION_ACCEPTANCE_ENTITY },
      orderBy: { createdAt: "desc" },
      take: 1_000,
    }),
    getAcceptanceEvidenceSummary(),
  ]);
  const latest = new Map<string, (typeof records)[number]>();
  for (const record of records) {
    if (record.entityId && !latest.has(record.entityId)) latest.set(record.entityId, record);
  }
  const header = [
    "row_type",
    "phase",
    "status_baseline_commit",
    "step_id",
    "step_title",
    "outcome",
    "recorded_at",
    "recorded_by_role",
    "note",
    "evidence_required",
    "href",
    "action",
    "evidence_kind",
    "evidence_action_type",
    "evidence_entity_id",
  ];
  const stepRows = leadProductionAcceptanceSteps.map((step) => {
    const record = latest.get(step.id) ?? null;
    const metadata = readLeadProductionAcceptanceMetadata(record?.metadata);
    return [
      "ACCEPTANCE_STEP",
      metadata.phase || LEAD_PRODUCTION_ACCEPTANCE_PHASE,
      metadata.statusBaselineCommit || metadata.expectedCommit || LEAD_STATUS_BASELINE_COMMIT,
      step.id,
      step.title,
      readLeadProductionAcceptanceOutcome(record?.metadata) || "NOT_RECORDED",
      record?.createdAt.toISOString() || "",
      record?.actorRole || "",
      record?.reason || "",
      step.evidence,
      step.href || "",
      step.action || "",
      "",
      "",
      "",
    ];
  });
  const evidenceRows = controlledEvidence.recentEvidence.map((evidence) => [
    "CONTROLLED_EVIDENCE",
    controlledEvidence.phase,
    LEAD_STATUS_BASELINE_COMMIT,
    "",
    "",
    "RECORDED",
    evidence.createdAt,
    evidence.actorRole || "",
    evidence.reason || "",
    "Controlled test data or controlled GHL harness evidence.",
    evidence.kind === "controlled-data" ? controlledEvidence.links.controlledTestDataHref : controlledEvidence.links.controlledGhlHarnessHref,
    evidence.kind === "controlled-data" ? "Open controlled data" : "Open GHL harness",
    evidence.kind,
    evidence.actionType,
    evidence.entityId || "",
  ]);
  const summaryRows = [
    ["CONTROLLED_EVIDENCE_SUMMARY", controlledEvidence.phase, LEAD_STATUS_BASELINE_COMMIT, "", "Controlled Leads", controlledEvidence.counts.controlledLeadCount, "", "", `${controlledEvidence.counts.activeControlledLeadCount} active; ${controlledEvidence.counts.archivedControlledLeadCount} archived`, "", controlledEvidence.links.controlledTestDataHref, "Open controlled data", "controlled-data", "SUMMARY", ""],
    ["CONTROLLED_EVIDENCE_SUMMARY", controlledEvidence.phase, LEAD_STATUS_BASELINE_COMMIT, "", "Controlled GHL harness runs", controlledEvidence.counts.recentHarnessAppliedCount, "", "", "Recent controlled simulations", "", controlledEvidence.links.controlledGhlHarnessHref, "Open GHL harness", "controlled-ghl-harness", "SUMMARY", ""],
  ];
  const rows = [...stepRows, ...summaryRows, ...evidenceRows];
  await db.auditLog.create({
    data: {
      actorUserId: actor.id,
      actorRole: actor.role,
      actionType: "LEAD_PRODUCTION_ACCEPTANCE_EXPORT_CREATED",
      entityType: "LeadProductionAcceptanceReport",
      reason: "Lead production acceptance CSV export created with controlled evidence summary.",
      metadata: { rows: rows.length, phase: LEAD_PRODUCTION_ACCEPTANCE_PHASE, controlledEvidenceIncluded: true },
    },
  });
  const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  return authenticatedCsvDownload(
    csv,
    `mcd-lead-production-acceptance-${new Date().toISOString().slice(0, 10)}.csv`,
    requestId,
  );
}
