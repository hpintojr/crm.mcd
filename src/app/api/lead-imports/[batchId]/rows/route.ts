import { ZodError } from "zod";
import { leadImportApiPaths } from "@/lib/lead-import-contract";
import { serializeLeadImportBatch } from "@/lib/lead-import-batch";
import { uploadLeadImportRowsWithConcurrencyRecovery } from "@/lib/lead-import-concurrency";
import { leadImportDomainErrorResponse } from "@/lib/lead-import-domain-error-response";
import { guardLeadImportRequest, leadImportJson } from "@/lib/lead-import-route-guard";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.uploadRows(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await uploadLeadImportRowsWithConcurrencyRecovery(batchId, guard.body);
    return leadImportJson(serializeLeadImportBatch(batch), 202, guard.requestId);
  } catch (error) {
    if (error instanceof ZodError) {
      return leadImportJson({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, 422, guard.requestId);
    }
    const domainError = leadImportDomainErrorResponse(error, guard.requestId);
    if (domainError) return domainError;

    return leadImportJson(
      { error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to upload lead-import rows." },
      500,
      guard.requestId,
    );
  }
}
