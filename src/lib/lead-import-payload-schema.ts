import "server-only";

import { z } from "zod";
import {
  leadImportRowEnvelopeMetadataSchema,
  uploadLeadImportRowMetadataSchema,
} from "@/lib/lead-import-contract";
import { leadImportRowSchema } from "@/lib/lead-taxonomy";

/**
 * Server-only payload validation for the future paid-data import route family.
 * It is intentionally unconnected until durable import records and route
 * handlers exist.
 */

export const leadImportRowEnvelopeSchema = leadImportRowEnvelopeMetadataSchema.extend({
  row: leadImportRowSchema,
});

export const uploadLeadImportRowsPayloadSchema = z.object({
  rows: z.array(leadImportRowEnvelopeSchema).min(1).max(250),
}).superRefine((value, ctx) => {
  const metadata = uploadLeadImportRowMetadataSchema.safeParse({
    rows: value.rows.map(({ rowNumber, rowHash, idempotencyKey }) => ({ rowNumber, rowHash, idempotencyKey })),
  });

  if (!metadata.success) {
    for (const issue of metadata.error.issues) ctx.addIssue(issue);
  }
});

export type LeadImportRowEnvelope = z.infer<typeof leadImportRowEnvelopeSchema>;
export type UploadLeadImportRowsPayload = z.infer<typeof uploadLeadImportRowsPayloadSchema>;
