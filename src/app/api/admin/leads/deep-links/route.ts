import { NextResponse } from "next/server";
import { ADMIN_ROLES, requireRole } from "@/lib/authz";
import { getLeadAcceptanceDeepLinks } from "@/lib/lead-acceptance-deep-links";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireRole(ADMIN_ROLES);
  const deepLinks = getLeadAcceptanceDeepLinks();

  return NextResponse.json(
    {
      ...deepLinks,
      viewedBy: { id: actor.id, role: actor.role },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
