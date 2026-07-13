import { NextRequest } from "next/server";
import { authenticatedJson, authenticatedRequestId } from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getRouteBoundaryRegistrySnapshot } from "@/lib/route-boundary-registry";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  const actor = await requireRole(ADMIN_ROLES);

  return authenticatedJson(
    {
      ...getRouteBoundaryRegistrySnapshot(),
      viewedBy: { role: actor.role },
    },
    200,
    requestId,
  );
}
