import { z } from "zod";

/**
 * Provider-neutral primitives for the signed batch import API.
 *
 * This module intentionally contains no route handler, database access, or
 * server-only row validation. It defines the signed batch/row contract only.
 */

export const leadImportBatchStatuses = [
  "DRAFT",
  "ROWS_RECEIVED",
  "PREVIEWED",
  "REVIEW_REQUIRED",
  "APPROVED_FOR_SUBMISSION",
  "SUBMITTED",
  "PARTIALLY_ACCEPTED",
  "COMPLETED",
  "FAILED",
  "RECONCILIATION_REQUIRED",
] as const;

export const leadImportRowStatuses = [
  "RECEIVED",
  "VALID",
  "DUPLICATE_IN_BATCH",
  "POSSIBLE_EXISTING_DUPLICATE",
  "SUPPRESSED",
  "REVIEW_REQUIRED",
  "REJECTED",
  "PENDING_ADMIN_REVIEW",
  "APPROVED",
  "IMPORTED",
  "IMPORT_ERROR",
] as const;

export const leadImportBatchStatusSchema = z.enum(leadImportBatchStatuses);
export const leadImportRowStatusSchema = z.enum(leadImportRowStatuses);

export type LeadImportBatchStatus = z.infer<typeof leadImportBatchStatusSchema>;
export type LeadImportRowStatus = z.infer<typeof leadImportRowStatusSchema>;

export const leadImportIdentifierSchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, periods, underscores, colons, or hyphens.");
export const leadImportIdempotencyKeySchema = z.string().trim().min(1).max(256).regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, periods, underscores, colons, or hyphens.");
export const leadImportSha256Schema = z.string().trim().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest.");

/**
 * Private batch-level ownership identifiers. The actual provider identity,
 * commercial terms, and purchase details remain outside MiniCRM.
 */
export const ownerLeadAcquisitionProvenanceInputSchema = z.object({
  sourceCode: leadImportIdentifierSchema.max(80),
  acquisitionReference: leadImportIdentifierSchema.max(160),
}).strict();

export const createLeadImportBatchSchema = z.object({
  localRunId: leadImportIdentifierSchema,
  operatorName: z.string().trim().min(1).max(200),
  sourceAdapter: z.string().trim().min(1).max(120),
  sourceAdapterVersion: z.string().trim().min(1).max(120),
  manifestHash: leadImportSha256Schema,
  clientVersion: z.string().trim().min(1).max(120),
}).strict();

export const leadImportRowEnvelopeMetadataSchema = z.object({
  rowNumber: z.number().int().positive().max(1_000_000),
  rowHash: leadImportSha256Schema,
  idempotencyKey: leadImportIdempotencyKeySchema,
});

export const uploadLeadImportRowMetadataSchema = z.object({
  rows: z.array(leadImportRowEnvelopeMetadataSchema).min(1).max(250),
}).superRefine((value, ctx) => {
  const rowNumbers = new Set<number>();
  const idempotencyKeys = new Set<string>();

  for (const [index, entry] of value.rows.entries()) {
    if (rowNumbers.has(entry.rowNumber)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rows", index, "rowNumber"], message: "Row numbers must be unique within an upload request." });
    }
    rowNumbers.add(entry.rowNumber);

    if (idempotencyKeys.has(entry.idempotencyKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rows", index, "idempotencyKey"], message: "Idempotency keys must be unique within an upload request." });
    }
    idempotencyKeys.add(entry.idempotencyKey);
  }
});

export const previewLeadImportSchema = z.object({
  requestedBy: z.string().trim().min(1).max(200).optional(),
});

export const submitLeadImportSchema = z.object({
  operatorName: z.string().trim().min(1).max(200),
  approvalRecordedAt: z.string().datetime({ offset: true }),
  approvalReference: z.string().trim().min(1).max(250),
});

export const leadImportRequestHeadersSchema = z.object({
  keyId: leadImportIdentifierSchema,
  timestamp: z.string().trim().regex(/^\d{13}$/, "Expected a Unix timestamp in milliseconds."),
  bodySha256: leadImportSha256Schema,
  signature: leadImportSha256Schema,
});

export type CreateLeadImportBatchInput = z.infer<typeof createLeadImportBatchSchema>;
export type OwnerLeadAcquisitionProvenanceInput = z.infer<typeof ownerLeadAcquisitionProvenanceInputSchema>;
export type LeadImportRowEnvelopeMetadata = z.infer<typeof leadImportRowEnvelopeMetadataSchema>;
export type UploadLeadImportRowMetadataInput = z.infer<typeof uploadLeadImportRowMetadataSchema>;
export type LeadImportRequestHeaders = z.infer<typeof leadImportRequestHeadersSchema>;

export const leadImportApiPaths = {
  createBatch: "/api/lead-imports",
  uploadRows: (batchId: string) => `/api/lead-imports/${batchId}/rows`,
  preview: (batchId: string) => `/api/lead-imports/${batchId}/preview`,
  submit: (batchId: string) => `/api/lead-imports/${batchId}/submit`,
  status: (batchId: string) => `/api/lead-imports/${batchId}`,
  ownerAcquisition: (batchId: string) => `/api/lead-imports/${batchId}/owner-acquisition`,
} as const;

export function makeRowIdempotencyKey(localRunId: string, rowNumber: number, rowHash: string) {
  const parsedRunId = leadImportIdentifierSchema.parse(localRunId);
  const parsedRowHash = leadImportSha256Schema.parse(rowHash).toLowerCase();
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) {
    throw new Error("A positive integer row number is required for an idempotency key.");
  }
  return leadImportIdempotencyKeySchema.parse(`${parsedRunId}:${rowNumber}:${parsedRowHash}`);
}
