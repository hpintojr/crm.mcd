import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceHandoffPacket } from "@/lib/lead-acceptance-handoff";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const packet = await getLeadAcceptanceHandoffPacket();
  return authenticatedJson(
    {
      ...packet,
      viewedBy: { role: actor.role },
      safetyBoundary:
        "Read-only acceptance handoff packet only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, or business rules.",
    },
    200,
    requestId,
  );
}
