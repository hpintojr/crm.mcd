import "server-only";

import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { requireFeature } from "@/lib/features";
import { previewLeadImport, type LeadImportPreviewRow } from "@/lib/lead-import-preview";

export type LeadImportCommitResult = {
  inserted: number;
  duplicateInDatabase: number;
  suppressed: number;
  rejected: number;
  rows: LeadImportPreviewRow[];
};

export async function commitLeadImport(rows: unknown[]): Promise<LeadImportCommitResult> {
  requireFeature("leads");
  await requireRole(ADMIN_ROLES);
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Provide at least one import row.");
  if (rows.length > 500) throw new Error("Import batches are limited to 500 rows.");

  const preview = previewLeadImport(rows);
  const valid = preview.filter((item) => item.status === "VALID" && item.row && item.normalized);
  const dedupeKeys = valid.map((item) => item.normalized!.dedupeKey);
  const existingLeads = dedupeKeys.length
    ? await db.lead.findMany({ where: { dedupeKey: { in: dedupeKeys } }, select: { dedupeKey: true } })
    : [];
  const existingKeys = new Set(existingLeads.map((lead) => lead.dedupeKey).filter(Boolean));
  let duplicateInDatabase = 0;
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
    existingKeys.add(normalized.dedupeKey);
  }

  return { inserted: 0, duplicateInDatabase, suppressed: 0, rejected, rows: preview };
}
