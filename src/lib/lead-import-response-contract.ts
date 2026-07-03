import { z } from "zod";
import {
  leadImportBatchStatusSchema,
  leadImportIdentifierSchema,
  leadImportIdempotencyKeySchema,
  leadImportRowStatusSchema,
} from "@/lib/lead-import-contract";

/**
 * Provider-neutral response shapes for the future paid-data import API.
 *
 * These schemas define JSON returned by a later route and Admin review UI.
 * They contain no route, persistence, secret, or import behavior.
 */

export const leadImportBatchCountsSchema = z.object({
  totalRows: z.number().int().nonnegative(),
  validRows: z.number().int().nonnegative(),
  rejectedRows: z.number().int().nonnegative(),
  importedRows: z.number().int().nonnegative(),
  reviewRequiredRows: z.number().int().nonnegative(),
  reconciliationRequiredRows: z.number().int().nonnegative(),
});

export const leadImportBatchSummarySchema = z.object({
  batchId: leadImportIdentifierSchema,
  localRunId: leadImportIdentifierSchema,
  status: leadImportBatchStatusSchema,
  counts: leadImportBatchCountsSchema,
  approvalReference: z.string().trim().min(1).max(250).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const leadImportRecordDecisionSchema = z.object({
  rowNumber: z.number().int().positive().max(1_000_000),
  idempotencyKey: leadImportIdempotencyKeySchema,
  status: leadImportRowStatusSchema,
  issues: z.array(z.string().trim().min(1).max(1_000)).max(100),
  resolvedLeadId: leadImportIdentifierSchema.nullable(),
});

export const createLeadImportBatchResponseSchema = z.object({
  batch: leadImportBatchSummarySchema,
});

export const uploadLeadImportRowsResponseSchema = z.object({
  batch: leadImportBatchSummarySchema,
  receivedRows: z.number().int().positive().max(250),
});

export const previewLeadImportResponseSchema = z.object({
  batch: leadImportBatchSummarySchema,
  records: z.array(leadImportRecordDecisionSchema).max(250),
});

export const submitLeadImportResponseSchema = z.object({
  batch: leadImportBatchSummarySchema,
});

export const getLeadImportStatusResponseSchema = z.object({
  batch: leadImportBatchSummarySchema,
  records: z.array(leadImportRecordDecisionSchema).max(250),
});

export type LeadImportBatchCounts = z.infer<typeof leadImportBatchCountsSchema>;
export type LeadImportBatchSummary = z.infer<typeof leadImportBatchSummarySchema>;
export type LeadImportRecordDecision = z.infer<typeof leadImportRecordDecisionSchema>;
export type CreateLeadImportBatchResponse = z.infer<typeof createLeadImportBatchResponseSchema>;
export type UploadLeadImportRowsResponse = z.infer<typeof uploadLeadImportRowsResponseSchema>;
export type PreviewLeadImportResponse = z.infer<typeof previewLeadImportResponseSchema>;
export type SubmitLeadImportResponse = z.infer<typeof submitLeadImportResponseSchema>;
export type GetLeadImportStatusResponse = z.infer<typeof getLeadImportStatusResponseSchema>;
