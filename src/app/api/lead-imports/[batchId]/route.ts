import { leadImportApiPaths } from "@/lib/lead-import-contract";
import { getLeadImportBatchStatus, serializeLeadImportBatch } from "@/lib/lead-import-batch";
import { leadImportDomainErrorResponse } from "@/lib/lead-import-domain-error-response";
import { guardLeadImportRequest, leadImportJson } from "@/lib/lead-import-route-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.status(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await getLeadImportBatchStatus(batchId);
    return leadImportJson(serializeLeadImportBatch(batch), 200, guard.requestId);
  } catch (error) {
    const domainError = leadImportDomainErrorResponse(error, guard.requestId);
    if (domainError) return domainError;

    return leadImportJson(
      { error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to retrieve lead-import batch status." },
      500,
      guard.requestId,
    );
  }
}
