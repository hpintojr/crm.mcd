import { ZodError } from "zod";
import { leadImportApiPaths, ownerLeadAcquisitionProvenanceInputSchema } from "@/lib/lead-import-contract";
import { guardLeadImportRequest, leadImportJson } from "@/lib/lead-import-route-guard";
import {
  OwnerLeadAcquisitionProvenanceBatchNotFoundError,
  OwnerLeadAcquisitionProvenanceConflictError,
  OwnerLeadAcquisitionProvenanceStateError,
  recordOwnerLeadAcquisitionProvenance,
} from "@/lib/owner-lead-acquisition-provenance";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.ownerAcquisition(batchId));
  if (!guard.ok) return guard.response;

  try {
    const input = ownerLeadAcquisitionProvenanceInputSchema.parse(guard.body);
    const result = await recordOwnerLeadAcquisitionProvenance(batchId, input);
    return leadImportJson(
      { status: result.recorded ? "RECORDED" : "UNCHANGED" },
      result.recorded ? 201 : 200,
      guard.requestId,
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return leadImportJson({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, 422, guard.requestId);
    }
    if (error instanceof OwnerLeadAcquisitionProvenanceBatchNotFoundError) {
      return leadImportJson(
        { error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: "Lead import batch was not found." },
        404,
        guard.requestId,
      );
    }
    if (error instanceof OwnerLeadAcquisitionProvenanceStateError) {
      return leadImportJson(
        { error: "LEAD_IMPORT_INVALID_STATE", message: "Owner acquisition metadata must be recorded before row upload begins." },
        409,
        guard.requestId,
      );
    }
    if (error instanceof OwnerLeadAcquisitionProvenanceConflictError) {
      return leadImportJson(
        { error: "LEAD_IMPORT_REPLAY_CONFLICT", message: "Owner acquisition record conflicts with an existing immutable batch record." },
        409,
        guard.requestId,
      );
    }
    return leadImportJson(
      { error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to record private acquisition provenance." },
      500,
      guard.requestId,
    );
  }
}
