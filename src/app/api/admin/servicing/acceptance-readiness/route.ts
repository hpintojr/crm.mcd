import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getServicingAcceptanceReadinessSnapshot } from "@/lib/servicing-acceptance-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const snapshot = await getServicingAcceptanceReadinessSnapshot();

  return NextResponse.json(
    {
      ...snapshot,
      viewedBy: { id: actor.id, role: actor.role },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
