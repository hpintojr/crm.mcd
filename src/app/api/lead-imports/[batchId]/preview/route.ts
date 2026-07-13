import { leadImportApiPaths } from "@/lib/lead-import-contract";
import { serializeLeadImportBatch } from "@/lib/lead-import-batch";
import { previewImportWithAudit } from "@/lib/import-audit-service";
import { leadImportDomainErrorResponse } from "@/lib/lead-import-domain-error-response";
import { guardLeadImportRequest, leadImportJson } from "@/lib/lead-import-route-guard";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.preview(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await previewImportWithAudit(batchId);
    return leadImportJson(serializeLeadImportBatch(batch), 200, guard.requestId);
  } catch (error) {
    const domainError = leadImportDomainErrorResponse(error, guard.requestId);
    if (domainError) return domainError;

    return leadImportJson(
      { error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to preview lead-import batch." },
      500,
      guard.requestId,
    );
  }
}
