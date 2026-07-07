import type { LeadImportRowStatus } from "@/lib/lead-import-contract";

export const importPreviewExceptionStatuses = [
  "DUPLICATE_IN_BATCH",
  "POSSIBLE_EXISTING_DUPLICATE",
  "SUPPRESSED",
  "REJECTED",
  "REVIEW_REQUIRED",
] as const satisfies readonly LeadImportRowStatus[];

const exceptionStatusSet = new Set<string>(importPreviewExceptionStatuses);

export type ImportRowAuditContext = {
  batchId: string;
  rowId: string;
  rowNumber: number;
  status: LeadImportRowStatus;
};

export function shouldWritePreviewAudit(status: LeadImportRowStatus) {
  return exceptionStatusSet.has(status);
}

export function importRowAuditMetadata({ batchId, rowNumber, status }: ImportRowAuditContext) {
  return { batchId, rowNumber, status };
}

export function importPreviewAuditReason(status: LeadImportRowStatus) {
  switch (status) {
    case "SUPPRESSED":
      return "Row was excluded during preview because it matched an active suppression.";
    case "DUPLICATE_IN_BATCH":
      return "Row was excluded during preview because it duplicates an earlier row in the batch.";
    case "POSSIBLE_EXISTING_DUPLICATE":
      return "Row requires review because it may match an existing lead.";
    case "REJECTED":
      return "Row was rejected during preview because it did not satisfy the import contract.";
    case "REVIEW_REQUIRED":
      return "Row requires administrator review before submission.";
    default:
      return "Row reached a reviewable import preview outcome.";
  }
}
