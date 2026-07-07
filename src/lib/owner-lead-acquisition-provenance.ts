import "server-only";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/authz";

/**
 * The only application read path for acquisition-provenance records.
 *
 * Do not import this module into shared Lead/Batch serializers, Agent pages,
 * Admin pages, import-review pages, audit pages, or API routes intended for
 * any non-OWNER role. Application role enforcement does not replace database
 * least-privilege controls; it prevents disclosure through the CRM itself.
 */
export async function readOwnerLeadAcquisitionProvenance(batchId: string) {
  await requireRole(["OWNER"]);

  return db.ownerLeadAcquisitionProvenance.findUnique({
    where: { leadImportBatchId: batchId },
    select: {
      leadImportBatchId: true,
      sourceCode: true,
      acquisitionReference: true,
      providerName: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
