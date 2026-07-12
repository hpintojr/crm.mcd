import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";
import { runLeadAgingSweep } from "@/lib/lead-aging-jobs";

export const dynamic = "force-dynamic";

function readLimit(request: NextRequest) {
  const value = Number(request.nextUrl.searchParams.get("limit") ?? "");
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  if (!features.leads) return authenticatedJson({ error: "Not found." }, 404, requestId);

  const actor = await requireRole(ADMIN_ROLES);
  const result = await runLeadAgingSweep({ dryRun: true, limit: readLimit(request) });
  return authenticatedJson(
    {
      ...result,
      reportType: "lead-aging-preview",
      generatedByRole: actor.role,
      generatedAt: new Date().toISOString(),
      mutationPerformed: false,
    },
    200,
    requestId,
  );
}
