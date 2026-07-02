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
  const rejected = preview.filter((item) => item.status !== "VALID").length;
  return { inserted: 0, duplicateInDatabase: 0, suppressed: 0, rejected, rows: preview };
}
