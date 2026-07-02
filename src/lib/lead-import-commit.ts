import "server-only";

import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { normalizeEmail, normalizePhone } from "@/lib/lead-normalization";
import { previewLeadImport, type LeadImportPreviewRow } from "@/lib/lead-import-preview";
import { defaultWebsiteOpportunityStatus, websiteStatusFromRecordedUrl } from "@/lib/lead-taxonomy";

export type LeadImportCommitResult = {
  inserted: number;
  duplicateInDatabase: number;
  suppressed: number;
  rejected: number;
  rows: LeadImportPreviewRow[];
};

export async function commitLeadImport(rows: unknown[]): Promise<LeadImportCommitResult> {
  requireFeature("leads");
  const actor = await requireRole(ADMIN_ROLES);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Provide at least one import row.");
  if (rows.length > 500) throw new Error("Import batches are limited to 500 rows.");

  const preview = previewLeadImport(rows);
  const valid = preview.filter((item) => item.status === "VALID" && item.row && item.normalized);
  const dedupeKeys = valid.map((item) => item.normalized!.dedupeKey);
  const identifiers = valid.flatMap((item) => [item.normalized!.phone, item.normalized!.email].filter((value): value is string => Boolean(value)));
  const [existingLeads, activeSuppressions] = await Promise.all([
    dedupeKeys.length ? db.lead.findMany({ where: { dedupeKey: { in: dedupeKeys } }, select: { dedupeKey: true } }) : [],
    identifiers.length ? db.leadSuppression.findMany({ where: { active: true, identifier: { in: identifiers } }, select: { identifier: true } }) : [],
  ]);
  const existingKeys = new Set(existingLeads.map((lead) => lead.dedupeKey).filter(Boolean));
  const suppressedIdentifiers = new Set(activeSuppressions.map((item) => item.identifier));
  const approved: typeof valid = [];
  let duplicateInDatabase = 0;
  let suppressed = 0;
  let rejected = preview.filter((item) => item.status !== "VALID").length;

  for (const item of valid) {
    const row = item.row!;
    const normalized = item.normalized!;
    if (!row.businessPhone || !normalized.phone) {
      item.status = "REJECTED";
      item.issues.push("A business phone is required for the current agent-call workflow.");
      rejected += 1;
      continue;
    }
    if (existingKeys.has(normalized.dedupeKey)) {
      item.status = "DUPLICATE_IN_BATCH";
      item.issues.push("A matching lead already exists in the Mini CRM.");
      duplicateInDatabase += 1;
      continue;
    }
    if ([normalized.phone, normalized.email].some((identifier) => identifier && suppressedIdentifiers.has(identifier))) {
      item.status = "REJECTED";
      item.issues.push("The contact matches an active suppression record and cannot be imported.");
      suppressed += 1;
      continue;
    }
    existingKeys.add(normalized.dedupeKey);
    approved.push(item);
  }

  await db.$transaction(async (tx) => {
    for (const item of approved) {
      const row = item.row!;
      const normalized = item.normalized!;
      const websiteStatus = websiteStatusFromRecordedUrl(row.website);
      const lead = await tx.lead.create({
        data: {
          company: row.company,
          contactFirstName: row.contactFirstName,
          contactLastName: row.contactLastName,
          email: normalizeEmail(row.email),
          businessPhone: row.businessPhone!,
          normalizedPhone: normalizePhone(row.businessPhone),
          website: row.website,
          industry: row.industry,
          city: row.city,
          state: row.state,
          country: row.country,
          timezone: row.timezone,
          source: row.originalSource,
          sourceReference: row.sourceRecordUrl,
          originalSource: row.originalSource,
          sourceDetail: row.sourceDetail,
          sourceRecordUrl: row.sourceRecordUrl,
          campaignName: row.campaignName,
          campaignExternalId: row.campaignExternalId,
          intakeMethod: row.intakeMethod,
          referrerName: row.referrerName,
          referrerType: row.referrerType,
          referrerLeadId: row.referrerLeadId,
          utmSource: row.utmSource,
          utmMedium: row.utmMedium,
          utmCampaign: row.utmCampaign,
          utmContent: row.utmContent,
          utmTerm: row.utmTerm,
          websiteStatus,
          websiteOpportunityStatus: defaultWebsiteOpportunityStatus(websiteStatus),
          dedupeKey: normalized.dedupeKey,
          lifecycle: "PENDING_REVIEW",
          pool: normalized.pool,
          isReferral: row.originalSource === "REFERRAL",
          referralSource: row.referrerName,
        },
      });
      await tx.leadActivity.create({ data: { leadId: lead.id, type: "LEAD_CREATED", metadata: { imported: true, originalSource: row.originalSource, intakeMethod: row.intakeMethod } } });
      await tx.auditLog.create({ data: { actorUserId: actor.id, actorRole: actor.role, actionType: "LEAD_IMPORTED_TO_REVIEW", entityType: "Lead", entityId: lead.id, metadata: { dedupeKey: normalized.dedupeKey, originalSource: row.originalSource } } });
    }
  });

  return { inserted: approved.length, duplicateInDatabase, suppressed, rejected, rows: preview };
}
