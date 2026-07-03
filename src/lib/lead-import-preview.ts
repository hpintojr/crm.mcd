import "server-only";

import { ZodError } from "zod";
import { assertLeadImportIntakeAllowed } from "@/lib/lead-import-intake-policy";
import { assertLeadImportAllowed, defaultPoolForSource, leadImportRowSchema, type LeadImportRow, websiteStatusFromRecordedUrl } from "@/lib/lead-taxonomy";
import { buildLeadDedupeKey, normalizeEmail, normalizePhone, normalizeWebsiteDomain } from "@/lib/lead-normalization";

export type LeadImportPreviewStatus = "VALID" | "DUPLICATE_IN_BATCH" | "REJECTED";
export type LeadImportPreviewRow = {
  rowNumber: number;
  status: LeadImportPreviewStatus;
  issues: string[];
  normalized?: {
    email: string | null;
    phone: string | null;
    websiteDomain: string | null;
    dedupeKey: string;
    pool: ReturnType<typeof defaultPoolForSource>;
    websiteStatus: ReturnType<typeof websiteStatusFromRecordedUrl>;
  };
  row?: LeadImportRow;
};

function issuesFrom(error: unknown) {
  if (error instanceof ZodError) return error.issues.map((issue) => issue.message);
  if (error instanceof Error) return [error.message];
  return ["The row could not be validated."];
}

export function previewLeadImport(rows: unknown[]): LeadImportPreviewRow[] {
  const seen = new Set<string>();
  return rows.map((input, index) => {
    const rowNumber = index + 1;
    try {
      const row = leadImportRowSchema.parse(input);
      assertLeadImportIntakeAllowed({ originalSource: row.originalSource, intakeMethod: row.intakeMethod });
      assertLeadImportAllowed(row);
      const dedupeKey = buildLeadDedupeKey({ company: row.company, email: row.email, businessPhone: row.businessPhone, website: row.website });
      const duplicateInBatch = seen.has(dedupeKey);
      seen.add(dedupeKey);
      return {
        rowNumber,
        status: duplicateInBatch ? "DUPLICATE_IN_BATCH" : "VALID",
        issues: duplicateInBatch ? ["Duplicate of an earlier row in this import batch."] : [],
        row,
        normalized: {
          email: normalizeEmail(row.email),
          phone: normalizePhone(row.businessPhone),
          websiteDomain: normalizeWebsiteDomain(row.website),
          dedupeKey,
          pool: defaultPoolForSource(row.originalSource),
          websiteStatus: websiteStatusFromRecordedUrl(row.website),
        },
      };
    } catch (error) {
      return { rowNumber, status: "REJECTED", issues: issuesFrom(error) };
    }
  });
}
