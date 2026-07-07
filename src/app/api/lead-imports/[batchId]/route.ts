import { NextResponse } from "next/server";
import { leadImportApiPaths } from "@/lib/lead-import-contract";
import {
  LeadImportBatchNotFoundError,
  getLeadImportBatchStatus,
  serializeLeadImportBatch,
} from "@/lib/lead-import-batch";
import { guardLeadImportRequest } from "@/lib/lead-import-route-guard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.status(batchId));
  if (!guard.ok) return guard.response;

  try {
    const batch = await getLeadImportBatchStatus(batchId);
    return NextResponse.json(serializeLeadImportBatch(batch), { status: 200, headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof LeadImportBatchNotFoundError) {
      return NextResponse.json({ error: "LEAD_IMPORT_BATCH_NOT_FOUND", message: error.message }, { status: 404, headers: noStoreHeaders });
    }
    return NextResponse.json({ error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to retrieve lead-import batch status." }, { status: 500, headers: noStoreHeaders });
  }
}
