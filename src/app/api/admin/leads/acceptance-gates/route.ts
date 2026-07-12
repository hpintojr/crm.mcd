import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceClosedGates } from "@/lib/lead-acceptance-gates";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const gates = await getLeadAcceptanceClosedGates();
  return authenticatedJson(
    {
      ...gates,
      viewedBy: { role: actor.role },
      safetyBoundary:
        "Read-only closed acceptance gates only. Does not mutate Leads, audit records, feature flags, GHL workflows, imports, exports, commissions, payouts, finance, client onboarding, or business rules.",
    },
    200,
    requestId,
  );
}
