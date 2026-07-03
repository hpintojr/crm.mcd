import { z } from "zod";
import { leadImportRowSchema } from "@/lib/lead-taxonomy";

/**
 * Canonical, provider-neutral contract for the local mcd_lead_ops exporter.
 *
 * This file intentionally defines only request/response shapes and invariants.
 * It does not create database records or expose an endpoint. The database-backed
 * implementation arrives only after the focused lead-foundation migration is
 * accepted and tested on an isolated Neon branch.
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

const identifierSchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/, "Use only letters, numbers, periods, underscores, colons, or hyphens.");
const sha256Schema = z.string().trim().regex(/^[a-f0-9]{64}$/i, "Expected a SHA-256 hex digest.");

export const createLeadImportBatchSchema = z.object({
  localRunId: identifierSchema,
  operatorName: z.string().trim().min(1).max(200),
  sourceAdapter: z.string().trim().min(1).max(120),
  sourceAdapterVersion: z.string().trim().min(1).max(120),
  manifestHash: sha256Schema,
  clientVersion: z.string().trim().min(1).max(120),
});

export const leadImportRowEnvelopeSchema = z.object({
  rowNumber: z.number().int().positive().max(1_000_000),
  rowHash: sha256Schema,
  idempotencyKey: identifierSchema,
  row: leadImportRowSchema,
});

export const uploadLeadImportRowsSchema = z.object({
  rows: z.array(leadImportRowEnvelopeSchema).min(1).max(250),
}).superRefine((value, ctx) => {
  const rowNumbers = new Set<number>();
  const idempotencyKeys = new Set<string>();

  for (const [index, entry] of value.rows.entries()) {
    if (rowNumbers.has(entry.rowNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", index, "rowNumber"],
        message: "Row numbers must be unique within an upload request.",
      });
    }
    rowNumbers.add(entry.rowNumber);

    if (idempotencyKeys.has(entry.idempotencyKey)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rows", index, "idempotencyKey"],
        message: "Idempotency keys must be unique within an upload request.",
      });
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
  keyId: identifierSchema,
  timestamp: z.string().trim().regex(/^\d{13}$/, "Expected a Unix timestamp in milliseconds."),
  bodySha256: sha256Schema,
  signature: sha256Schema,
});

export type CreateLeadImportBatchInput = z.infer<typeof createLeadImportBatchSchema>;
export type LeadImportRowEnvelope = z.infer<typeof leadImportRowEnvelopeSchema>;
export type UploadLeadImportRowsInput = z.infer<typeof uploadLeadImportRowsSchema>;
export type LeadImportRequestHeaders = z.infer<typeof leadImportRequestHeadersSchema>;

export const leadImportApiPaths = {
  createBatch: "/api/lead-imports",
  uploadRows: (batchId: string) => `/api/lead-imports/${batchId}/rows`,
  preview: (batchId: string) => `/api/lead-imports/${batchId}/preview`,
  submit: (batchId: string) => `/api/lead-imports/${batchId}/submit`,
  status: (batchId: string) => `/api/lead-imports/${batchId}`,
} as const;

export function makeRowIdempotencyKey(localRunId: string, rowNumber: number, rowHash: string) {
  const parsedRunId = identifierSchema.parse(localRunId);
  const parsedRowHash = sha256Schema.parse(rowHash).toLowerCase();
  if (!Number.isSafeInteger(rowNumber) || rowNumber < 1) {
    throw new Error("A positive integer row number is required for an idempotency key.");
  }

  return `${parsedRunId}:${rowNumber}:${parsedRowHash}`;
}
