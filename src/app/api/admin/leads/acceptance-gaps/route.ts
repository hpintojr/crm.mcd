import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceEvidenceGaps } from "@/lib/lead-acceptance-gaps";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const gaps = await getLeadAcceptanceEvidenceGaps();
  return authenticatedJson(
    {
      ...gaps,
      viewedBy: { role: actor.role },
      safetyBoundary:
        "Read-only acceptance evidence gaps only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    200,
    requestId,
  );
}
