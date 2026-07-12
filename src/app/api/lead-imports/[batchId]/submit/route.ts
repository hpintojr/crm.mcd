import { ZodError } from "zod";
import { leadImportApiPaths, submitLeadImportSchema } from "@/lib/lead-import-contract";
import {
  LeadImportBatchNotFoundError,
  LeadImportBatchStateError,
  serializeLeadImportBatch,
} from "@/lib/lead-import-batch";
import { submitImportWithAudit } from "@/lib/import-audit-service";
import { guardLeadImportRequest, leadImportJson } from "@/lib/lead-import-route-guard";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.submit(batchId));
  if (!guard.ok) return guard.response;

  try {
    const input = submitLeadImportSchema.parse(guard.body);
    const batch = await submitImportWithAudit(batchId, input);
    return leadImportJson(serializeLeadImportBatch(batch), 200, guard.requestId);
  } catch (error) {
    if (error instanceof LeadImportBatchNotFoundError) {
      return leadImportJson(
        { error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message },
        404,
        guard.requestId,
      );
    }
    if (error instanceof LeadImportBatchStateError) {
      return leadImportJson(
        { error: "LEAD_IMPORT_INVALID_STATE", message: error.message },
        409,
        guard.requestId,
      );
    }
    if (error instanceof ZodError) {
      return leadImportJson({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, 422, guard.requestId);
    }
    return leadImportJson(
      { error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to submit lead-import batch." },
      500,
      guard.requestId,
    );
  }
}
