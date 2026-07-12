import { NextRequest } from "next/server";
import {
  authenticatedJson,
  authenticatedRequestId,
} from "@/lib/authenticated-json-boundary";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = authenticatedRequestId(request);
  if (!features.leads) return authenticatedJson({ error: "Not found." }, 404, requestId);

  await requireRole(ADMIN_ROLES);

  return authenticatedJson(
    {
      error: "This legacy Lead import endpoint is retired.",
      replacements: {
        preview: "/api/admin/leads/import/preview",
        commit: "/api/admin/leads/import",
      },
    },
    410,
    requestId,
  );
}
