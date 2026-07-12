import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getIntegrationHealthSnapshot } from "@/lib/integration-health";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getIntegrationHealthSnapshot();

  return authenticatedJson(
    {
      ...snapshot,
      viewedBy: { role: actor.role },
    },
    snapshot.ok ? 200 : 503,
    requestId,
  );
}
