import "server-only";

import { db } from "@/lib/db";
import {
  LEAD_CONTROLLED_TEST_ARCHIVED_ACTION,
  LEAD_CONTROLLED_TEST_CREATED_ACTION,
  controlledTestLeadWhere,
} from "@/lib/controlled-test-leads";
import {
  CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION,
  CONTROLLED_GHL_TEST_EVENT_PHASE,
} from "@/lib/controlled-ghl-test-events";

const CONTROLLED_DATA_ACTIONS = [LEAD_CONTROLLED_TEST_CREATED_ACTION, LEAD_CONTROLLED_TEST_ARCHIVED_ACTION] as const;

function metadataObject(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
}

function safeHarnessMetadata(metadata: unknown) {
  const source = metadataObject(metadata);
  return {
    phase: typeof source.phase === "string" ? source.phase : undefined,
    family: typeof source.family === "string" ? source.family : undefined,
    eventType: typeof source.eventType === "string" ? source.eventType : undefined,
    leadId: typeof source.leadId === "string" ? source.leadId : undefined,
    simulatedOnly: source.simulatedOnly === true,
    liveGhlWorkflowActivated: source.liveGhlWorkflowActivated === true,
    liveGhlExportSubmitted: source.liveGhlExportSubmitted === true,
  };
}

function safeControlledDataMetadata(metadata: unknown) {
  const source = metadataObject(metadata);
  return {
    source: typeof source.source === "string" ? source.source : undefined,
    campaignName: typeof source.campaignName === "string" ? source.campaignName : undefined,
    campaignExternalId: typeof source.campaignExternalId === "string" ? source.campaignExternalId : undefined,
    controlledTestLead: source.controlledTestLead === true,
    ghlExportBlockedByDefault: source.ghlExportBlockedByDefault === true,
  };
}

function auditEvidence(record: { id: string; actionType: string; entityId: string | null; reason: string | null; actorRole: string | null; createdAt: Date; metadata: unknown }, kind: "controlled-data" | "controlled-ghl-harness") {
  return {
    id: record.id,
    kind,
    actionType: record.actionType,
    entityId: record.entityId,
    reason: record.reason,
    actorRole: record.actorRole,
    createdAt: record.createdAt.toISOString(),
    metadata: kind === "controlled-ghl-harness" ? safeHarnessMetadata(record.metadata) : safeControlledDataMetadata(record.metadata),
  };
}

export async function getAcceptanceEvidenceSummary() {
  const [controlledLeadCount, activeControlledLeadCount, archivedControlledLeadCount, controlledDataAudits, harnessAudits] = await Promise.all([
    db.lead.count({ where: controlledTestLeadWhere }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: false, dnc: false } }),
    db.lead.count({ where: { ...controlledTestLeadWhere, suppressed: true } }),
    db.auditLog.findMany({ where: { actionType: { in: [...CONTROLLED_DATA_ACTIONS] } }, orderBy: { createdAt: "desc" }, take: 10 }),
    db.auditLog.findMany({ where: { actionType: CONTROLLED_GHL_TEST_EVENT_APPLIED_ACTION }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const controlledCreatedCount = controlledDataAudits.filter((record) => record.actionType === LEAD_CONTROLLED_TEST_CREATED_ACTION).length;
  const controlledArchivedAuditCount = controlledDataAudits.filter((record) => record.actionType === LEAD_CONTROLLED_TEST_ARCHIVED_ACTION).length;

  return {
    phase: CONTROLLED_GHL_TEST_EVENT_PHASE,
    counts: {
      controlledLeadCount,
      activeControlledLeadCount,
      archivedControlledLeadCount,
      recentControlledCreateAuditCount: controlledCreatedCount,
      recentControlledArchiveAuditCount: controlledArchivedAuditCount,
      recentHarnessAppliedCount: harnessAudits.length,
    },
    links: {
      controlledTestDataHref: "/admin/leads/controlled-test-data",
      controlledGhlHarnessHref: "/admin/integrations/test-events",
    },
    safety: {
      schemaMigrationRequired: false,
      liveGhlWorkflowActivated: false,
      liveGhlExportSubmitted: false,
      servicingCommissionsFinanceRemainGated: true,
    },
    recentEvidence: [
      ...controlledDataAudits.map((record) => auditEvidence(record, "controlled-data")),
      ...harnessAudits.map((record) => auditEvidence(record, "controlled-ghl-harness")),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20),
  };
}
