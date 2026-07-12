import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getProjectReadinessSnapshot } from "@/lib/project-readiness";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getProjectReadinessSnapshot();

  return authenticatedJson(
    {
      ...snapshot,
      viewedBy: { role: actor.role },
    },
    200,
    requestId,
  );
}
