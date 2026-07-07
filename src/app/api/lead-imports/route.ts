import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createLeadImportBatchSchema, leadImportApiPaths } from "@/lib/lead-import-contract";
import { serializeLeadImportBatch } from "@/lib/lead-import-batch";
import {
  createLeadImportBatchWithConcurrencyRecovery,
  LeadImportBatchReplayConflictError,
} from "@/lib/lead-import-concurrency";
import { guardLeadImportRequest } from "@/lib/lead-import-route-guard";
import { requireLeadImportHmacConfig } from "@/lib/lead-import-env";

export async function POST(request: Request) {
  const guard = await guardLeadImportRequest(request, leadImportApiPaths.createBatch);
  if (!guard.ok) return guard.response;

  try {
    const input = createLeadImportBatchSchema.parse(guard.body);
    const { keyId } = requireLeadImportHmacConfig();
    const { batch, created } = await createLeadImportBatchWithConcurrencyRecovery(input, keyId);
    return NextResponse.json(serializeLeadImportBatch(batch), { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "LEAD_IMPORT_VALIDATION_ERROR", issues: error.issues }, { status: 422 });
    }
    if (error instanceof LeadImportBatchReplayConflictError) {
      return NextResponse.json({ error: "LEAD_IMPORT_REPLAY_CONFLICT", message: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "LEAD_IMPORT_INTERNAL_ERROR", message: "Unable to create lead-import batch." }, { status: 500 });
  }
}
