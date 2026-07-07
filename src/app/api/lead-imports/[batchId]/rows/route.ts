import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { leadImportApiPaths } from "@/lib/lead-import-contract";
import {
  LeadImportBatchNotFoundError,
  LeadImportBatchStateError,
  serializeLeadImportBatch,
  uploadLeadImportRows,
} from "@/lib/lead-import-batch";
import { guardLeadImportRequest } from "@/lib/lead-import-route-guard";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.uploadRows(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await uploadLeadImportRows(batchId, guard.body);
    return NextResponse.json(serializeLeadImportBatch(batch), { status: 202 });
  } catch (error) {
    if (error instanceof LeadImportBatchNotFoundError) {
      return NextResponse.json({ error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message }, { status: 404 });
    }
    if (error instanceof LeadImportBatchStateError) {
      return NextResponse.json({ error: "LEAD_IMPORT_INVALID_STATE", message: error.message }, { status: 409 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, { status: 422 });
    }
    return NextResponse.json({ error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to upload lead-import rows." }, { status: 500 });
  }
}
