import {
  type LeadImportBatchStatus,
  type LeadImportRowStatus,
} from "@/lib/lead-import-contract";

/**
 * Pure workflow rules for the future durable import API.
 *
 * No route handler, database dependency, or side effect is present here.
 */

const batchTransitions: Record<LeadImportBatchStatus, readonly LeadImportBatchStatus[]> = {
  DRAFT: ["ROWS_RECEIVED", "FAILED"],
  ROWS_RECEIVED: ["PREVIEWED", "FAILED"],
  PREVIEWED: ["REVIEW_REQUIRED", "APPROVED_FOR_SUBMISSION", "FAILED"],
  REVIEW_REQUIRED: ["APPROVED_FOR_SUBMISSION", "FAILED"],
  APPROVED_FOR_SUBMISSION: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["PARTIALLY_ACCEPTED", "COMPLETED", "RECONCILIATION_REQUIRED", "FAILED"],
  PARTIALLY_ACCEPTED: ["COMPLETED", "RECONCILIATION_REQUIRED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
  RECONCILIATION_REQUIRED: ["COMPLETED", "FAILED"],
};

const rowTransitions: Record<LeadImportRowStatus, readonly LeadImportRowStatus[]> = {
  RECEIVED: ["VALID", "DUPLICATE_IN_BATCH", "POSSIBLE_EXISTING_DUPLICATE", "SUPPRESSED", "REVIEW_REQUIRED", "REJECTED", "IMPORT_ERROR"],
  VALID: ["PENDING_ADMIN_REVIEW", "REJECTED", "IMPORT_ERROR"],
  DUPLICATE_IN_BATCH: [],
  POSSIBLE_EXISTING_DUPLICATE: ["PENDING_ADMIN_REVIEW", "REJECTED"],
  SUPPRESSED: [],
  REVIEW_REQUIRED: ["PENDING_ADMIN_REVIEW", "REJECTED"],
  REJECTED: [],
  PENDING_ADMIN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["IMPORTED", "IMPORT_ERROR"],
  IMPORTED: [],
  IMPORT_ERROR: ["PENDING_ADMIN_REVIEW", "REJECTED"],
};

export type LeadImportBatchCounts = {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  importedRows: number;
  reviewRequiredRows: number;
  reconciliationRequiredRows: number;
};

export function mayTransitionLeadImportBatch(from: LeadImportBatchStatus, to: LeadImportBatchStatus) {
  return batchTransitions[from].includes(to);
}

export function assertLeadImportBatchTransition(from: LeadImportBatchStatus, to: LeadImportBatchStatus) {
  if (!mayTransitionLeadImportBatch(from, to)) throw new Error(`Lead import batch transition ${from} → ${to} is not allowed.`);
}

export function mayTransitionLeadImportRecord(from: LeadImportRowStatus, to: LeadImportRowStatus) {
  return rowTransitions[from].includes(to);
}

export function assertLeadImportRecordTransition(from: LeadImportRowStatus, to: LeadImportRowStatus) {
  if (!mayTransitionLeadImportRecord(from, to)) throw new Error(`Lead import record transition ${from} → ${to} is not allowed.`);
}

export function requiresAdminReview(status: LeadImportRowStatus) {
  return status === "POSSIBLE_EXISTING_DUPLICATE" || status === "REVIEW_REQUIRED" || status === "PENDING_ADMIN_REVIEW" || status === "IMPORT_ERROR";
}

export function mayCreateLeadFromImport({ batchStatus, recordStatus }: { batchStatus: LeadImportBatchStatus; recordStatus: LeadImportRowStatus }) {
  return batchStatus === "SUBMITTED" && recordStatus === "APPROVED";
}

export function importedLeadSafetyDefaults() {
  return { lifecycle: "PENDING_REVIEW" as const, ownerAgentId: null, autoCampaign: false, autoSend: false };
}

export function summarizeLeadImportRows(statuses: readonly LeadImportRowStatus[]): LeadImportBatchCounts {
  const totalRows = statuses.length;
  const importedRows = statuses.filter((status) => status === "IMPORTED").length;
  const rejectedRows = statuses.filter((status) => ["DUPLICATE_IN_BATCH", "SUPPRESSED", "REJECTED"].includes(status)).length;
  const reviewRequiredRows = statuses.filter(requiresAdminReview).length;
  const reconciliationRequiredRows = statuses.filter((status) => status === "IMPORT_ERROR").length;
  const validRows = statuses.filter((status) => ["VALID", "PENDING_ADMIN_REVIEW", "APPROVED", "IMPORTED"].includes(status)).length;
  return { totalRows, validRows, rejectedRows, importedRows, reviewRequiredRows, reconciliationRequiredRows };
}

export function recommendLeadImportBatchStatus(statuses: readonly LeadImportRowStatus[]): LeadImportBatchStatus {
  if (statuses.length === 0) return "ROWS_RECEIVED";
  if (statuses.some((status) => status === "IMPORT_ERROR")) return "RECONCILIATION_REQUIRED";
  if (statuses.some(requiresAdminReview)) return "REVIEW_REQUIRED";
  if (statuses.every((status) => ["DUPLICATE_IN_BATCH", "SUPPRESSED", "REJECTED"].includes(status))) return "COMPLETED";
  return "PREVIEWED";
}
