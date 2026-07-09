import "server-only";

import type { Lead, Prisma } from "@prisma/client";

export const CONTROLLED_TEST_LEAD_SOURCE = "MCD_CONTROLLED_TEST_DATA";
export const CONTROLLED_TEST_LEAD_CAMPAIGN = "MCD Controlled Test Data";
export const CONTROLLED_TEST_LEAD_SOURCE_REFERENCE_PREFIX = "mcd-controlled-test:";
export const CONTROLLED_TEST_GHL_EXPORT_BLOCK = "MCD_CONTROLLED_TEST_NO_GHL_EXPORT";
export const CONTROLLED_TEST_GHL_EXPORT_BLOCK_REASON = "Controlled test Lead; GHL export blocked by default until a controlled harness explicitly allows it.";

export const LEAD_CONTROLLED_TEST_CREATED_ACTION = "LEAD_CONTROLLED_TEST_CREATED";
export const LEAD_CONTROLLED_TEST_ARCHIVED_ACTION = "LEAD_CONTROLLED_TEST_ARCHIVED";
export const LEAD_CONTROLLED_TEST_ENTITY = "Lead";

export const controlledTestLeadWhere: Prisma.LeadWhereInput = {
  source: CONTROLLED_TEST_LEAD_SOURCE,
};

export type ControlledTestLeadMarker = Pick<
  Lead,
  "source" | "sourceReference" | "campaignName" | "campaignExternalId" | "sourceDetail"
>;

export function createControlledTestLeadReference(now = new Date(), randomPart = Math.random().toString(36).slice(2, 8)) {
  const stamp = now.toISOString().replace(/\D/g, "").slice(0, 14);
  return `${CONTROLLED_TEST_LEAD_SOURCE_REFERENCE_PREFIX}${stamp}-${randomPart}`;
}

export function controlledTestDedupeKey(sourceReference: string) {
  return sourceReference;
}

export function buildControlledTestPhone(sourceReference: string) {
  const digitsOnly = sourceReference.replace(/\D/g, "");
  const lastFour = digitsOnly.slice(-4).padStart(4, "0");
  return {
    businessPhone: `555-010-${lastFour}`,
    normalizedPhone: `+1555010${lastFour}`,
  };
}

export function isControlledTestLead(lead: ControlledTestLeadMarker | null | undefined): lead is ControlledTestLeadMarker {
  if (!lead) return false;
  return (
    lead.source === CONTROLLED_TEST_LEAD_SOURCE ||
    lead.sourceReference?.startsWith(CONTROLLED_TEST_LEAD_SOURCE_REFERENCE_PREFIX) === true ||
    lead.campaignName === CONTROLLED_TEST_LEAD_CAMPAIGN ||
    lead.campaignExternalId === CONTROLLED_TEST_GHL_EXPORT_BLOCK ||
    lead.sourceDetail?.includes(CONTROLLED_TEST_GHL_EXPORT_BLOCK_REASON) === true
  );
}

export function controlledTestLeadSafetyMetadata(extra: Record<string, unknown> = {}) {
  return {
    controlledTestLead: true,
    ghlExportBlockedByDefault: true,
    source: CONTROLLED_TEST_LEAD_SOURCE,
    campaignName: CONTROLLED_TEST_LEAD_CAMPAIGN,
    campaignExternalId: CONTROLLED_TEST_GHL_EXPORT_BLOCK,
    safetyBoundary: "No live customer/prospect record and no live GHL export.",
    ...extra,
  };
}
