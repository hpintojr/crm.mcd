import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ownerLeadAcquisitionProvenanceInputSchema } from "@/lib/lead-import-contract";
import { guardLeadImportRequest } from "@/lib/lead-import-route-guard";
import {
  OwnerLeadAcquisitionProvenanceConflictError,
  recordOwnerLeadAcquisitionProvenance,
} from "@/lib/owner-lead-acquisition-provenance";

export async function POST(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const path = `/api/lead-imports/${batchId}/owner-acquisition`;
  const guard = await guardLeadImportRequest(request, path);
  if (!guard.ok) return guard.response;

  try {
    const input = ownerLeadAcquisitionProvenanceInputSchema.parse(guard.body);
    const result = await recordOwnerLeadAcquisitionProvenance(batchId, input);
    return NextResponse.json({ status: result.recorded ? "RECORDED" : "UNCHANGED" }, { status: result.recorded ? 201 : 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, { status: 422 });
    }
    if (error instanceof OwnerLeadAcquisitionProvenanceConflictError) {
      return NextResponse.json({ error: "LEAD_IMPORT_REPLAY_CONFLICT", message: "Owner acquisition record conflicts with an existing immutable batch record." }, { status: 409 });
    }
    return NextResponse.json({ error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to record private acquisition provenance." }, { status: 500 });
  }
}
