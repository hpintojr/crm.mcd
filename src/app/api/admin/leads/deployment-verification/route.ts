import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadDeploymentVerificationSnapshot } from "@/lib/lead-deployment-verification";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = getLeadDeploymentVerificationSnapshot();

  return NextResponse.json(
    {
      ...snapshot,
      viewedBy: { id: actor.id, role: actor.role },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
