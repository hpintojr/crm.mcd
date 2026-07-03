import "server-only";

import { z } from "zod";
import {
  leadImportRowEnvelopeMetadataSchema,
  uploadLeadImportRowMetadataSchema,
} from "@/lib/lead-import-contract";
import { leadImportRowSchema } from "@/lib/lead-taxonomy";

/**
 * Server-only payload validation for the future /api/lead-imports route family.
 *
 * It is intentionally not imported by any public route until ImportBatch and
 * ImportRecord persistence, HMAC key storage, replay protection, and Admin
 * review are introduced together in the accepted lead-foundation migration.
 */

export const leadImportRowEnvelopeSchema = leadImportRowEnvelopeMetadataSchema.extend({
  row: leadImportRowSchema,
});

export const uploadLeadImportRowsSchema = z.object({
  rows: z.array(leadImportRowEnvelopeSchema).min(1).max(250),
}).superRefine((value, ctx) => {
  const metadata = uploadLeadImportRowMetadataSchema.safeParse({
    rows: value.rows.map(({ rowNumber, rowHash, idempotencyKey }) => ({ rowNumber, rowHash, idempotencyKey })),
  });

  if (!metadata.success) {
    for (const issue of metadata.error.issues) {
      ctx.addIssue(issue);
    }
  }
});

export type LeadImportRowEnvelope = z.infer<typeof leadImportRowEnvelopeSchema>;
export type UploadLeadImportRowsInput = z.infer<typeof uploadLeadImportRowsSchema>;
