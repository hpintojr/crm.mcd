import { NextResponse } from "next/server";
import { leadImportApiPaths } from "@/lib/lead-import-contract";
import {
  LeadImportBatchNotFoundError,
  LeadImportBatchStateError,
  serializeLeadImportBatch,
} from "@/lib/lead-import-batch";
import { previewImportWithAudit } from "@/lib/import-audit-service";
import { guardLeadImportRequest } from "@/lib/lead-import-route-guard";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.preview(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await previewImportWithAudit(batchId);
    return NextResponse.json(serializeLeadImportBatch(batch), { status: 200 });
  } catch (error) {
    if (error instanceof LeadImportBatchNotFoundError) {
      return NextResponse.json({ error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message }, { status: 404 });
    }
    if (error instanceof LeadImportBatchStateError) {
      return NextResponse.json({ error: "LEAD_IMPORT_INVALID_STATE", message: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to preview lead-import batch." }, { status: 500 });
  }
}
